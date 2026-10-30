/**
 * CodeArena 2.0 — Minimal Python Worker Types
 */

export interface ExecutionRequest {
  /** Python source code to execute. */
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
}

export interface SandboxConfig {
  /** Path to nsjail binary inside the Linux environment. Default: /home/joshee/nsjail/nsjail */
  nsjailPath?: string;
  /** Path to python3 binary inside the sandbox. Default: /usr/bin/python3 */
  pythonPath?: string;
  /** WSL distribution name when running under Windows host. Default: Ubuntu-24.04 */
  wslDistro?: string;
  /** WSL user to execute as when running under Windows host. Default: joshee */
  wslUser?: string;
  /** Base scratch directory for temporary workspaces. */
  scratchDir?: string;
}
