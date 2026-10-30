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
 * Builds the strict argument array for nsjail execution.
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
 * Executes a Python script inside an unprivileged nsjail sandbox.
 */
export async function executePython(
  request: ExecutionRequest,
  config: SandboxConfig = {}
): Promise<ExecutionResult> {
  const startTime = performance.now();
  const timeLimitMs = request.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS;
  const memoryLimitMb = request.memoryLimitMb ?? DEFAULT_MEMORY_LIMIT_MB;
  const outputLimitBytes = request.outputLimitBytes ?? DEFAULT_OUTPUT_LIMIT_BYTES;
  const timeLimitSec = Math.max(1, Math.ceil(timeLimitMs / 1000));

  const resolvedConfig: Required<SandboxConfig> = {
    nsjailPath: config.nsjailPath ?? DEFAULT_NSJAIL_PATH,
    pythonPath: config.pythonPath ?? DEFAULT_PYTHON_PATH,
    wslDistro: config.wslDistro ?? DEFAULT_WSL_DISTRO,
    wslUser: config.wslUser ?? DEFAULT_WSL_USER,
    scratchDir: config.scratchDir ?? '',
  };

  const { dirPath, wslPath } = createWorkspace(resolvedConfig.scratchDir || undefined);
  const sourceFilePath = path.join(dirPath, 'source.py');

  let proc: ChildProcess | null = null;
  let watchdogTimer: NodeJS.Timeout | null = null;
  let timedOut = false;
  let outputTruncated = false;

  let stdoutBuffer = '';
  let stderrBuffer = '';
  let stdoutBytes = 0;
  let stderrBytes = 0;

  try {
    // 1. Write source file to workspace
    fs.writeFileSync(sourceFilePath, request.code, { encoding: 'utf-8' });

    // 2. Build argument arrays (strict array passing, zero shell interpolation)
    const nsjailArgs = buildNsjailArgs(resolvedConfig, wslPath, timeLimitSec, memoryLimitMb);

    let spawnCmd: string;
    let spawnArgs: string[];

    if (process.platform === 'win32') {
      spawnCmd = 'wsl';
      spawnArgs = ['-d', resolvedConfig.wslDistro, '-u', resolvedConfig.wslUser, '-e', ...nsjailArgs];
    } else {
      spawnCmd = resolvedConfig.nsjailPath;
      spawnArgs = nsjailArgs.slice(1);
    }

    // 3. Launch the process
    const stdinOption = request.stdin ? 'pipe' : 'ignore';
    proc = spawn(spawnCmd, spawnArgs, {
      stdio: [stdinOption, 'pipe', 'pipe'],
      windowsHide: true,
    });

    // 4. Host supervisor watchdog timer (timeLimitMs + 500ms safety grace)
    const watchdogDeadlineMs = timeLimitMs + 500;
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

    // 5. Handle stdin if provided
    if (request.stdin && proc.stdin) {
      proc.stdin.write(request.stdin);
      proc.stdin.end();
    }

    // 6. Capture stdout with buffer capping
    if (proc.stdout) {
      proc.stdout.on('data', (chunk: Buffer) => {
        if (stdoutBytes < outputLimitBytes) {
          const remaining = outputLimitBytes - stdoutBytes;
          const toAdd = chunk.subarray(0, remaining);
          stdoutBuffer += toAdd.toString('utf-8');
          stdoutBytes += chunk.length;
          if (stdoutBytes > outputLimitBytes) {
            outputTruncated = true;
          }
        } else {
          outputTruncated = true;
        }
      });
    }

    // 7. Capture stderr with buffer capping
    if (proc.stderr) {
      proc.stderr.on('data', (chunk: Buffer) => {
        if (stderrBytes < outputLimitBytes) {
          const remaining = outputLimitBytes - stderrBytes;
          const toAdd = chunk.subarray(0, remaining);
          stderrBuffer += toAdd.toString('utf-8');
          stderrBytes += chunk.length;
          if (stderrBytes > outputLimitBytes) {
            outputTruncated = true;
          }
        } else {
          outputTruncated = true;
        }
      });
    }

    // 8. Wait for process exit or watchdog
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

    // If watchdog triggered or nsjail killed by internal time_limit
    const rawExitCode = 'code' in exitResult ? exitResult.code : null;
    const rawSignal = 'signal' in exitResult ? exitResult.signal : null;

    // Detect if nsjail timed out internally (SIGKILL or wall time exceeded)
    if (durationMs >= timeLimitMs && (rawExitCode !== 0 || timedOut)) {
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
    // Guaranteed workspace cleanup
    cleanupWorkspace(dirPath);
  }
}
