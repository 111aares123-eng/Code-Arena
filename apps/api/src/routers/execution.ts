import { z } from 'zod';
import { initTRPC, TRPCError } from '@trpc/server';
import {
  runCodeInputSchema,
  submitCodeInputSchema,
  type ExecutionTestCase,
  type RunCodeResponse,
  type SubmitCodeResponse,
  type TestCaseEvaluation,
} from '@code-arena/shared';
import { getDb, problems, eq, and } from '@code-arena/db';
import { getMockProblemBySlug } from '@code-arena/shared';
import type { ApiContext } from '../context';
import { publishPracticeSamplePassed } from '../services/activity-feed';
import { evaluateSubmission, fullEvaluationDisclaimer, SAMPLE_ONLY_DISCLAIMER } from '../services/evaluation';
import { buildExecutionHarness } from '../services/harness';
import {
  executeWithJudge0,
  compareOutputs,
  checkJudge0Health,
  getJudge0Config,
} from '../services/judge0';
import { dbTestCaseStore, isMissingTestCasesTable } from '../services/test-case-store';
import { dbSubmissionStore } from '../services/submission-store';
import { dbProgressStore } from '../services/progress-store';
import { getExecutionRateLimiter } from '../services/rate-limiter';

const t = initTRPC.context<ApiContext>().create();
export const router = t.router;
export const publicProcedure = t.procedure;

async function getProblemForExecution(slug: string) {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(problems)
      .where(and(eq(problems.slug, slug), eq(problems.status, 'PUBLISHED')))
      .limit(1);

    if (rows[0]) {
      return { problem: rows[0], fromDatabase: true as const };
    }
  } catch (err) {
    console.warn(`[Execution] Database lookup failed for slug "${slug}", checking mock fallback:`, err);
  }

  const fallback = getMockProblemBySlug(slug);
  return fallback ? { problem: fallback, fromDatabase: false as const } : null;
}

