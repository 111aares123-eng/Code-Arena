import { describe, it, expect } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { executePython } from '../src/index.ts';

describe('CodeArena Minimal Python Worker', () => {
  it('Test A: Successful execution of trusted Python program', async () => {
    const result = await executePython({
      code: 'print("CodeArena Worker Online")',
      timeLimitMs: 8000,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('CodeArena Worker Online');
    expect(result.stderr.trim()).toBe('');
    expect(result.timedOut).toBe(false);
    expect(result.outputTruncated).toBe(false);
    expect(result.durationMs).toBeGreaterThan(0);
  }, 15000);

  it('Test B: Runtime error handling and traceback capture', async () => {
    const result = await executePython({
      code: 'print("Before error")\nraise ValueError("Test error")',
      timeLimitMs: 8000,
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stdout.trim()).toBe('Before error');
    expect(result.stderr).toContain('ValueError: Test error');
    expect(result.timedOut).toBe(false);
  });

  it('Test C: Timeout enforcement on infinite loop', async () => {
    const result = await executePython({
      code: 'while True:\n    pass',
      timeLimitMs: 1000,
    });

    expect(result.timedOut).toBe(true);
    expect(result.exitCode).not.toBe(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(950);
  });

  it('Test D: Output size limit and truncation buffer enforcement', async () => {
    const outputCap = 1024; // 1 KiB
    const result = await executePython({
      code: 'print("X" * 50000)',
      timeLimitMs: 3000,
      outputLimitBytes: outputCap,
    });

    expect(result.outputTruncated).toBe(true);
    expect(result.stdout.length).toBeLessThanOrEqual(outputCap);
    expect(result.timedOut).toBe(false);
  });

  it('Workspace cleanup: Verifies zero lingering workspace directories', async () => {
    const tmpBase = process.platform === 'win32'
      ? path.resolve(process.cwd(), '.worker-tmp')
      : path.join('/tmp', 'codearena-worker');

    // Run a quick execution
    await executePython({
      code: 'print("Cleanup Check")',
      timeLimitMs: 2000,
    });

    // Check if tmpBase exists and has no lingering directories
    if (fs.existsSync(tmpBase)) {
      const remainingFiles = fs.readdirSync(tmpBase);
      expect(remainingFiles.length).toBe(0);
    }
  });
});
