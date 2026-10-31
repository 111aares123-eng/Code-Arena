/**
 * CodeArena 2.0 — Worker Orchestrator Service (apps/api/src/services/worker-orchestrator.ts)
 *
 * Coordinates between the Hono/tRPC API and the self-hosted worker evaluator.
 * Implements authorization, test-case slice selection, execution dispatch,
 * safe response transformation, and submission persistence.
 */

import { TRPCError } from '@trpc/server';
import {
  type RunCodeInput,
  type SubmitCodeInput,
  type RunCodeResponse,
  type SubmitCodeResponse,
  type TestCaseEvaluation,
  type ExecutionTestCase,
  type HiddenCaseOutcome,
  type SubmissionVerdict,
} from '@code-arena/shared';
import {
  evaluateSubmission,
  type EvaluatorTestCase,
} from 'worker';
import type { ApiContext } from '../context';
import { dbTestCaseStore } from './test-case-store';
import { dbSubmissionStore } from './submission-store';
import { dbProgressStore } from './progress-store';
import { publishPracticeSamplePassed } from './activity-feed';

export type ExecutionEngineType = 'worker' | 'judge0';

/**
 * Resolves which execution engine to use based on per-request context override
 * or the EXECUTION_ENGINE environment variable. Defaults to 'judge0' for backward compatibility.
 */
export function resolveExecutionEngine(ctx?: ApiContext): ExecutionEngineType {
  if (ctx?.executionEngine === 'worker' || ctx?.executionEngine === 'judge0') {
    return ctx.executionEngine;
  }
  const env = (process.env.EXECUTION_ENGINE || '').toLowerCase().trim();
  if (env === 'worker' || env === 'self-hosted') {
    return 'worker';
  }
  return 'judge0';
}

/**
 * Executes code in Run mode using the self-hosted worker evaluator.
 *
 * Case A (selected testCaseId): verifies the test case belongs to the problem and is visible.
 * Case B (no testCaseId): executes all visible sample test cases for the problem.
 */
