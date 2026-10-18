export type ExecutionLanguage = 'python' | 'cpp';

export interface Judge0Status {
  id: number;
  description: string;
}

export interface ExecutionResult {
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  message: string | null;
  exitCode: number | null;
  exitSignal: number | null;
  time: string | null;       // in seconds (e.g. "0.012")
  memory: number | null;     // in KB
  status: Judge0Status;
  token?: string;
  isError: boolean;
  errorType?:
    | 'compile_error'
    | 'runtime_error'
    | 'time_limit'
    | 'memory_limit'
    | 'wrong_answer'
    | 'service_unavailable'
    | 'unknown';
}

export interface TestCaseEvaluation {
  caseIndex: number;
  input: string;
  expectedOutput: string;
  actualOutput: string | null;
  isMatched: boolean;
  status: Judge0Status;
  executionTime?: string | null;
  memory?: number | null;
  stderr?: string | null;
  compileOutput?: string | null;
  error?: string;
}

export interface RunCodeResponse {
  success: boolean;
  judge0Available: boolean;
  language: ExecutionLanguage;
  result?: ExecutionResult;
  testCaseEvaluation?: TestCaseEvaluation;
  error?: string;
  executedAt: string;
}

/**
 * Verdicts:
 * - SAMPLE_PASSED / SAMPLE_FAILED: legacy sample-only mode, used when a problem has no
 *   judge test cases configured. Never implies acceptance.
 * - ACCEPTED: every required case (all visible samples AND all judge cases, including hidden) passed.
 * - WRONG_ANSWER: full-evaluation mode and at least one required case produced the wrong output.
 */
export type SubmissionVerdict =
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'SAMPLE_PASSED'
  | 'SAMPLE_FAILED'
  | 'COMPILE_ERROR'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT_EXCEEDED'
  | 'SERVICE_UNAVAILABLE';

/** SAMPLES_ONLY = no judge cases configured; FULL = samples + configured judge cases. */
export type EvaluationMode = 'SAMPLES_ONLY' | 'FULL';

export type HiddenCaseOutcome =
  | 'PASSED'
  | 'WRONG_ANSWER'
  | 'COMPILE_ERROR'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT_EXCEEDED'
  | 'SERVICE_UNAVAILABLE'
  | 'NOT_RUN';

/**
 * Redacted, student-facing result for a hidden case. Deliberately carries NO input,
 * expected output, actual output, stderr, compiler output, or Judge0 message, because
 * any of those can contain (or echo) hidden test data.
 */
export interface HiddenCaseResult {
  /** 1-based position among hidden cases. */
  caseNumber: number;
  outcome: HiddenCaseOutcome;
  executionTime?: string | null;
  memory?: number | null;
}

export interface HiddenCasesSummary {
  total: number;
  passed: number;
  results: HiddenCaseResult[];
}

export interface SubmitCodeResponse {
  success: boolean;
  judge0Available: boolean;
  language: ExecutionLanguage;
  verdict: SubmissionVerdict;
  /** All required cases (visible + hidden). */
  totalCases: number;
  /** Required cases that passed (visible + hidden). */
  passedCases: number;
  /** Visible cases only. Hidden cases are never included here. */
  evaluations: TestCaseEvaluation[];
  evaluationMode?: EvaluationMode;
  hiddenCases?: HiddenCasesSummary;
  summary: string;
  executionTime?: string | null;
  memory?: number | null;
  error?: string;
  disclaimer: string;
  submittedAt: string;
}
