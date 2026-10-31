import { describe, it, expect } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { executeCpp } from '../src/index.ts';

describe('CodeArena C++ Worker', () => {
  it('Test 1: Successful C++ compilation and execution', async () => {
    const result = await executeCpp({
      code: `#include <iostream>
int main() {
    std::cout << "CodeArena C++ Online" << std::endl;
    return 0;
}`,
      timeLimitMs: 8000,
    });

    expect(result.compileFailed).toBe(false);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('CodeArena C++ Online');
    expect(result.stderr.trim()).toBe('');
    expect(result.timedOut).toBe(false);
    expect(result.outputTruncated).toBe(false);
    expect(result.durationMs).toBeGreaterThan(0);
  }, 20000);

  it('Test 2: Compilation error capture and separation', async () => {
    const result = await executeCpp({
      code: `#include <iostream>
int main() {
    std::cout << MissingSemicolon
    return 0;
}`,
      timeLimitMs: 8000,
    });

    expect(result.compileFailed).toBe(true);
    expect(result.compileError).toBeDefined();
    expect(result.compileError).toContain('MissingSemicolon');
    expect(result.exitCode).not.toBe(0);
    expect(result.timedOut).toBe(false);
  }, 20000);

  it('Test 3: Runtime error handling and abnormal termination', async () => {
    const result = await executeCpp({
      code: `#include <iostream>
#include <stdexcept>
int main() {
    std::cerr << "Before crash" << std::endl;
    throw std::runtime_error("Test C++ error");
    return 0;
}`,
      timeLimitMs: 8000,
    });

    expect(result.compileFailed).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('Before crash');
    expect(result.stderr).toContain('Test C++ error');
    expect(result.timedOut).toBe(false);
  }, 20000);

  it('Test 4: Timeout enforcement on infinite loop', async () => {
    const result = await executeCpp({
      code: `int main() {
    while (true) {}
    return 0;
}`,
      timeLimitMs: 1000,
    });

    expect(result.compileFailed).toBe(false);
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).not.toBe(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(950);
  }, 20000);

  it('Test 5: Output size limit and truncation buffer enforcement', async () => {
    const outputCap = 1024; // 1 KiB
    const result = await executeCpp({
      code: `#include <iostream>
int main() {
    for (int i = 0; i < 50000; ++i) {
        std::cout << "X";
    }
    return 0;
}`,
      timeLimitMs: 5000,
      outputLimitBytes: outputCap,
    });

    expect(result.compileFailed).toBe(false);
    expect(result.outputTruncated).toBe(true);
    expect(result.stdout.length).toBeLessThanOrEqual(outputCap);
    expect(result.timedOut).toBe(false);
  }, 20000);

  it('Test 6: Temporary workspace cleanup verifies removal of source and binary', async () => {
    const tmpBase = process.platform === 'win32'
      ? path.resolve(process.cwd(), '.worker-tmp')
      : path.join('/tmp', 'codearena-worker');

    const result = await executeCpp({
      code: `#include <iostream>
int main() {
    std::cout << "Cleanup Verification" << std::endl;
    return 0;
}`,
      timeLimitMs: 5000,
    });

    expect(result.compileFailed).toBe(false);
    expect(result.exitCode).toBe(0);

    if (fs.existsSync(tmpBase)) {
      const remainingFiles = fs.readdirSync(tmpBase);
      expect(remainingFiles.length).toBe(0);
    }
  }, 20000);
});
