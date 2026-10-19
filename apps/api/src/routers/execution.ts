import { TRPCError } from '@trpc/server';
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
import { router, publicProcedure } from '../trpc';
import { dbTestCaseStore, isMissingTestCasesTable } from '../services/test-case-store';

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
  run: publicProcedure.input(runCodeInputSchema).mutation(async ({ input }): Promise<RunCodeResponse> => {
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
  }),

  /**
   * Evaluates code server-side against all visible samples and, when configured, all judge
   * (hidden) test cases. Hidden case data is never included in the response.
   */
  submit: publicProcedure
    .input(submitCodeInputSchema)
    .mutation(async ({ ctx, input }): Promise<SubmitCodeResponse> => {
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

      return {
        ...outcome,
        language: input.language,
        submittedAt,
      };
    }),
});

// Re-exported for consumers that want to label results consistently.
export { fullEvaluationDisclaimer, SAMPLE_ONLY_DISCLAIMER };
