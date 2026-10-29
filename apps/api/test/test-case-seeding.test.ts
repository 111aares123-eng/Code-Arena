import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SEED_TEST_CASES, type SeedTestCase } from '@code-arena/db';
import { MOCK_PROBLEMS, getMockProblemBySlug } from '@code-arena/shared';
import { evaluateSubmission, SAMPLE_ONLY_DISCLAIMER } from '../src/services/evaluation';
import type { TestCaseStore, ExecutionTestCase } from '../src/services/test-case-store';
import { executionRouter } from '../src/routers/execution';

describe('Seed Test Cases Dataset Integrity', () => {
  it('contains test cases for all 8 catalog problems', () => {
    const catalogProblemIds = new Set(MOCK_PROBLEMS.map((p) => p.id));
    assert.equal(catalogProblemIds.size, 8);

    const seededProblemIds = new Set(SEED_TEST_CASES.map((tc) => tc.problemId));
    for (const probId of catalogProblemIds) {
      assert.ok(seededProblemIds.has(probId), `Missing test cases for catalog problem ${probId}`);
    }
  });

  it('guarantees unique, deterministic IDs for every test case', () => {
    const seenIds = new Set<string>();
    for (const tc of SEED_TEST_CASES) {
      assert.ok(!seenIds.has(tc.id), `Duplicate test case ID found: ${tc.id}`);
      seenIds.add(tc.id);
      assert.match(tc.id, /^tc-prob-\d{3}-\d+$/, `Invalid ID format for ${tc.id}`);
    }
  });

  it('ensures each problem has both visible samples and hidden evaluation cases', () => {
    const byProblem = new Map<string, { visible: SeedTestCase[]; hidden: SeedTestCase[] }>();

    for (const tc of SEED_TEST_CASES) {
      if (!byProblem.has(tc.problemId)) {
        byProblem.set(tc.problemId, { visible: [], hidden: [] });
      }
      const group = byProblem.get(tc.problemId)!;
      if (tc.isVisible) {
        group.visible.push(tc);
      } else {
        group.hidden.push(tc);
      }
    }

    for (const [probId, group] of byProblem.entries()) {
      assert.ok(
        group.visible.length > 0,
        `Problem ${probId} must have at least one visible test case`
      );
      assert.ok(
        group.hidden.length > 0,
        `Problem ${probId} must have at least one hidden evaluation case for full judgeability`
      );
    }
  });

  it('validates structured inputs and expected outputs are non-empty and well-formed', () => {
    for (const tc of SEED_TEST_CASES) {
      assert.ok(tc.input.trim().length > 0, `Empty input in test case ${tc.id}`);
      assert.ok(tc.expectedOutput.trim().length > 0, `Empty expectedOutput in test case ${tc.id}`);
      assert.ok(
        tc.structuredInput && typeof tc.structuredInput === 'object',
        `Missing or invalid structuredInput in ${tc.id}`
      );
      // Verify structuredInput is JSON-serializable
      assert.doesNotThrow(() => JSON.stringify(tc.structuredInput));
    }
  });
});

describe('Idempotent Test Case Seeding Simulation', () => {
  it('simulates idempotent upsert using unique test case ID constraint', () => {
    const inMemoryTable = new Map<string, SeedTestCase>();

    // Initial seed pass
    let inserted = 0;
    for (const tc of SEED_TEST_CASES) {
      inMemoryTable.set(tc.id, { ...tc });
      inserted++;
    }
    assert.equal(inserted, SEED_TEST_CASES.length);
    assert.equal(inMemoryTable.size, SEED_TEST_CASES.length);

    // Second seed pass (idempotence verification: must update in-place without duplicating)
    let reseeded = 0;
    for (const tc of SEED_TEST_CASES) {
      inMemoryTable.set(tc.id, { ...tc });
      reseeded++;
    }
    assert.equal(reseeded, SEED_TEST_CASES.length);
    assert.equal(inMemoryTable.size, SEED_TEST_CASES.length);
  });
});

