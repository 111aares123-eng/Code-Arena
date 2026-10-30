import { spawn, type ChildProcess, execSync } from 'node:child_process';
import readline from 'node:readline';
import process from 'node:process';

interface ServiceConfig {
  name: string;
  prefix: string;
  color: string;
  command: string;
  args: string[];
  cwd: string;
}

const RESET = '\x1b[0m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';

const services: ServiceConfig[] = [
  {
    name: 'web',
    prefix: '[web]',
    color: CYAN,
    command: 'bun',
    args: ['--filter', 'web', 'dev'],
    cwd: process.cwd(),
  },
  {
    name: 'api',
    prefix: '[api]',
    color: MAGENTA,
    command: 'bun',
    args: ['--filter', 'api', 'dev'],
    cwd: process.cwd(),
  },
];

const runningProcesses = new Map<string, ChildProcess>();
let isShuttingDown = false;
let exitCode = 0;

function logDev(message: string, isError = false) {
  const color = isError ? RED : YELLOW;
  const time = new Date().toLocaleTimeString();
  const stream = isError ? process.stderr : process.stdout;
  stream.write(`${color}[dev ${time}]${RESET} ${message}\n`);
}

function killProcessTree(proc: ChildProcess, serviceName: string): Promise<void> {
  return new Promise((resolve) => {
    if (!proc || proc.killed || proc.pid === undefined) {
      resolve();
      return;
    }

    const pid = proc.pid;

    if (process.platform === 'win32') {
      try {
        // /T kills child tree, /F forces termination
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
      } catch {
        // Process may already have exited
      }
      resolve();
    } else {
      try {
        // Try killing the process group first
        process.kill(-pid, 'SIGTERM');
      } catch {
        try {
          proc.kill('SIGTERM');
        } catch {
          // ignore
        }
      }

      // Force kill fallback after 2s
      const timer = setTimeout(() => {
        try {
          if (process.platform !== 'win32') {
            process.kill(-pid, 'SIGKILL');
          } else {
            proc.kill('SIGKILL');
          }
        } catch {
          // ignore
        }
        resolve();
      }, 2000);

      proc.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    }
  });
}

async function shutdown(reason: string, code = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  exitCode = code;

  logDev(`Initiating shutdown (${reason}). Cleaning up child processes...`);

  const killPromises: Promise<void>[] = [];
  for (const [name, proc] of runningProcesses.entries()) {
    logDev(`Stopping ${name} (PID ${proc.pid})...`);
    killPromises.push(killProcessTree(proc, name));
  }

  await Promise.all(killPromises);
  runningProcesses.clear();

  logDev('All processes stopped cleanly.');
  process.exit(exitCode);
}

function startService(config: ServiceConfig) {
  const isWindows = process.platform === 'win32';
  // On Windows, running batch/cmd executables or shell commands requires shell: true
  const child = spawn(config.command, config.args, {
    cwd: config.cwd,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: isWindows,
    env: {
      ...process.env,
      FORCE_COLOR: '1',
    },
    detached: !isWindows, // Allow process grouping on POSIX
  });

  runningProcesses.set(config.name, child);

  if (child.stdout) {
    const rlOut = readline.createInterface({ input: child.stdout });
    rlOut.on('line', (line) => {
      process.stdout.write(`${config.color}${config.prefix}${RESET} ${line}\n`);
    });
  }

  if (child.stderr) {
    const rlErr = readline.createInterface({ input: child.stderr });
    rlErr.on('line', (line) => {
      process.stderr.write(`${config.color}${config.prefix}${RESET} ${line}\n`);
    });
  }

  child.on('error', (err) => {
    logDev(`Service ${config.name} encountered spawn error: ${err.message}`, true);
    shutdown(`failure in ${config.name}`, 1);
  });

  child.on('exit', (code, signal) => {
    runningProcesses.delete(config.name);
    if (!isShuttingDown) {
      if (code !== 0 && code !== null) {
        logDev(`Service ${config.name} exited unexpectedly with code ${code}`, true);
        shutdown(`service ${config.name} exited with code ${code}`, code);
      } else if (signal) {
        logDev(`Service ${config.name} was killed by signal ${signal}`, true);
        shutdown(`service ${config.name} killed by ${signal}`, 1);
      } else {
        logDev(`Service ${config.name} stopped.`, false);
        shutdown(`service ${config.name} finished`, 0);
      }
    }
  });

  logDev(`Started ${GREEN}${config.name}${RESET} (PID ${child.pid}) via "${config.command} ${config.args.join(' ')}"`);
}

// Signal handlers
process.on('SIGINT', () => {
  logDev('Received SIGINT (Ctrl+C)');
  shutdown('SIGINT', 0);
});

process.on('SIGTERM', () => {
  logDev('Received SIGTERM');
  shutdown('SIGTERM', 0);
});

process.on('SIGHUP', () => {
  logDev('Received SIGHUP');
  shutdown('SIGHUP', 0);
});

process.on('uncaughtException', (err) => {
  logDev(`Uncaught exception in dev runner: ${err.message}`, true);
  shutdown('uncaught exception', 1);
});

// Start all services
logDev('Starting CodeArena development stack (frontend + API)...');
for (const service of services) {
  startService(service);
}
