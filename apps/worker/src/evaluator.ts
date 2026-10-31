/**
 * CodeArena 2.0 — Minimal Test-Case Evaluator (apps/worker/src/evaluator.ts)
 */

import { executePython, executeCpp } from './runner.ts';
import type {
  EvaluateRequest,
  EvaluationResult,
  TestCaseResult,
  TestCaseVerdict,
} from './types.ts';

/**
 * Normalizes program output and expected output for fair comparison:
 * 1. Converts Windows CRLF (\r\n) and legacy Mac (\r) line breaks into standard Unix newlines (\n).
 * 2. Trims trailing whitespace from the end of each line (ignores trailing spaces/tabs).
 * 3. Trims trailing whitespace and newlines from the end of the entire output (ignores trailing \n).
 *
 * Note: Internal whitespace between tokens and leading line indentation are preserved to prevent
 * silently ignoring incorrect answers or token formatting mismatches.
 */
export function normalizeOutput(output: string | null | undefined): string {
  if (output === null || output === undefined) return '';
  return output
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();
}

/**
 * Compares actual program stdout against expected test-case output using normalized comparison.
 * Returns true if both outputs match after normalization.
 */
export function compareOutputs(
  actual: string | null | undefined,
  expected: string | null | undefined
): boolean {
  return normalizeOutput(actual) === normalizeOutput(expected);
}

/**
 * Evaluates a submitted program (Python or C++) against an explicit list of test cases
 * authorized and supplied by the caller.
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * - Caller-Agnostic: The evaluator has no concept of "Run" vs "Submit" and never attempts
 *   to determine problem context, user role, or submission intent.
 * - Zero Auto-Fetching: The evaluator does not fetch test cases from a database or filesystem.
 *   The calling orchestration layer (e.g., API router or queue consumer) owns test-case retrieval.
 * - Explicit Case Selection: The caller determines which slice of test cases to evaluate:
 *     1. A single selected visible sample test case.
 *     2. All visible sample test cases.
 *     3. The complete server-authorized test suite (samples + hidden tests).
 * - Hidden Test Privacy: Each test case explicitly specifies `isHidden`. For any hidden case,
 *   inputs, expected outputs, actual stdout, stderr, and raw errors are never returned or logged.
 */
export async function evaluateSubmission(
  request: EvaluateRequest
): Promise<EvaluationResult> {
  const {
    language,
    code,
    testCases,
    timeLimitMs,
    memoryLimitMb,
    outputLimitBytes,
    config,
  } = request;

  // Handle empty test-case list
  if (!testCases || testCases.length === 0) {
    // If C++, verify code compiles even with zero test cases
    if (language === 'cpp') {
      const compileCheck = await executeCpp(
        {
          code,
          stdin: '',
          timeLimitMs,
          memoryLimitMb,
          outputLimitBytes,
        },
        config
      );

      if (compileCheck.compileFailed) {
        return {
          verdict: 'Compilation Error',
          totalCases: 0,
          passedCases: 0,
          failedCases: 0,
          totalDurationMs: compileCheck.durationMs,
          testCaseResults: [],
          compileError: compileCheck.compileError,
        };
      }
    }

    return {
      verdict: 'Accepted',
      totalCases: 0,
      passedCases: 0,
      failedCases: 0,
      totalDurationMs: 0,
      testCaseResults: [],
    };
  }

  const testCaseResults: TestCaseResult[] = [];
  let totalDurationMs = 0;
  let passedCases = 0;
  let failedCases = 0;
  let compileError: string | undefined;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const isHidden = Boolean(testCase.isHidden);
    const index = i + 1; // 1-based index

    // Execute through the unprivileged sandbox runner
    const execRequest = {
      code,
      stdin: testCase.input,
      timeLimitMs,
      memoryLimitMb,
      outputLimitBytes,
    };

    const execResult =
      language === 'cpp'
        ? await executeCpp(execRequest, config)
        : await executePython(execRequest, config);

    totalDurationMs += execResult.durationMs;

    // Check compilation failure (C++)
    if (execResult.compileFailed) {
      compileError = execResult.compileError;
      const verdict: TestCaseVerdict = 'Compilation Error';

      // Record result for the failing case
      if (isHidden) {
        testCaseResults.push({
          index,
          id: testCase.id,
          isHidden: true,
          passed: false,
          verdict,
          durationMs: execResult.durationMs,
        });
      } else {
        testCaseResults.push({
          index,
          id: testCase.id,
          isHidden: false,
          passed: false,
          verdict,
          durationMs: execResult.durationMs,
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          error: execResult.compileError,
        });
      }
      failedCases++;

      // Remaining test cases cannot run due to compilation error
      for (let j = i + 1; j < testCases.length; j++) {
        const remainingCase = testCases[j];
        const remHidden = Boolean(remainingCase.isHidden);
        if (remHidden) {
          testCaseResults.push({
            index: j + 1,
            id: remainingCase.id,
            isHidden: true,
            passed: false,
            verdict: 'Compilation Error',
            durationMs: 0,
          });
        } else {
          testCaseResults.push({
            index: j + 1,
            id: remainingCase.id,
            isHidden: false,
            passed: false,
            verdict: 'Compilation Error',
            durationMs: 0,
            input: remainingCase.input,
            expectedOutput: remainingCase.expectedOutput,
            error: execResult.compileError,
          });
        }
        failedCases++;
      }

      break;
    }

    // Determine individual test-case verdict
    let verdict: TestCaseVerdict;
    let passed = false;

    if (execResult.timedOut) {
      verdict = 'Time Limit Exceeded';
    } else if (execResult.exitCode !== 0) {
      verdict = 'Runtime Error';
    } else if (compareOutputs(execResult.stdout, testCase.expectedOutput)) {
      verdict = 'Accepted';
      passed = true;
    } else {
      verdict = 'Wrong Answer';
    }

    if (passed) {
      passedCases++;
    } else {
      failedCases++;
    }

    // Securely construct test-case result:
    // Hidden test cases NEVER disclose input, expectedOutput, actualOutput, stderr, or error.
    if (isHidden) {
      testCaseResults.push({
        index,
        id: testCase.id,
        isHidden: true,
        passed,
        verdict,
        durationMs: execResult.durationMs,
      });
    } else {
      testCaseResults.push({
        index,
        id: testCase.id,
        isHidden: false,
        passed,
        verdict,
        durationMs: execResult.durationMs,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: execResult.stdout,
        stderr: execResult.stderr || undefined,
        error: execResult.error || undefined,
      });
    }
  }

  // Determine overall verdict:
  // 1. If compilation failed, the overall verdict is Compilation Error.
  // 2. Otherwise, the first failing test case determines the overall verdict.
  // 3. If all test cases passed, the overall verdict is Accepted.
  let overallVerdict: TestCaseVerdict = 'Accepted';
  if (compileError) {
    overallVerdict = 'Compilation Error';
  } else {
    const firstFailure = testCaseResults.find((r) => !r.passed);
    if (firstFailure) {
      overallVerdict = firstFailure.verdict;
    }
  }

  return {
    verdict: overallVerdict,
    totalCases: testCases.length,
    passedCases,
    failedCases,
    totalDurationMs,
    testCaseResults,
    compileError,
  };
}
