/**
 * CodeArena 2.0 — Minimal Python Worker Types
 */

export interface ExecutionRequest {
  /** Source code to execute. */
  code: string;
  /** Optional standard input to feed to the program. */
  stdin?: string;
  /** Wall-clock time limit in milliseconds. Default: 3000ms. */
  timeLimitMs?: number;
  /** Memory limit in megabytes (enforced via RLIMIT_AS). Default: 256MB. */
  memoryLimitMb?: number;
  /** Maximum bytes to capture for stdout / stderr before truncating. Default: 65536 (64 KiB). */
  outputLimitBytes?: number;
}

export interface ExecutionResult {
  /** Captured standard output (bounded by outputLimitBytes). */
  stdout: string;
  /** Captured standard error (bounded by outputLimitBytes). */
  stderr: string;
  /** Process exit code, or null if killed by signal. */
  exitCode: number | null;
  /** Signal that terminated the process, or null. */
  exitSignal: string | null;
  /** Wall-clock duration of the execution in milliseconds. */
  durationMs: number;
  /** Whether execution exceeded the time limit and was terminated. */
  timedOut: boolean;
  /** Whether stdout or stderr exceeded the capture buffer limit and was truncated. */
  outputTruncated: boolean;
  /** Internal runner error message, if execution failed before or during sandboxing. */
  error?: string;
  /** Compilation error message if compilation failed (C++). */
  compileError?: string;
  /** Whether compilation failed (C++). */
  compileFailed?: boolean;
  /** Wall-clock duration of the compilation in milliseconds (C++). */
  compileDurationMs?: number;
}

export interface SandboxConfig {
  /** Path to nsjail binary inside the Linux environment. Default: /home/joshee/nsjail/nsjail */
  nsjailPath?: string;
  /** Path to python3 binary inside the sandbox. Default: /usr/bin/python3 */
  pythonPath?: string;
  /** Path to g++ binary inside the sandbox. Default: /usr/bin/g++ */
  cppCompilerPath?: string;
  /** Compilation wall-clock time limit in milliseconds for compiled languages. Default: 10000ms */
  compileTimeLimitMs?: number;
  /** Compilation memory limit in megabytes (enforced via RLIMIT_AS). Default: 1024MB */
  compileMemoryLimitMb?: number;
  /** WSL distribution name when running under Windows host. Default: Ubuntu-24.04 */
  wslDistro?: string;
  /** WSL user to execute as when running under Windows host. Default: joshee */
  wslUser?: string;
  /** Base scratch directory for temporary workspaces. */
  scratchDir?: string;
}

export type SupportedLanguage = 'python' | 'cpp';

export type TestCaseVerdict =
  | 'Accepted'
  | 'Wrong Answer'
  | 'Compilation Error'
  | 'Runtime Error'
  | 'Time Limit Exceeded';

export interface EvaluatorTestCase {
  /** Optional identifier for the test case (e.g. database ID or slug). */
  id?: string | number;
  /** Standard input to feed to the program. */
  input: string;
  /** Expected standard output. */
  expectedOutput: string;
  /** Whether this is a hidden test case whose details must remain secret. */
  isHidden?: boolean;
}

export interface EvaluateRequest {
  /** Programming language to evaluate. */
  language: SupportedLanguage;
  /** Source code to evaluate. */
  code: string;
  /** List of test cases to run against. */
  testCases: EvaluatorTestCase[];
  /** Optional per-test-case time limit in milliseconds. Default: 3000ms. */
  timeLimitMs?: number;
  /** Optional per-test-case memory limit in megabytes. Default: 256MB. */
  memoryLimitMb?: number;
  /** Optional per-test-case stdout/stderr capture limit. Default: 65536 bytes. */
  outputLimitBytes?: number;
  /** Optional sandbox configuration overrides. */
  config?: SandboxConfig;
}

export interface TestCaseResult {
  /** 1-based index of the test case in the testCases array. */
  index: number;
  /** Optional identifier passed in the test case. */
  id?: string | number;
  /** Whether this was evaluated as a hidden test case. */
  isHidden: boolean;
  /** Whether the test case passed. */
  passed: boolean;
  /** Outcome verdict for this specific test case. */
  verdict: TestCaseVerdict;
  /** Wall-clock execution time in milliseconds. */
  durationMs: number;
  /** Standard input (omitted for hidden cases). */
  input?: string;
  /** Expected output (omitted for hidden cases). */
  expectedOutput?: string;
  /** Actual stdout output (omitted for hidden cases). */
  actualOutput?: string;
  /** Stderr output if any (omitted for hidden cases). */
  stderr?: string;
  /** Error message if any (omitted for hidden cases). */
  error?: string;
}

export interface EvaluationResult {
  /** Overall verdict for the submission. */
  verdict: TestCaseVerdict;
  /** Total number of test cases evaluated. */
  totalCases: number;
  /** Number of test cases that passed. */
  passedCases: number;
  /** Number of test cases that failed. */
  failedCases: number;
  /** Sum of execution durations across all evaluated cases in milliseconds. */
  totalDurationMs: number;
  /** Individual results for each test case. */
  testCaseResults: TestCaseResult[];
  /** Compilation error details if compilation failed (C++). */
  compileError?: string;
}

