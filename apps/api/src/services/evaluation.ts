import type {
  EvaluationMode,
  ExecutionLanguage,
  ExecutionResult,
  ExecutionTestCase,
  HiddenCaseOutcome,
  HiddenCaseResult,
  ProblemExample,
  SubmissionVerdict,
  SubmitCodeResponse,
  TestCaseEvaluation,
} from '@code-arena/shared';
import { buildExecutionHarness } from './harness';
import { compareOutputs, executeWithJudge0 } from './judge0';

/**
 * Server-side submission evaluation against visible samples and judge (hidden) cases.
 *
 * SECURITY INVARIANTS
 * 1. Hidden case data (input, structured input, expected output) never leaves this module in
 *    any student-facing field. Hidden results are reduced to {@link HiddenCaseResult}.
 * 2. Anything Judge0 returns for a hidden case (stdout, stderr, compile output, message, raw
 *    error text) is discarded: the harness embeds the hidden input into the generated source,
 *    so compiler errors and tracebacks can quote it, and student code can echo it.
 * 3. ACCEPTED is produced only when judge cases were supplied AND every visible and hidden
 *    case ran and passed. Sample-only evaluation can at most yield SAMPLE_PASSED.
 * 4. This module performs no logging.
 */

export type ExecuteFn = typeof executeWithJudge0;

/** Kept byte-identical to the pre-Phase-3 message so existing clients/tests are unaffected. */
export const SAMPLE_ONLY_DISCLAIMER =
  'Evaluated against available sample test cases only. Passing sample test cases does not guarantee acceptance on hidden judge tests.';

export function fullEvaluationDisclaimer(visibleCount: number, hiddenCount: number): string {
  return `Evaluated against ${visibleCount} visible and ${hiddenCount} hidden test case${
    hiddenCount === 1 ? '' : 's'
  }. Hidden test inputs and expected outputs are never disclosed.`;
}

export const HIDDEN_SERVICE_FAILURE_MESSAGE =
  'The execution service failed while running a hidden test case. Your submission was not scored; please try again.';

export interface EvaluateSubmissionParams {
  problem: { slug: string; examples: ProblemExample[] };
  /** Judge cases from the test_cases table. Empty array = legacy sample-only mode. */
  judgeCases: ExecutionTestCase[];
  language: ExecutionLanguage;
  sourceCode: string;
  /** Injectable for tests; defaults to the real Judge0 client. */
  execute?: ExecuteFn;
}

export type EvaluationOutcome = Omit<SubmitCodeResponse, 'language' | 'submittedAt'>;

interface VisibleCase {
  input: string;
  structuredInput?: Record<string, unknown>;
  expectedOutput: string;
}

interface HiddenCase {
  input: string;
  structuredInput?: Record<string, unknown>;
  expectedOutput: string;
}

type CriticalVerdict = Extract<SubmissionVerdict, 'COMPILE_ERROR' | 'RUNTIME_ERROR' | 'TIME_LIMIT_EXCEEDED'>;

function criticalVerdictFor(result: ExecutionResult): CriticalVerdict | null {
  switch (result.errorType) {
    case 'compile_error':
      return 'COMPILE_ERROR';
    case 'runtime_error':
      return 'RUNTIME_ERROR';
    case 'time_limit':
      return 'TIME_LIMIT_EXCEEDED';
    default:
      return null;
  }
}

/** A case passes only when Judge0 reported no error AND the normalized output matches. */
function casePassed(result: ExecutionResult, expectedOutput: string): boolean {
  return !result.isError && compareOutputs(result.stdout, expectedOutput);
}

async function runCase(
  execute: ExecuteFn,
  slug: string,
  language: ExecutionLanguage,
  sourceCode: string,
  testCase: { input: string; structuredInput?: Record<string, unknown> }
) {
  const harness = buildExecutionHarness({
    problemSlug: slug,
    language,
    sourceCode,
    structuredInput: testCase.structuredInput,
    rawInput: testCase.input,
  });

  return execute({
    sourceCode: harness.code,
    language,
    stdin: harness.wasHarnessed ? '' : testCase.input,
  });
}