describe('Evaluation Service: SAMPLE_PASSED vs ACCEPTED Distinction', () => {
  it('returns SAMPLE_PASSED in SAMPLES_ONLY mode when judgeCases is empty', async () => {
    const twoSum = getMockProblemBySlug('two-sum')!;
    assert.ok(twoSum);

    // Mock executor that always returns matching output for sample inputs
    const mockExecute = async (params: { sourceCode: string }) => {
      let stdout = '[0,1]';
      if (params.sourceCode.includes('3,2,4') || params.sourceCode.includes('3, 2, 4')) {
        stdout = '[1,2]';
      }
      return {
        success: true as const,
        result: {
          stdout,
          stderr: null,
          compileOutput: null,
          message: null,
          exitCode: 0,
          exitSignal: null,
          status: { id: 3, description: 'Accepted' },
          time: '0.015',
          memory: 12000,
          isError: false,
        },
      };
    };

    const outcome = await evaluateSubmission({
      problem: { slug: twoSum.slug, examples: twoSum.examples },
      judgeCases: [], // Empty => legacy sample-only mode
      language: 'python',
      sourceCode: 'class Solution: pass',
      execute: mockExecute,
    });

    assert.equal(outcome.success, true);
    assert.equal(outcome.verdict, 'SAMPLE_PASSED');
    assert.equal(outcome.evaluationMode, 'SAMPLES_ONLY');
    assert.equal(outcome.disclaimer, SAMPLE_ONLY_DISCLAIMER);
    assert.equal(outcome.totalCases, twoSum.examples.length);
  });

  it('returns ACCEPTED in FULL mode when all visible and hidden cases pass', async () => {
    const twoSum = getMockProblemBySlug('two-sum')!;
    const testCasesForProb = SEED_TEST_CASES.filter((tc) => tc.problemId === 'prob-001');

    // Mock executor that simulates correct Solution
    const mockExecute = async (params: { sourceCode: string }) => {
      // Return expected output based on source code content
      let stdout = '[0,1]';
      if (params.sourceCode.includes('-1,-2,-3,-4,-5') || params.sourceCode.includes('-1, -2, -3, -4, -5')) {
        stdout = '[2,4]';
      } else if (params.sourceCode.includes('0,4,3,0') || params.sourceCode.includes('0, 4, 3, 0')) {
        stdout = '[0,3]';
      } else if (params.sourceCode.includes('-1000000000')) {
        stdout = '[0,1]';
      } else if (params.sourceCode.includes('1,5,9') || params.sourceCode.includes('1, 5, 9')) {
        stdout = '[0,2]';
      } else if (params.sourceCode.includes('3,2,4') || params.sourceCode.includes('3, 2, 4')) {
        stdout = '[1,2]';
      } else if (params.sourceCode.includes('3,3') || params.sourceCode.includes('3, 3')) {
        stdout = '[0,1]';
      }

      return {
        success: true as const,
        result: {
          stdout,
          stderr: null,
          compileOutput: null,
          message: null,
          exitCode: 0,
          exitSignal: null,
          status: { id: 3, description: 'Accepted' },
          time: '0.012',
          memory: 11000,
          isError: false,
        },
      };
    };

    const outcome = await evaluateSubmission({
      problem: { slug: twoSum.slug, examples: twoSum.examples },
      judgeCases: testCasesForProb,
      language: 'python',
      sourceCode: 'class Solution: pass',
      execute: mockExecute,
    });

    assert.equal(outcome.success, true);
    assert.equal(outcome.verdict, 'ACCEPTED');
    assert.equal(outcome.evaluationMode, 'FULL');
    assert.ok(outcome.hiddenCases);
    assert.equal(outcome.hiddenCases.passed, outcome.hiddenCases.total);
    assert.equal(outcome.passedCases, outcome.totalCases);
  });

  it('fails with WRONG_ANSWER and stops when a hidden case fails', async () => {
    const twoSum = getMockProblemBySlug('two-sum')!;
    const testCasesForProb = SEED_TEST_CASES.filter((tc) => tc.problemId === 'prob-001');

    // Mock executor that passes visible cases but returns wrong output on hidden case
    const mockExecute = async (params: { sourceCode: string }) => {
      let stdout = '[0,1]';
      if (params.sourceCode.includes('3,2,4') || params.sourceCode.includes('3, 2, 4')) {
        stdout = '[1,2]';
      } else if (params.sourceCode.includes('-1,-2,-3,-4,-5')) {
        // Incorrect answer on first hidden case!
        stdout = '[0,0]';
      }

      return {
        success: true as const,
        result: {
          stdout,
          stderr: null,
          compileOutput: null,
          message: null,
          exitCode: 0,
          exitSignal: null,
          status: { id: 3, description: 'Accepted' },
          time: '0.010',
          memory: 10000,
          isError: false,
        },
      };
    };

    const outcome = await evaluateSubmission({
      problem: { slug: twoSum.slug, examples: twoSum.examples },
      judgeCases: testCasesForProb,
      language: 'python',
      sourceCode: 'class Solution: pass',
      execute: mockExecute,
    });

    assert.equal(outcome.success, false);
    assert.equal(outcome.verdict, 'WRONG_ANSWER');
    assert.ok(outcome.hiddenCases);
    assert.equal(outcome.hiddenCases.results[0].outcome, 'WRONG_ANSWER');
    assert.equal(outcome.hiddenCases.passed, 0);
  });
});

