import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import type { ExecutionRequest, ExecutionResult, SandboxConfig } from './types.ts';

const DEFAULT_TIME_LIMIT_MS = 3000;
const DEFAULT_MEMORY_LIMIT_MB = 256;
const DEFAULT_OUTPUT_LIMIT_BYTES = 64 * 1024; // 64 KiB
const DEFAULT_NSJAIL_PATH = '/home/joshee/nsjail/nsjail';
const DEFAULT_PYTHON_PATH = '/usr/bin/python3';
const DEFAULT_CPP_COMPILER_PATH = '/usr/bin/g++';
const DEFAULT_COMPILE_TIME_LIMIT_MS = 10000;
const DEFAULT_COMPILE_MEMORY_LIMIT_MB = 1024;
const DEFAULT_COMPILE_FSIZE_MB = 25;
const DEFAULT_WSL_DISTRO = 'Ubuntu-24.04';
const DEFAULT_WSL_USER = 'joshee';

/**
 * Converts a Windows path (e.g. D:\projects\...) to WSL path (/mnt/d/projects/...).
 * If already a POSIX path, returns normalized path.
 */
export function toWslPath(inputPath: string): string {
  const normalized = path.resolve(inputPath);
  if (normalized.length >= 2 && normalized.charAt(1) === ':') {
    const driveLetter = normalized.charAt(0).toLowerCase();
    const posixRest = normalized.slice(2).replace(/\\/g, '/');
    return `/mnt/${driveLetter}${posixRest}`;
  }
  return normalized.replace(/\\/g, '/');
}

/**
 * Creates an isolated temporary workspace directory on the host.
 */