export const executionRouter = router({
  /**
   * Health-check procedure to verify Judge0 connectivity and environment configuration.
   */
  health: publicProcedure.query(async () => {
    const config = getJudge0Config();
    const health = await checkJudge0Health();
    return {
      judge0BaseUrl: config.baseUrl,
      configuredTimeoutMs: config.timeoutMs,
      pythonLangId: config.pythonLangId,
      cppLangId: config.cppLangId,
      available: health.available,
      version: health.version,
      error: health.error,
    };
  }),

  /**
   * Runs code against a single sample test case or custom input via Judge0 CE.
   */
  run: publicProcedure.input(runCodeInputSchema).mutation(async ({ ctx, input }): Promise<RunCodeResponse> => {
    let releaseSlot: (() => void) | undefined;
    if (!ctx?.skipRateLimit) {
      const limiter = ctx?.rateLimiter ?? getExecutionRateLimiter();
      const clientIp = (ctx?.clientIp as string | undefined) ?? 'direct';
      limiter.checkRateLimit(clientIp, 'run');
      releaseSlot = limiter.acquireConcurrencySlot(clientIp);
    }

    try {
      const found = await getProblemForExecution(input.problemSlug);
      if (!found) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Problem "${input.problemSlug}" not found.`,
        });
      }
      // Run only ever uses the problem's public examples; judge (hidden) cases are not reachable here.
      const problem = found.problem;

      const testCaseIndex = input.testCaseIndex ?? 0;
      const sampleExample = problem.examples[testCaseIndex] ?? problem.examples[0];

      const stdinToUse: string = typeof input.stdin === 'string' ? input.stdin : (sampleExample?.input ?? '');
      const hasExplicitStdin = typeof input.stdin === 'string';
      const expectedOutputToUse: string =
        typeof input.expectedOutput === 'string' ? input.expectedOutput : (sampleExample?.output ?? '');

      // If explicit stdin is given and differs from sample input, run as custom standalone IO
      const isCustomRun = hasExplicitStdin && input.stdin !== sampleExample?.input;

      const harnessResult = !isCustomRun
        ? buildExecutionHarness({
            problemSlug: problem.slug,
            language: input.language,
            sourceCode: input.sourceCode,
            structuredInput: sampleExample?.structuredInput,
            rawInput: sampleExample?.input,
          })
        : { code: input.sourceCode, wasHarnessed: false };

      const execution = await executeWithJudge0({
        sourceCode: harnessResult.code,
        language: input.language,
        stdin: harnessResult.wasHarnessed ? '' : stdinToUse,
      });

      const executedAt = new Date().toISOString();

      if (!execution.success) {
        return {
          success: false,
          judge0Available: execution.judge0Available,
          language: input.language,
          error: execution.error,
          executedAt,
        };
      }

      const result = execution.result;
      const isMatched =
        !result.isError &&
        compareOutputs(result.stdout, expectedOutputToUse);

      const testCaseEvaluation: TestCaseEvaluation = {
        caseIndex: testCaseIndex,
        input: stdinToUse,
        expectedOutput: expectedOutputToUse,
        actualOutput: result.stdout,
        isMatched,
        status: result.status,
        executionTime: result.time,
        memory: result.memory,
        stderr: result.stderr,
        compileOutput: result.compileOutput,
      };

      return {
        success: true,
        judge0Available: true,
        language: input.language,
        result,
        testCaseEvaluation,
        executedAt,
      };
    } finally {
      releaseSlot?.();
    }
  }),

  /**
   * Evaluates code server-side against all visible samples and, when configured, all judge
   * (hidden) test cases. Hidden case data is never included in the response.
   */
  submit: publicProcedure
    .input(submitCodeInputSchema)
    .mutation(async ({ ctx, input }): Promise<SubmitCodeResponse> => {
      let releaseSlot: (() => void) | undefined;
      if (!ctx?.skipRateLimit) {
        const limiter = ctx?.rateLimiter ?? getExecutionRateLimiter();
        const clientIp = (ctx?.clientIp as string | undefined) ?? 'direct';
        limiter.checkRateLimit(clientIp, 'submit');
        releaseSlot = limiter.acquireConcurrencySlot(clientIp);
      }

      try {
        const found = await getProblemForExecution(input.problemSlug);
        if (!found) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Problem "${input.problemSlug}" not found.`,
          });
        }

        const { problem, fromDatabase } = found;
        const examples = problem.examples && problem.examples.length > 0 ? problem.examples : [];
        const submittedAt = new Date().toISOString();
        const store = ctx?.testCaseStore ?? dbTestCaseStore;

        // Judge cases live only in the database. The bundled mock fallback has none.
        let judgeCases: ExecutionTestCase[] = [];
        if (fromDatabase || ctx?.testCaseStore) {
          try {
            judgeCases = await store.listForEvaluation(problem.id);
          } catch (err) {
            if (isMissingTestCasesTable(err)) {
              // Migration 0001 not applied: no judge cases can exist, sample-only mode is correct.
              console.warn('[Execution] test_cases table missing; run database migrations. Evaluating samples only.');
            } else {
              // Fail closed: never downgrade a problem that may have hidden cases to sample-only.
              // Only the error class is logged; it carries no test-case data.
              console.error(
                `[Execution] Failed to load judge test cases for problem "${problem.slug}":`,
                err instanceof Error ? err.name : 'UnknownError'
              );
              return {
                success: false,
                judge0Available: true,
                language: input.language,
                verdict: 'SERVICE_UNAVAILABLE',
                totalCases: examples.length,
                passedCases: 0,
                evaluations: [],
                summary: 'Submission was not evaluated: judge test cases could not be loaded.',
                error: 'Judge test cases are temporarily unavailable. Please try again.',
                disclaimer: SAMPLE_ONLY_DISCLAIMER,
                submittedAt,
              };
            }
          }
        }

        const outcome = await evaluateSubmission({
          problem: { slug: problem.slug, examples },
          judgeCases,
          language: input.language,
          sourceCode: input.sourceCode,
        });

        if (outcome.verdict === 'SAMPLE_PASSED' || outcome.verdict === 'ACCEPTED') {
          // Every ACCEPTED submission also passed all samples, so the existing event type stays truthful.
          publishPracticeSamplePassed({ slug: problem.slug, title: problem.title });
        }

        // ---- Persistent Submission History ----
        let submissionId: string | null = null;
        let persisted = false;

        // Identity Resolution: check if authenticated student identity is present
        // Requirement 3: Do not assign anonymous students to one fake user, trust a userId supplied
        // by the browser, or create an authentication bypass.
        const user = ctx?.user;
        if (user?.id) {
          try {
            const subStore = ctx?.submissionStore ?? dbSubmissionStore;
            // Preserving hidden-test confidentiality:
            // outcome.evaluations contains only visible test case evaluations.
            const visibleEvaluations = outcome.evaluations ?? [];

            const saved = await subStore.create({
              userId: user.id,
              problemId: problem.id,
              language: input.language,
              code: input.sourceCode,
              verdict: outcome.verdict,
              passedCases: outcome.passedCases,
              totalCases: outcome.totalCases,
              executionTime: outcome.executionTime ?? null,
              memory: outcome.memory ?? null,
              error: outcome.error ?? null,
              evaluations: visibleEvaluations,
            });

            submissionId = saved.id;
            persisted = true;

            // ---- Server-Side Progress & XP Awarding ----
            // Requirement A: Persist solved-problem status and derived XP on the server.
            // Award progress only from server-verified evaluation results, not arbitrary client sync.
            // Awarding is idempotent so retries cannot grant duplicate XP.
            const progStore = ctx?.progressStore ?? dbProgressStore;
            await progStore.recordProgress({
              userId: user.id,
              problemId: problem.id,
              verdict: outcome.verdict,
              submissionId: saved.id,
              difficulty: (problem as any).difficulty,
            });
          } catch (dbErr) {
            // Requirement 5: Handle database failures explicitly.
            // A successful verdict must not silently become a misleading failure just because persistence failed.
            // Requirement 6: Avoid logging submitted source code or secrets unnecessarily.
            console.warn(
              `[Execution] Failed to persist submission or progress for problem "${problem.slug}":`,
              dbErr instanceof Error ? dbErr.name : 'DatabaseError'
            );
          }
        }

        return {
          ...outcome,
          language: input.language,
          submittedAt,
          submissionId,
          persisted,
        };
      } finally {
        releaseSlot?.();
      }
    }),

  /**
   * Retrieves paginated submission history for the authenticated student.
   */
  history: publicProcedure
    .input(
      z
        .object({
          problemSlug: z.string().optional(),
          limit: z.number().int().positive().max(100).optional(),
          offset: z.number().int().nonnegative().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const user = ctx?.user;
      if (!user?.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Authentication required to view submission history.',
        });
      }

      let problemId: string | undefined;
      if (input?.problemSlug) {
        const found = await getProblemForExecution(input.problemSlug);
        if (found) {
          problemId = found.problem.id;
        } else {
          return { submissions: [], total: 0 };
        }
      }

      const subStore = ctx?.submissionStore ?? dbSubmissionStore;
      const rows = await subStore.listByUser(user.id, {
        problemId,
        limit: input?.limit,
        offset: input?.offset,
      });

      return {
        submissions: rows,
        total: rows.length,
      };
    }),

  /**
   * Retrieves a specific submission by ID, ensuring strict student identity isolation.
   */
  getSubmission: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const user = ctx?.user;
      if (!user?.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Authentication required to view submission details.',
        });
      }

      const subStore = ctx?.submissionStore ?? dbSubmissionStore;
      const submission = await subStore.getById(input.id);

      if (!submission) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Submission "${input.id}" not found.`,
        });
      }

      // Identity isolation: Only the owning student or an admin can access this submission record
      if (submission.userId !== user.id && user.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not authorized to view this submission.',
        });
      }

      return submission;
    }),
});

// Re-exported for consumers that want to label results consistently.
export { fullEvaluationDisclaimer, SAMPLE_ONLY_DISCLAIMER };