describe('Hidden Case Data Confidentiality', () => {
  it('never discloses hidden inputs or expected outputs in student response', async () => {
    const twoSum = getMockProblemBySlug('two-sum')!;
    const testCasesForProb = SEED_TEST_CASES.filter((tc) => tc.problemId === 'prob-001');

    const mockExecute = async (params: { sourceCode: string }) => {
      // Pass the visible sample cases
      if (!params.sourceCode.includes('-1,-2,-3,-4,-5')) {
        let stdout = '[0,1]';
        if (params.sourceCode.includes('3,2,4') || params.sourceCode.includes('3, 2, 4')) {
          stdout = '[1,2]';
        }
        return {
          success: true as const,
          result: {
            stdout,
            stderr: null,
            compileOutput: null,
            message: null,
            exitCode: 0,
            exitSignal: null,
            status: { id: 3, description: 'Accepted' },
            time: '0.010',
            memory: 10000,
            isError: false,
          },
        };
      }

      // Hidden case fails with runtime error quoting student code / traceback
      return {
        success: true as const,
        result: {
          stdout: 'echoed hidden input: [-1,-2,-3,-4,-5]',
          stderr: 'Traceback: error quoting hidden input [-1,-2,-3,-4,-5]',
          compileOutput: null,
          message: null,
          exitCode: 1,
          exitSignal: null,
          status: { id: 11, description: 'Runtime Error' },
          time: '0.010',
          memory: 10000,
          isError: true,
          errorType: 'runtime_error' as const,
        },
      };
    };

    const outcome = await evaluateSubmission({
      problem: { slug: twoSum.slug, examples: twoSum.examples },
      judgeCases: testCasesForProb,
      language: 'python',
      sourceCode: 'class Solution: pass',
      execute: mockExecute,
    });

    const jsonString = JSON.stringify(outcome);

    // 1. Verify outcome.hiddenCases contains only redacted metadata (caseNumber, outcome, timing)
    assert.ok(outcome.hiddenCases);
    for (const hr of outcome.hiddenCases.results) {
      assert.equal('input' in hr, false, 'hiddenCases result must not have input');
      assert.equal('expectedOutput' in hr, false, 'hiddenCases result must not have expectedOutput');
      assert.equal('actualOutput' in hr, false, 'hiddenCases result must not have actualOutput');
      assert.equal('stderr' in hr, false, 'hiddenCases result must not have stderr');
      assert.equal('compileOutput' in hr, false, 'hiddenCases result must not have compileOutput');
    }

    // 2. Verify outcome.evaluations only contains visible cases
    assert.equal(outcome.evaluations.length, 3);
    for (const ev of outcome.evaluations) {
      assert.ok(ev.caseIndex < 3);
    }

    // 3. Verify unique hidden inputs never appear anywhere in the response JSON
    const uniqueHiddenInputs = [
      '[-1,-2,-3,-4,-5]',
      '[-1000000000, 1000000000]',
      '[1, 5, 9]',
    ];
    for (const uInput of uniqueHiddenInputs) {
      assert.equal(jsonString.includes(uInput), false, `Hidden input leaked: ${uInput}`);
    }

    // 4. Verify raw stderr quoting hidden input was completely redacted
    assert.equal(
      jsonString.includes('error quoting hidden input'),
      false,
      'Raw stderr quoting hidden input leaked in response!'
    );
  });
});