export async function evaluateSubmission(params: EvaluateSubmissionParams): Promise<EvaluationOutcome> {
  const execute = params.execute ?? executeWithJudge0;
  const { problem, language, sourceCode } = params;

  const mode: EvaluationMode = params.judgeCases.length > 0 ? 'FULL' : 'SAMPLES_ONLY';

  const visibleCases: VisibleCase[] = [
    ...(problem.examples ?? []).map((ex) => ({
      input: ex.input,
      structuredInput: ex.structuredInput,
      expectedOutput: ex.output,
    })),
    ...params.judgeCases
      .filter((c) => c.isVisible)
      .map((c) => ({ input: c.input, structuredInput: c.structuredInput, expectedOutput: c.expectedOutput })),
  ];
  const hiddenCases: HiddenCase[] = params.judgeCases
    .filter((c) => !c.isVisible)
    .map((c) => ({ input: c.input, structuredInput: c.structuredInput, expectedOutput: c.expectedOutput }));

  const totalCases = visibleCases.length + hiddenCases.length;
  const disclaimer =
    mode === 'FULL' ? fullEvaluationDisclaimer(visibleCases.length, hiddenCases.length) : SAMPLE_ONLY_DISCLAIMER;

  if (totalCases === 0) {
    return {
      success: false,
      judge0Available: true,
      verdict: 'SAMPLE_FAILED',
      totalCases: 0,
      passedCases: 0,
      evaluations: [],
      evaluationMode: mode,
      summary: 'No sample test cases exist for this problem.',
      error: 'No test cases available to evaluate.',
      disclaimer,
    };
  }

  const evaluations: TestCaseEvaluation[] = [];
  const hiddenResults: HiddenCaseResult[] = hiddenCases.map((_, i) => ({ caseNumber: i + 1, outcome: 'NOT_RUN' }));
  let passedVisible = 0;
  let passedHidden = 0;
  let totalTime = 0;
  let maxMemory = 0;

  const hiddenSummary = () =>
    mode === 'FULL' ? { hiddenCases: { total: hiddenCases.length, passed: passedHidden, results: hiddenResults } } : {};

  const track = (res: ExecutionResult) => {
    if (res.time) totalTime += parseFloat(res.time) || 0;
    if (res.memory && res.memory > maxMemory) maxMemory = res.memory;
  };

  const finish = (verdict: SubmissionVerdict, summary: string, extra: Partial<EvaluationOutcome> = {}): EvaluationOutcome => ({
    success: verdict === 'ACCEPTED' || verdict === 'SAMPLE_PASSED',
    judge0Available: true,
    verdict,
    totalCases,
    passedCases: passedVisible + passedHidden,
    evaluations,
    evaluationMode: mode,
    ...hiddenSummary(),
    summary,
    executionTime: `${totalTime.toFixed(3)}s`,
    memory: maxMemory,
    disclaimer,
    ...extra,
  });

  // ---- Phase A: visible cases (full diagnostic detail is safe to return) ----
  let criticalVerdict: CriticalVerdict | null = null;
  let firstFailedVisible: number | null = null;

  for (let i = 0; i < visibleCases.length; i++) {
    const testCase = visibleCases[i];
    const execution = await runCase(execute, problem.slug, language, sourceCode, testCase);

    if (!execution.success) {
      return {
        ...finish('SERVICE_UNAVAILABLE', `Execution aborted: ${execution.error}`),
        success: false,
        judge0Available: execution.judge0Available,
        error: execution.error,
      };
    }

    const res = execution.result;
    track(res);
    const critical = criticalVerdictFor(res);

    if (critical === 'COMPILE_ERROR') {
      evaluations.push({
        caseIndex: i,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: null,
        isMatched: false,
        status: res.status,
        compileOutput: res.compileOutput,
        stderr: res.stderr,
      });
      criticalVerdict = critical;
      break;
    }

    if (critical === 'TIME_LIMIT_EXCEEDED') {
      evaluations.push({
        caseIndex: i,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: res.stdout,
        isMatched: false,
        status: res.status,
        executionTime: res.time,
        memory: res.memory,
        error: 'Time Limit Exceeded',
      });
      criticalVerdict = critical;
      break;
    }

    if (critical === 'RUNTIME_ERROR') {
      evaluations.push({
        caseIndex: i,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: res.stdout,
        isMatched: false,
        status: res.status,
        executionTime: res.time,
        memory: res.memory,
        stderr: res.stderr,
      });
      criticalVerdict = critical;
      break;
    }

    // Accepted run, explicit Judge0 Wrong Answer (status 4), or other non-fatal status.
    const matched = casePassed(res, testCase.expectedOutput);
    if (matched) passedVisible++;
    else if (firstFailedVisible === null) firstFailedVisible = i;

    evaluations.push({
      caseIndex: i,
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      actualOutput: res.stdout,
      isMatched: matched,
      status: res.status,
      executionTime: res.time,
      memory: res.memory,
      stderr: res.stderr,
    });
  }

  if (criticalVerdict) {
    return finish(criticalVerdict, `Submission failed: ${criticalVerdict.replace(/_/g, ' ')}`);
  }

  // ---- Legacy sample-only mode: never ACCEPTED ----
  if (mode === 'SAMPLES_ONLY') {
    return passedVisible === visibleCases.length
      ? finish('SAMPLE_PASSED', `All ${visibleCases.length} sample test cases passed!`)
      : finish('SAMPLE_FAILED', `${passedVisible}/${visibleCases.length} sample test cases passed.`);
  }

  // In full mode a failing visible case already decides the verdict; hidden cases are not run.
  if (firstFailedVisible !== null) {
    return finish(
      'WRONG_ANSWER',
      `Wrong answer on visible test case ${firstFailedVisible + 1}. ${passedVisible}/${totalCases} test cases passed.`
    );
  }

  // ---- Phase B: hidden cases (redacted results only; stop at first failure) ----
  for (let h = 0; h < hiddenCases.length; h++) {
    const execution = await runCase(execute, problem.slug, language, sourceCode, hiddenCases[h]);
    const caseNumber = h + 1;

    if (!execution.success) {
      hiddenResults[h] = { caseNumber, outcome: 'SERVICE_UNAVAILABLE' };
      // Raw Judge0 error text is deliberately NOT forwarded for hidden cases.
      return {
        ...finish('SERVICE_UNAVAILABLE', `Execution aborted while running hidden test case ${caseNumber}.`),
        success: false,
        judge0Available: execution.judge0Available,
        error: HIDDEN_SERVICE_FAILURE_MESSAGE,
      };
    }

    const res = execution.result;
    track(res);
    const timing = { executionTime: res.time, memory: res.memory };
    const critical = criticalVerdictFor(res);

    if (critical) {
      hiddenResults[h] = { caseNumber, outcome: critical as HiddenCaseOutcome, ...timing };
      return finish(critical, `Submission failed: ${critical.replace(/_/g, ' ')} on hidden test case ${caseNumber}.`);
    }

    if (res.isError && res.errorType !== 'wrong_answer') {
      // Judge0 internal / exec-format / unknown status: not the student's fault and not a pass.
      hiddenResults[h] = { caseNumber, outcome: 'SERVICE_UNAVAILABLE', ...timing };
      return {
        ...finish('SERVICE_UNAVAILABLE', `Execution aborted while running hidden test case ${caseNumber}.`),
        success: false,
        error: HIDDEN_SERVICE_FAILURE_MESSAGE,
      };
    }

    if (!casePassed(res, hiddenCases[h].expectedOutput)) {
      hiddenResults[h] = { caseNumber, outcome: 'WRONG_ANSWER', ...timing };
      return finish(
        'WRONG_ANSWER',
        `Wrong answer on hidden test case ${caseNumber}. ${passedVisible + passedHidden}/${totalCases} test cases passed.`
      );
    }

    passedHidden++;
    hiddenResults[h] = { caseNumber, outcome: 'PASSED', ...timing };
  }

  // Defensive: ACCEPTED strictly requires every required case to have passed.
  if (passedVisible + passedHidden !== totalCases) {
    return finish('WRONG_ANSWER', `${passedVisible + passedHidden}/${totalCases} test cases passed.`);
  }

  return finish(
    'ACCEPTED',
    `Accepted: all ${totalCases} test cases passed (${visibleCases.length} visible, ${hiddenCases.length} hidden).`
  );
}