export async function executeRunWorker(
  ctx: ApiContext,
  input: RunCodeInput,
  problem: any,
  fromDatabase: boolean
): Promise<RunCodeResponse> {
  // 1. Require authenticated user
  const user = ctx?.user;
  if (!user?.id) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required for code execution.',
    });
  }

  // 2. Load problem test cases from database store or problem.examples
  const store = ctx?.testCaseStore ?? dbTestCaseStore;
  let allProblemCases: ExecutionTestCase[] = [];
  if (fromDatabase || ctx?.testCaseStore) {
    try {
      allProblemCases = await store.listForEvaluation(problem.id);
    } catch {
      // In case test_cases table is not yet migrated
    }
  }

  // Fallback to problem.examples if test_cases store has no records
  if (allProblemCases.length === 0 && problem.examples && problem.examples.length > 0) {
    allProblemCases = problem.examples.map((ex: any, idx: number) => ({
      id: ex.id ? String(ex.id) : `sample-${idx + 1}`,
      orderIndex: idx,
      isVisible: true,
      input: ex.input,
      expectedOutput: ex.output,
      structuredInput: ex.structuredInput,
    }));
  }

  // 3. Selection Logic
  let targetCases: ExecutionTestCase[];

  if (input.testCaseId) {
    // Case A: Specific sample test-case ID requested
    const foundCase = allProblemCases.find((c) => c.id === input.testCaseId);
    if (!foundCase) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Test case "${input.testCaseId}" not found for problem "${input.problemSlug}".`,
      });
    }

    if (!foundCase.isVisible) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Cannot execute a hidden test case in Run mode.',
      });
    }

    targetCases = [foundCase];
  } else {
    // Case B: No sample selected -> all visible samples
    targetCases = allProblemCases.filter((c) => c.isVisible);
    if (targetCases.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `No visible sample test cases found for problem "${input.problemSlug}".`,
      });
    }
  }

  // 4. Map to worker EvaluatorTestCase[]
  const evaluatorCases: EvaluatorTestCase[] = targetCases.map((c) => ({
    id: c.id,
    input: c.input,
    expectedOutput: c.expectedOutput,
    isHidden: false, // In Run mode, all executed sample cases are visible
  }));

  const timeLimitMs = process.env.WORKER_TIMEOUT_MS
    ? parseInt(process.env.WORKER_TIMEOUT_MS, 10)
    : 8000;

  // 5. Invoke worker evaluator
  const evalResult = await evaluateSubmission({
    language: input.language,
    code: input.sourceCode,
    testCases: evaluatorCases,
    timeLimitMs,
  });

  // 6. Format RunCodeResponse
  const executedAt = new Date().toISOString();
  const firstCaseResult = evalResult.testCaseResults[0];

  const testCaseEvaluation: TestCaseEvaluation | undefined = firstCaseResult
    ? {
        caseIndex: 0,
        input: firstCaseResult.input ?? targetCases[0]?.input ?? '',
        expectedOutput: firstCaseResult.expectedOutput ?? targetCases[0]?.expectedOutput ?? '',
        actualOutput: firstCaseResult.actualOutput ?? null,
        isMatched: firstCaseResult.passed,
        status: {
          id: firstCaseResult.passed ? 3 : 4,
          description: firstCaseResult.verdict,
        },
        executionTime: (firstCaseResult.durationMs / 1000).toFixed(3),
        stderr: firstCaseResult.stderr ?? null,
        compileOutput: evalResult.compileError ?? null,
        error: firstCaseResult.error,
      }
    : undefined;

  return {
    success: evalResult.verdict === 'Accepted',
    judge0Available: true,
    language: input.language,
    result: {
      stdout: firstCaseResult?.actualOutput ?? null,
      stderr: firstCaseResult?.stderr ?? null,
      compileOutput: evalResult.compileError ?? null,
      message: null,
      exitCode: firstCaseResult?.passed ? 0 : 1,
      exitSignal: null,
      time: firstCaseResult ? (firstCaseResult.durationMs / 1000).toFixed(3) : null,
      memory: null,
      status: {
        id: evalResult.verdict === 'Accepted' ? 3 : 4,
        description: evalResult.verdict,
      },
      isError: evalResult.verdict !== 'Accepted',
      errorType:
        evalResult.verdict === 'Compilation Error'
          ? 'compile_error'
          : evalResult.verdict === 'Runtime Error'
            ? 'runtime_error'
            : evalResult.verdict === 'Time Limit Exceeded'
              ? 'time_limit'
              : evalResult.verdict === 'Wrong Answer'
                ? 'wrong_answer'
                : undefined,
    },
    testCaseEvaluation,
    executedAt,
  };
}

/**
 * Executes code in Submit mode against the complete server-authorized test suite.
 * Evaluates all visible and hidden test cases, redacts hidden test data,
 * and persists the submission and progress.
 */
export async function executeSubmitWorker(
  ctx: ApiContext,
  input: SubmitCodeInput,
  problem: any,
  fromDatabase: boolean
): Promise<SubmitCodeResponse> {
  // 1. Require authenticated user
  const user = ctx?.user;
  if (!user?.id) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required for code submission.',
    });
  }

  const submittedAt = new Date().toISOString();

  // 2. Retrieve complete server-owned test suite
  const store = ctx?.testCaseStore ?? dbTestCaseStore;
  let judgeCases: ExecutionTestCase[] = [];
  if (fromDatabase || ctx?.testCaseStore) {
    try {
      judgeCases = await store.listForEvaluation(problem.id);
    } catch (err) {
      console.warn(`[Execution] Failed to load judge test cases for problem "${problem.slug}":`, err);
    }
  }

  // Construct authorizedSuite
  let authorizedSuite: EvaluatorTestCase[];
  let hasHiddenCases = false;

  if (judgeCases.length > 0) {
    hasHiddenCases = judgeCases.some((c) => !c.isVisible);
    authorizedSuite = judgeCases.map((c) => ({
      id: c.id,
      input: c.input,
      expectedOutput: c.expectedOutput,
      isHidden: !c.isVisible,
    }));
  } else {
    // Legacy sample-only fallback
    const examples = problem.examples && problem.examples.length > 0 ? problem.examples : [];
    authorizedSuite = examples.map((ex: any, idx: number) => ({
      id: ex.id ? String(ex.id) : `sample-${idx + 1}`,
      input: ex.input,
      expectedOutput: ex.output,
      isHidden: false,
    }));
  }

  const timeLimitMs = process.env.WORKER_TIMEOUT_MS
    ? parseInt(process.env.WORKER_TIMEOUT_MS, 10)
    : 8000;

  // 3. Invoke worker evaluator
  const evalResult = await evaluateSubmission({
    language: input.language,
    code: input.sourceCode,
    testCases: authorizedSuite,
    timeLimitMs,
  });

  // 4. Map verdict to SubmissionVerdict
  let verdict: SubmissionVerdict;
  if (evalResult.verdict === 'Compilation Error') {
    verdict = 'COMPILE_ERROR';
  } else if (evalResult.verdict === 'Time Limit Exceeded') {
    verdict = 'TIME_LIMIT_EXCEEDED';
  } else if (evalResult.verdict === 'Runtime Error') {
    verdict = 'RUNTIME_ERROR';
  } else if (evalResult.verdict === 'Wrong Answer') {
    verdict = hasHiddenCases ? 'WRONG_ANSWER' : 'SAMPLE_FAILED';
  } else {
    // Accepted
    verdict = hasHiddenCases ? 'ACCEPTED' : 'SAMPLE_PASSED';
  }

  // 5. Build visible evaluations (strictly visible only)
  const visibleCases = authorizedSuite.filter((c) => !c.isHidden);
  const evaluations: TestCaseEvaluation[] = [];

  for (let i = 0; i < evalResult.testCaseResults.length; i++) {
    const res = evalResult.testCaseResults[i];
    if (!res.isHidden) {
      evaluations.push({
        caseIndex: i,
        input: res.input ?? '',
        expectedOutput: res.expectedOutput ?? '',
        actualOutput: res.actualOutput ?? null,
        isMatched: res.passed,
        status: {
          id: res.passed ? 3 : 4,
          description: res.verdict,
        },
        executionTime: (res.durationMs / 1000).toFixed(3),
        stderr: res.stderr ?? null,
        compileOutput: evalResult.compileError ?? null,
      });
    }
  }

  // 6. Build hidden cases summary (without any input or expected output)
  const hiddenResults = evalResult.testCaseResults.filter((r) => r.isHidden);
  const hiddenCases = hiddenResults.length > 0
    ? {
        total: hiddenResults.length,
        passed: hiddenResults.filter((r) => r.passed).length,
        results: hiddenResults.map((r) => ({
          caseNumber: r.index,
          outcome: (r.passed
            ? 'PASSED'
            : r.verdict === 'Time Limit Exceeded'
              ? 'TIME_LIMIT_EXCEEDED'
              : r.verdict === 'Runtime Error'
                ? 'RUNTIME_ERROR'
                : r.verdict === 'Compilation Error'
                  ? 'COMPILE_ERROR'
                  : 'WRONG_ANSWER') as HiddenCaseOutcome,
          executionTime: (r.durationMs / 1000).toFixed(3),
        })),
      }
    : undefined;

  // 7. Activity stream event
  if (verdict === 'SAMPLE_PASSED' || verdict === 'ACCEPTED') {
    publishPracticeSamplePassed({ slug: problem.slug, title: problem.title });
  }

  // 8. Persistence
  let submissionId: string | null = null;
  let persisted = false;

  try {
    const subStore = ctx?.submissionStore ?? dbSubmissionStore;
    const saved = await subStore.create({
      userId: user.id,
      problemId: problem.id,
      language: input.language,
      code: input.sourceCode,
      verdict,
      passedCases: evalResult.passedCases,
      totalCases: evalResult.totalCases,
      executionTime: (evalResult.totalDurationMs / 1000).toFixed(3),
      memory: null,
      error: evalResult.compileError ?? null,
      evaluations,
    });

    submissionId = saved.id;
    persisted = true;

    const progStore = ctx?.progressStore ?? dbProgressStore;
    await progStore.recordProgress({
      userId: user.id,
      problemId: problem.id,
      verdict,
      submissionId: saved.id,
      difficulty: problem.difficulty,
    });
  } catch (dbErr) {
    console.warn(
      `[Execution] Failed to persist submission or progress for problem "${problem.slug}":`,
      dbErr instanceof Error ? dbErr.name : 'DatabaseError'
    );
  }

  const summary = verdict === 'ACCEPTED'
    ? `All ${evalResult.totalCases} test cases passed!`
    : verdict === 'SAMPLE_PASSED'
      ? `All ${evalResult.totalCases} sample test cases passed!`
      : `${evalResult.passedCases}/${evalResult.totalCases} test cases passed.`;

  return {
    success: verdict === 'ACCEPTED' || verdict === 'SAMPLE_PASSED',
    judge0Available: true,
    language: input.language,
    verdict,
    totalCases: evalResult.totalCases,
    passedCases: evalResult.passedCases,
    evaluations,
    hiddenCases,
    summary,
    executionTime: (evalResult.totalDurationMs / 1000).toFixed(3),
    submittedAt,
    submissionId,
    persisted,
    disclaimer: hasHiddenCases
      ? `Evaluated against ${visibleCases.length} visible and ${hiddenResults.length} hidden test cases. Hidden test inputs and expected outputs are never disclosed.`
      : 'Evaluated against available sample test cases only. Passing sample test cases does not guarantee acceptance on hidden judge tests.',
  };
}