describe('End-to-End tRPC Caller with Seeded Test Cases Store', () => {
  it('evaluates via tRPC caller using in-memory store populated with SEED_TEST_CASES', async () => {
    const mockStore: TestCaseStore = {
      async listForEvaluation(problemId: string): Promise<ExecutionTestCase[]> {
        return SEED_TEST_CASES.filter((tc) => tc.problemId === problemId);
      },
      async listForProblem() {
        return [];
      },
      async problemExists() {
        return true;
      },
      async create() {
        throw new Error('Not implemented');
      },
      async update() {
        throw new Error('Not implemented');
      },
      async remove() {
        throw new Error('Not implemented');
      },
    };

    const caller = executionRouter.createCaller({
      testCaseStore: mockStore,
      skipRateLimit: true,
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/submissions')) {
        const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
        const sourceCode = body.source_code ? Buffer.from(body.source_code, 'base64').toString('utf8') : '';

        // Two sum outputs
        let stdout = '[0,1]';
        if (sourceCode.includes('-1,-2,-3,-4,-5') || sourceCode.includes('-1, -2, -3, -4, -5')) {
          stdout = '[2,4]';
        } else if (sourceCode.includes('0,4,3,0') || sourceCode.includes('0, 4, 3, 0')) {
          stdout = '[0,3]';
        } else if (sourceCode.includes('-1000000000')) {
          stdout = '[0,1]';
        } else if (sourceCode.includes('1,5,9') || sourceCode.includes('1, 5, 9')) {
          stdout = '[0,2]';
        } else if (sourceCode.includes('3,2,4') || sourceCode.includes('3, 2, 4')) {
          stdout = '[1,2]';
        } else if (sourceCode.includes('3,3') || sourceCode.includes('3, 3')) {
          stdout = '[0,1]';
        }

        return new Response(
          JSON.stringify({
            stdout: Buffer.from(stdout).toString('base64'),
            stderr: null,
            compile_output: null,
            message: null,
            exit_code: 0,
            exit_signal: null,
            status: { id: 3, description: 'Accepted' },
            time: '0.015',
            memory: 12000,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(url, init);
    };

    try {
      const response = await caller.submit({
        problemSlug: 'two-sum',
        language: 'python',
        sourceCode: 'class Solution: pass',
      });

      assert.equal(response.success, true);
      assert.equal(response.verdict, 'ACCEPTED');
      assert.equal(response.evaluationMode, 'FULL');
      // Two sum has 3 visible cases + 4 hidden cases = 7 total cases
      assert.equal(response.totalCases, 7);
      assert.equal(response.passedCases, 7);
      assert.ok(response.hiddenCases);
      assert.equal(response.hiddenCases.total, 4);
      assert.equal(response.hiddenCases.passed, 4);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
