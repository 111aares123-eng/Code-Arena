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

export type SubmissionVerdict =
  | 'SAMPLE_PASSED'
  | 'SAMPLE_FAILED'
  | 'COMPILE_ERROR'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT_EXCEEDED'
  | 'SERVICE_UNAVAILABLE';

export interface SubmitCodeResponse {
  success: boolean;
  judge0Available: boolean;
  language: ExecutionLanguage;
  verdict: SubmissionVerdict;
  totalCases: number;
  passedCases: number;
  evaluations: TestCaseEvaluation[];
  summary: string;
  executionTime?: string | null;
  memory?: number | null;
  error?: string;
  disclaimer: string;
  submittedAt: string;
}