function createWorkspace(scratchBase?: string): { dirPath: string; wslPath: string } {
  const uniqueId = `run_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const baseDir = scratchBase
    ? path.resolve(scratchBase)
    : process.platform === 'win32'
      ? path.resolve(process.cwd(), '.worker-tmp')
      : path.join(os.tmpdir(), 'codearena-worker');

  fs.mkdirSync(baseDir, { recursive: true });
  const dirPath = path.join(baseDir, uniqueId);
  fs.mkdirSync(dirPath, { recursive: true });

  const wslPath = toWslPath(dirPath);
  return { dirPath, wslPath };
}

/**
 * Cleans up temporary workspace directory and verifies removal.
 */
function cleanupWorkspace(dirPath: string): boolean {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
    return !fs.existsSync(dirPath);
  } catch {
    return false;
  }
}

/**
 * Resolves binary invocation depending on host platform.
 * Under Windows, proxies through WSL; under Linux, invokes nsjail directly.
 */
function resolveSpawnCommand(
  config: Required<SandboxConfig>,
  nsjailArgs: string[]
): { cmd: string; args: string[] } {
  if (process.platform === 'win32') {
    return {
      cmd: 'wsl',
      args: ['-d', config.wslDistro, '-u', config.wslUser, '-e', ...nsjailArgs],
    };
  }
  return {
    cmd: config.nsjailPath,
    args: nsjailArgs.slice(1),
  };
}

interface RunProcessOptions {
  cmd: string;
  args: string[];
  stdin?: string;
  timeLimitMs: number;
  outputLimitBytes: number;
}

interface RunProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  exitSignal: string | null;
  durationMs: number;
  timedOut: boolean;
  outputTruncated: boolean;
  error?: string;
}

/**
 * Core sandboxed process runner with supervisor watchdog, pipe capture, and bounded buffers.
 */
async function runProcess(options: RunProcessOptions): Promise<RunProcessResult> {
  const startTime = performance.now();
  let proc: ChildProcess | null = null;
  let watchdogTimer: NodeJS.Timeout | null = null;
  let timedOut = false;
  let outputTruncated = false;

  let stdoutBuffer = '';
  let stderrBuffer = '';
  let stdoutBytes = 0;
  let stderrBytes = 0;

  try {
    const stdinOption = options.stdin ? 'pipe' : 'ignore';
    proc = spawn(options.cmd, options.args, {
      stdio: [stdinOption, 'pipe', 'pipe'],
      windowsHide: true,
    });

    // Host supervisor watchdog timer (timeLimitMs + 500ms safety grace)
    const watchdogDeadlineMs = options.timeLimitMs + 500;
    const watchdogPromise = new Promise<{ isWatchdog: boolean }>((resolve) => {
      watchdogTimer = setTimeout(() => {
        timedOut = true;
        if (proc && !proc.killed) {
          try {
            proc.kill('SIGKILL');
          } catch {
            // Ignore kill errors
          }
        }
        resolve({ isWatchdog: true });
      }, watchdogDeadlineMs);
    });

    // Handle stdin if provided
    if (options.stdin && proc.stdin) {
      proc.stdin.write(options.stdin);
      proc.stdin.end();
    }

    // Capture stdout with buffer capping
    if (proc.stdout) {
      proc.stdout.on('data', (chunk: Buffer) => {
        if (stdoutBytes < options.outputLimitBytes) {
          const remaining = options.outputLimitBytes - stdoutBytes;
          const toAdd = chunk.subarray(0, remaining);
          stdoutBuffer += toAdd.toString('utf-8');
          stdoutBytes += chunk.length;
          if (stdoutBytes > options.outputLimitBytes) {
            outputTruncated = true;
          }
        } else {
          outputTruncated = true;
        }
      });
    }

    // Capture stderr with buffer capping
    if (proc.stderr) {
      proc.stderr.on('data', (chunk: Buffer) => {
        if (stderrBytes < options.outputLimitBytes) {
          const remaining = options.outputLimitBytes - stderrBytes;
          const toAdd = chunk.subarray(0, remaining);
          stderrBuffer += toAdd.toString('utf-8');
          stderrBytes += chunk.length;
          if (stderrBytes > options.outputLimitBytes) {
            outputTruncated = true;
          }
        } else {
          outputTruncated = true;
        }
      });
    }

    // Wait for process exit or watchdog
    const exitPromise = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
      if (!proc) return resolve({ code: null, signal: null });
      proc.on('close', (code, signal) => {
        resolve({ code, signal });
      });
      proc.on('error', (err) => {
        stderrBuffer += `\nProcess error: ${err.message}`;
        resolve({ code: 1, signal: null });
      });
    });

    const exitResult = await Promise.race([exitPromise, watchdogPromise]);

    if (watchdogTimer) {
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }

    const durationMs = Math.round(performance.now() - startTime);
    const rawExitCode = 'code' in exitResult ? exitResult.code : null;
    const rawSignal = 'signal' in exitResult ? exitResult.signal : null;

    if (durationMs >= options.timeLimitMs && (rawExitCode !== 0 || timedOut)) {
      timedOut = true;
    }

    return {
      stdout: stdoutBuffer,
      stderr: stderrBuffer,
      exitCode: timedOut ? 137 : rawExitCode,
      exitSignal: timedOut ? 'SIGKILL' : rawSignal,
      durationMs,
      timedOut,
      outputTruncated,
    };
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - startTime);
    return {
      stdout: stdoutBuffer,
      stderr: stderrBuffer + (err?.message ? `\nWorker runner error: ${err.message}` : ''),
      exitCode: 1,
      exitSignal: null,
      durationMs,
      timedOut: false,
      outputTruncated,
      error: err?.message || 'Unknown sandbox execution error',
    };
  } finally {
    if (watchdogTimer) {
      clearTimeout(watchdogTimer);
    }
    if (proc && !proc.killed) {
      try {
        proc.kill('SIGKILL');
      } catch {
        // Ignore
      }
    }
  }
}

/**
 * Builds the strict argument array for Python nsjail execution.
 * Never uses shell interpolation.
 */
export function buildNsjailArgs(
  config: Required<SandboxConfig>,
  wslWorkspacePath: string,
  timeLimitSec: number,
  memoryLimitMb: number
): string[] {
  return [
    config.nsjailPath,
    '-q',                   // Quiet mode: suppress nsjail startup banner & info logs
    '-Mo',                  // Standalone mode: execute once and exit
    '--time_limit', timeLimitSec.toString(),
    '--rlimit_as', memoryLimitMb.toString(),
    '--rlimit_cpu', timeLimitSec.toString(),
    '--rlimit_fsize', '1',  // Max regular file size: 1 MB
    '--rlimit_nofile', '32', // Max open file descriptors
    // Read-only system mounts
    '-R', '/lib',
    '-R', '/lib64',
    '-R', '/usr/lib',
    '-R', '/usr/bin',
    // Read-only workspace mount containing user source code
    '-R', `${wslWorkspacePath}:/workspace`,
    // Ephemeral scratch tmpfs mount (rw, noexec inside container)
    '-T', '/tmp',
    '--',
    config.pythonPath,
    '-B',                   // Do not write .pyc bytecode files
    '/workspace/source.py',
  ];
}

/**
 * Builds the argument array for C++ compilation inside nsjail.
 * Mounts standard headers and compiler tools read-only, workspace read-write,
 * and passes PATH so collect2 can discover ld and as.
 */
export function buildCppCompileNsjailArgs(
  config: Required<SandboxConfig>,
  wslWorkspacePath: string,
  timeLimitSec: number = 10,
  memoryLimitMb: number = 1024
): string[] {
  return [
    config.nsjailPath,
    '-q',                   // Quiet mode
    '-Mo',                  // Execute once and exit
    '-E', 'PATH=/usr/bin:/bin', // Required for collect2 to invoke ld and as
    '--time_limit', timeLimitSec.toString(),
    '--rlimit_as', memoryLimitMb.toString(),
    '--rlimit_cpu', timeLimitSec.toString(),
    '--rlimit_fsize', DEFAULT_COMPILE_FSIZE_MB.toString(),
    '--rlimit_nofile', '64',
    // Read-only system and toolchain mounts
    '-R', '/lib',
    '-R', '/lib64',
    '-R', '/usr/lib',
    '-R', '/usr/bin',
    '-R', '/usr/include',   // C & C++ standard library headers
    '-R', '/usr/libexec',   // cc1plus, collect2, lto-wrapper
    // Read-write workspace mount for compiler to output solution.bin
    '-B', `${wslWorkspacePath}:/workspace`,
    // Ephemeral scratch tmpfs mount for intermediate files
    '-T', '/tmp',
    '--',
    config.cppCompilerPath,
    '-O2',
    '-std=c++20',
    '/workspace/source.cpp',
    '-o',
    '/workspace/solution.bin',
  ];
}

/**
 * Builds the strict argument array for compiled C++ binary execution inside nsjail.
 * Strictly mounts the workspace as read-only (-R) to prevent binary from mutating workspace.
 */
export function buildCppExecutionNsjailArgs(
  config: Required<SandboxConfig>,
  wslWorkspacePath: string,
  timeLimitSec: number,
  memoryLimitMb: number
): string[] {
  return [
    config.nsjailPath,
    '-q',                   // Quiet mode
    '-Mo',                  // Execute once and exit
    '--time_limit', timeLimitSec.toString(),
    '--rlimit_as', memoryLimitMb.toString(),
    '--rlimit_cpu', timeLimitSec.toString(),
    '--rlimit_fsize', '1',  // Max regular file size: 1 MB
    '--rlimit_nofile', '32', // Max open file descriptors
    // Read-only system mounts
    '-R', '/lib',
    '-R', '/lib64',
    '-R', '/usr/lib',
    '-R', '/usr/bin',
    // Strictly read-only workspace mount containing compiled binary
    '-R', `${wslWorkspacePath}:/workspace`,
    // Ephemeral scratch tmpfs mount (rw, noexec inside container)
    '-T', '/tmp',
    '--',
    '/workspace/solution.bin',
  ];
}

/**
 * Resolves full sandbox configuration with defaults.
 */
function resolveConfig(config: SandboxConfig = {}): Required<SandboxConfig> {
  return {
    nsjailPath: config.nsjailPath ?? DEFAULT_NSJAIL_PATH,
    pythonPath: config.pythonPath ?? DEFAULT_PYTHON_PATH,
    cppCompilerPath: config.cppCompilerPath ?? DEFAULT_CPP_COMPILER_PATH,
    compileTimeLimitMs: config.compileTimeLimitMs ?? DEFAULT_COMPILE_TIME_LIMIT_MS,
    compileMemoryLimitMb: config.compileMemoryLimitMb ?? DEFAULT_COMPILE_MEMORY_LIMIT_MB,
    wslDistro: config.wslDistro ?? DEFAULT_WSL_DISTRO,
    wslUser: config.wslUser ?? DEFAULT_WSL_USER,
    scratchDir: config.scratchDir ?? '',
  };
}

/**
 * Executes a Python script inside an unprivileged nsjail sandbox.
 */
export async function executePython(
  request: ExecutionRequest,
  config: SandboxConfig = {}
): Promise<ExecutionResult> {
  const timeLimitMs = request.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS;
  const memoryLimitMb = request.memoryLimitMb ?? DEFAULT_MEMORY_LIMIT_MB;
  const outputLimitBytes = request.outputLimitBytes ?? DEFAULT_OUTPUT_LIMIT_BYTES;
  const timeLimitSec = Math.max(1, Math.ceil(timeLimitMs / 1000));

  const resolvedConfig = resolveConfig(config);
  const { dirPath, wslPath } = createWorkspace(resolvedConfig.scratchDir || undefined);
  const sourceFilePath = path.join(dirPath, 'source.py');

  try {
    // 1. Write source file to workspace
    fs.writeFileSync(sourceFilePath, request.code, { encoding: 'utf-8' });

    // 2. Build argument arrays
    const nsjailArgs = buildNsjailArgs(resolvedConfig, wslPath, timeLimitSec, memoryLimitMb);
    const { cmd, args } = resolveSpawnCommand(resolvedConfig, nsjailArgs);

    // 3. Launch the process
    return await runProcess({
      cmd,
      args,
      stdin: request.stdin,
      timeLimitMs,
      outputLimitBytes,
    });
  } catch (err: any) {
    return {
      stdout: '',
      stderr: `Worker runner error: ${err?.message || err}`,
      exitCode: 1,
      exitSignal: null,
      durationMs: 0,
      timedOut: false,
      outputTruncated: false,
      error: err?.message || 'Unknown sandbox execution error',
    };
  } finally {
    cleanupWorkspace(dirPath);
  }
}

/**
 * Compiles and executes a C++ program inside an unprivileged nsjail sandbox.
 * Compilation runs inside nsjail with compiler toolchain mounts, and execution
 * runs the resulting binary with strictly read-only workspace mounts.
 */
export async function executeCpp(
  request: ExecutionRequest,
  config: SandboxConfig = {}
): Promise<ExecutionResult> {
  const timeLimitMs = request.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS;
  const memoryLimitMb = request.memoryLimitMb ?? DEFAULT_MEMORY_LIMIT_MB;
  const outputLimitBytes = request.outputLimitBytes ?? DEFAULT_OUTPUT_LIMIT_BYTES;
  const timeLimitSec = Math.max(1, Math.ceil(timeLimitMs / 1000));

  const resolvedConfig = resolveConfig(config);
  const compileTimeLimitMs = resolvedConfig.compileTimeLimitMs;
  const compileMemoryLimitMb = resolvedConfig.compileMemoryLimitMb;
  const compileTimeLimitSec = Math.max(1, Math.ceil(compileTimeLimitMs / 1000));

  const { dirPath, wslPath } = createWorkspace(resolvedConfig.scratchDir || undefined);
  const sourceFilePath = path.join(dirPath, 'source.cpp');
  const binaryFilePath = path.join(dirPath, 'solution.bin');

  try {
    // 1. Write C++ source file to workspace
    fs.writeFileSync(sourceFilePath, request.code, { encoding: 'utf-8' });

    // 2. Phase 1: Sandboxed C++ Compilation inside nsjail
    const compileArgs = buildCppCompileNsjailArgs(
      resolvedConfig,
      wslPath,
      compileTimeLimitSec,
      compileMemoryLimitMb
    );
    const compileSpawn = resolveSpawnCommand(resolvedConfig, compileArgs);

    const compileResult = await runProcess({
      cmd: compileSpawn.cmd,
      args: compileSpawn.args,
      timeLimitMs: compileTimeLimitMs,
      outputLimitBytes,
    });

    const compileDurationMs = compileResult.durationMs;
    const binaryExists = fs.existsSync(binaryFilePath);

    // Handle compilation failure
    if (compileResult.exitCode !== 0 || compileResult.timedOut || !binaryExists) {
      const compileErrMsg =
        compileResult.stderr.trim() ||
        compileResult.stdout.trim() ||
        (compileResult.timedOut ? 'Compilation timed out' : 'Compilation failed to produce binary');

      return {
        stdout: '',
        stderr: compileResult.stderr,
        exitCode: compileResult.exitCode ?? 1,
        exitSignal: compileResult.exitSignal,
        durationMs: compileDurationMs,
        timedOut: compileResult.timedOut,
        outputTruncated: compileResult.outputTruncated,
        compileError: compileErrMsg,
        compileFailed: true,
        compileDurationMs,
      };
    }

    // 3. Phase 2: Sandboxed C++ Execution of compiled binary inside nsjail
    // Workspace is mounted strictly read-only (-R) during execution
    const execArgs = buildCppExecutionNsjailArgs(
      resolvedConfig,
      wslPath,
      timeLimitSec,
      memoryLimitMb
    );
    const execSpawn = resolveSpawnCommand(resolvedConfig, execArgs);

    const execResult = await runProcess({
      cmd: execSpawn.cmd,
      args: execSpawn.args,
      stdin: request.stdin,
      timeLimitMs,
      outputLimitBytes,
    });

    return {
      ...execResult,
      compileFailed: false,
      compileDurationMs,
    };
  } catch (err: any) {
    return {
      stdout: '',
      stderr: `Worker runner error: ${err?.message || err}`,
      exitCode: 1,
      exitSignal: null,
      durationMs: 0,
      timedOut: false,
      outputTruncated: false,
      compileFailed: false,
      error: err?.message || 'Unknown sandbox execution error',
    };
  } finally {
    cleanupWorkspace(dirPath);
  }
}
