import { initTRPC, TRPCError } from '@trpc/server';
import {
  runCodeInputSchema,
  submitCodeInputSchema,
  type RunCodeResponse,
  type SubmitCodeResponse,
  type TestCaseEvaluation,
  type SubmissionVerdict,
} from '@code-arena/shared';
import { getDb, problems, eq, and } from '@code-arena/db';
import { getMockProblemBySlug } from '@code-arena/shared';
import { publishPracticeSamplePassed } from '../services/activity-feed';
import {
  executeWithJudge0,
  compareOutputs,
  checkJudge0Health,
  getJudge0Config,
} from '../services/judge0';

const t = initTRPC.create();
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
      return rows[0];
    }
  } catch (err) {
    console.warn(`[Execution] Database lookup failed for slug "${slug}", checking mock fallback:`, err);
  }

  const fallback = getMockProblemBySlug(slug);
  return fallback || null;
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
    const problem = await getProblemForExecution(input.problemSlug);
    if (!problem) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Problem "${input.problemSlug}" not found.`,
      });
    }

    const testCaseIndex = input.testCaseIndex ?? 0;
    const sampleExample = problem.examples[testCaseIndex] ?? problem.examples[0];

    const stdinToUse = input.stdin ? input.stdin : sampleExample?.input || '';
    const expectedOutputToUse = input.expectedOutput
      ? input.expectedOutput
      : sampleExample?.output || '';

    const execution = await executeWithJudge0({
      sourceCode: input.sourceCode,
      language: input.language,
      stdin: stdinToUse,
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
   * Evaluates code against all sample test cases of the problem via Judge0 CE.
   */
  submit: publicProcedure
    .input(submitCodeInputSchema)
    .mutation(async ({ input }): Promise<SubmitCodeResponse> => {
      const problem = await getProblemForExecution(input.problemSlug);
      if (!problem) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Problem "${input.problemSlug}" not found.`,
        });
      }

      const examples = problem.examples && problem.examples.length > 0 ? problem.examples : [];
      const submittedAt = new Date().toISOString();
      const disclaimer =
        'Evaluated against available sample test cases only. Passing sample test cases does not guarantee acceptance on hidden judge tests.';

      if (examples.length === 0) {
        return {
          success: false,
          judge0Available: true,
          language: input.language,
          verdict: 'SAMPLE_FAILED',
          totalCases: 0,
          passedCases: 0,
          evaluations: [],
          summary: 'No sample test cases exist for this problem.',
          error: 'No test cases available to evaluate.',
          disclaimer,
          submittedAt,
        };
      }

      const evaluations: TestCaseEvaluation[] = [];
      let passedCases = 0;
      let totalTime = 0;
      let maxMemory = 0;
      let criticalVerdict: SubmissionVerdict | null = null;

      for (let i = 0; i < examples.length; i++) {
        const example = examples[i];
        const execution = await executeWithJudge0({
          sourceCode: input.sourceCode,
          language: input.language,
          stdin: example.input,
        });

        if (!execution.success) {
          return {
            success: false,
            judge0Available: execution.judge0Available,
            language: input.language,
            verdict: 'SERVICE_UNAVAILABLE',
            totalCases: examples.length,
            passedCases,
            evaluations,
            summary: `Execution aborted: ${execution.error}`,
            error: execution.error,
            disclaimer,
            submittedAt,
          };
        }

        const res = execution.result;

        // Record execution time and memory
        if (res.time) totalTime += parseFloat(res.time) || 0;
        if (res.memory && res.memory > maxMemory) maxMemory = res.memory;

        // If compilation error occurs, fail immediately with COMPILE_ERROR
        if (res.errorType === 'compile_error') {
          evaluations.push({
            caseIndex: i,
            input: example.input,
            expectedOutput: example.output,
            actualOutput: null,
            isMatched: false,
            status: res.status,
            compileOutput: res.compileOutput,
            stderr: res.stderr,
          });
          criticalVerdict = 'COMPILE_ERROR';
          break;
        }

        // If time limit exceeded
        if (res.errorType === 'time_limit') {
          evaluations.push({
            caseIndex: i,
            input: example.input,
            expectedOutput: example.output,
            actualOutput: res.stdout,
            isMatched: false,
            status: res.status,
            executionTime: res.time,
            memory: res.memory,
            error: 'Time Limit Exceeded',
          });
          criticalVerdict = 'TIME_LIMIT_EXCEEDED';
          break;
        }

        // Runtime error
        if (res.errorType === 'runtime_error') {
          evaluations.push({
            caseIndex: i,
            input: example.input,
            expectedOutput: example.output,
            actualOutput: res.stdout,
            isMatched: false,
            status: res.status,
            executionTime: res.time,
            memory: res.memory,
            stderr: res.stderr,
          });
          criticalVerdict = 'RUNTIME_ERROR';
          break;
        }

        // Normal output comparison
        const matched = compareOutputs(res.stdout, example.output);
        if (matched) {
          passedCases++;
        }

        evaluations.push({
          caseIndex: i,
          input: example.input,
          expectedOutput: example.output,
          actualOutput: res.stdout,
          isMatched: matched,
          status: res.status,
          executionTime: res.time,
          memory: res.memory,
          stderr: res.stderr,
        });
      }

      let verdict: SubmissionVerdict;
      let summary: string;

      if (criticalVerdict) {
        verdict = criticalVerdict;
        summary = `Submission failed: ${criticalVerdict.replace(/_/g, ' ')}`;
      } else if (passedCases === examples.length) {
        verdict = 'SAMPLE_PASSED';
        summary = `All ${examples.length} sample test cases passed!`;
      } else {
        verdict = 'SAMPLE_FAILED';
        summary = `${passedCases}/${examples.length} sample test cases passed.`;
      }

      if (verdict === 'SAMPLE_PASSED') {
        publishPracticeSamplePassed({ slug: problem.slug, title: problem.title });
      }

      return {
        success: verdict === 'SAMPLE_PASSED',
        judge0Available: true,
        language: input.language,
        verdict,
        totalCases: examples.length,
        passedCases,
        evaluations,
        summary,
        executionTime: `${totalTime.toFixed(3)}s`,
        memory: maxMemory,
        disclaimer,
        submittedAt,
      };
    }),
});
