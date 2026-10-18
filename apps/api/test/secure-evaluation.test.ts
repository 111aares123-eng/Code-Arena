import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ExecutionLanguage, ExecutionResult, ExecutionTestCase } from '@code-arena/shared';
import { evaluateSubmission, type ExecuteFn } from '../src/services/evaluation';
import { executionRouter } from '../src/routers/execution';
import type { TestCaseStore } from '../src/services/test-case-store';

// Helper to create mock Judge0 execution responses
function makeMockExecution(overrides: Partial<ExecutionResult> = {}): { success: true; result: ExecutionResult } {
  return {
    success: true,
    result: {
      stdout: '[0, 1]',
      stderr: null,
      compileOutput: null,
      message: null,
      exitCode: 0,
      exitSignal: null,
      time: '0.015',
      memory: 12000,
      status: { id: 3, description: 'Accepted' },
      isError: false,
      ...overrides,
    },
  };
}

describe('Secure Evaluation Engine', () => {
  const sampleProblem = {
    slug: 'two-sum',
    examples: [
      {
        id: 1,
        input: 'nums = [2, 7, 11, 15], target = 9',
        output: '[0, 1]',
        structuredInput: { nums: [2, 7, 11, 15], target: 9 },
      },
    ],
  };

  const secretInput = 'SECRET_HIDDEN_INPUT_DATA_XYZ';
  const secretOutput = 'SECRET_EXPECTED_OUTPUT_999';

  const mockJudgeCases: ExecutionTestCase[] = [
    {
      id: 'case-visible-1',
      orderIndex: 0,
      isVisible: true,
      input: 'nums = [3, 2, 4], target = 6',
      expectedOutput: '[1, 2]',
      structuredInput: { nums: [3, 2, 4], target: 6 },
    },
    {
      id: 'case-hidden-1',
      orderIndex: 1,
      isVisible: false,
      input: secretInput,
      expectedOutput: secretOutput,
      structuredInput: { nums: [100, 200], target: 300 },
    },
    {
      id: 'case-hidden-2',
      orderIndex: 2,
      isVisible: false,
      input: 'SECRET_HIDDEN_CASE_2',
      expectedOutput: 'SECRET_OUTPUT_2',
      structuredInput: { nums: [500, 500], target: 1000 },
    },
  ];

  it('evaluates legacy problems without judge cases as SAMPLES_ONLY and never returns ACCEPTED', async () => {
    const mockExecute: ExecuteFn = async () => makeMockExecution({ stdout: '[0, 1]' });

    const outcome = await evaluateSubmission({
      problem: sampleProblem,
      judgeCases: [],
      language: 'python',
      sourceCode: 'class Solution: pass',
      execute: mockExecute,
    });

    assert.equal(outcome.verdict, 'SAMPLE_PASSED');
    assert.notEqual(outcome.verdict, 'ACCEPTED');
    assert.equal(outcome.evaluationMode, 'SAMPLES_ONLY');
    assert.equal(outcome.success, true);
    assert.equal(outcome.passedCases, 1);
    assert.equal(outcome.totalCases, 1);
    assert.equal(outcome.evaluations.length, 1);
    assert.equal(outcome.hiddenCases, undefined);
  });

  it('returns ACCEPTED only when all visible and hidden cases pass in FULL mode', async () => {
    // Mock that returns matching expected outputs for each call
    const calls: string[] = [];
    const mockExecute: ExecuteFn = async (params) => {
      calls.push(params.sourceCode);
      if (calls.length === 1) return makeMockExecution({ stdout: '[0, 1]' });
      if (calls.length === 2) return makeMockExecution({ stdout: '[1, 2]' });
      if (calls.length === 3) return makeMockExecution({ stdout: secretOutput });
      return makeMockExecution({ stdout: 'SECRET_OUTPUT_2' });
    };

    const outcome = await evaluateSubmission({
      problem: sampleProblem,
      judgeCases: mockJudgeCases,
      language: 'python',
      sourceCode: 'class Solution: pass',
      execute: mockExecute,
    });

    assert.equal(outcome.verdict, 'ACCEPTED');
    assert.equal(outcome.evaluationMode, 'FULL');
    assert.equal(outcome.success, true);
    assert.equal(outcome.totalCases, 4); // 1 problem example + 1 visible judge case + 2 hidden judge cases
    assert.equal(outcome.passedCases, 4);

    // Visible evaluations only: length must equal visible count (2)
    assert.equal(outcome.evaluations.length, 2);

    // Hidden cases summary
    assert.ok(outcome.hiddenCases);
    assert.equal(outcome.hiddenCases.total, 2);
    assert.equal(outcome.hiddenCases.passed, 2);
    assert.equal(outcome.hiddenCases.results.length, 2);
    assert.equal(outcome.hiddenCases.results[0].outcome, 'PASSED');
    assert.equal(outcome.hiddenCases.results[1].outcome, 'PASSED');
  });

  it('STRICT CONFIDENTIALITY: Never leaks hidden input or output in JSON response', async () => {
    let callNum = 0;
    const mockExecute: ExecuteFn = async () => {
      callNum++;
      if (callNum === 1) return makeMockExecution({ stdout: '[0, 1]' });
      if (callNum === 2) return makeMockExecution({ stdout: '[1, 2]' });
      return makeMockExecution({ stdout: secretOutput });
    };

    const outcome = await evaluateSubmission({
      problem: sampleProblem,
      judgeCases: mockJudgeCases,
      language: 'python',
      sourceCode: 'class Solution: pass',
      execute: mockExecute,
    });

    const serialized = JSON.stringify(outcome);
    assert.equal(serialized.includes(secretInput), false, 'Hidden input MUST NOT leak into serialized response');
    assert.equal(serialized.includes(secretOutput), false, 'Hidden expected output MUST NOT leak into serialized response');
    assert.equal(serialized.includes('SECRET_HIDDEN_CASE_2'), false);
    assert.equal(serialized.includes('SECRET_OUTPUT_2'), false);

    // Ensure hiddenCases results do NOT carry input or output fields
    for (const hResult of outcome.hiddenCases?.results || []) {
      const untyped = hResult as Record<string, unknown>;
      assert.equal(untyped.input, undefined);
      assert.equal(untyped.expectedOutput, undefined);
      assert.equal(untyped.actualOutput, undefined);
      assert.equal(untyped.stdout, undefined);
      assert.equal(untyped.stderr, undefined);
    }
  });

  it('yields WRONG_ANSWER and stops when a hidden case fails to match expected output', async () => {
    let callIndex = 0;
    const mockExecute: ExecuteFn = async () => {
      callIndex++;
      if (callIndex <= 2) {
        // Visible cases pass
        return makeMockExecution({ stdout: callIndex === 1 ? '[0, 1]' : '[1, 2]' });
      }
      if (callIndex === 3) {
        // First hidden case fails output match
        return makeMockExecution({ stdout: 'WRONG_RESULT_NOT_MATCHING' });
      }
      // Should NOT be reached (stops at first hidden failure)
      return makeMockExecution({ stdout: 'SECRET_OUTPUT_2' });
    };

    const outcome = await evaluateSubmission({
      problem: sampleProblem,
      judgeCases: mockJudgeCases,
      language: 'python',
      sourceCode: 'class Solution: pass',
      execute: mockExecute,
    });

    assert.equal(outcome.verdict, 'WRONG_ANSWER');
    assert.equal(outcome.success, false);
    assert.equal(outcome.passedCases, 2); // 2 visible passed
    assert.equal(callIndex, 3, 'Execution must stop after the first failing hidden case');

    assert.ok(outcome.hiddenCases);
    assert.equal(outcome.hiddenCases.passed, 0);
    assert.equal(outcome.hiddenCases.results[0].outcome, 'WRONG_ANSWER');
    assert.equal(outcome.hiddenCases.results[1].outcome, 'NOT_RUN');

    // No leakage even on wrong answer
    const serialized = JSON.stringify(outcome);
    assert.equal(serialized.includes(secretInput), false);
    assert.equal(serialized.includes(secretOutput), false);
    assert.equal(serialized.includes('WRONG_RESULT_NOT_MATCHING'), false);
  });

  it('does NOT run hidden cases if any visible case fails WRONG_ANSWER', async () => {
    let callCount = 0;
    const mockExecute: ExecuteFn = async () => {
      callCount++;
      return makeMockExecution({ stdout: 'INCORRECT_OUTPUT' });
    };

    const outcome = await evaluateSubmission({
      problem: sampleProblem,
      judgeCases: mockJudgeCases,
      language: 'python',
      sourceCode: 'class Solution: pass',
      execute: mockExecute,
    });

    assert.equal(outcome.verdict, 'WRONG_ANSWER');
    assert.equal(callCount, 2, 'Must evaluate visible cases but not proceed to hidden cases');
    assert.ok(outcome.hiddenCases);
    assert.equal(outcome.hiddenCases.results[0].outcome, 'NOT_RUN');
    assert.equal(outcome.hiddenCases.results[1].outcome, 'NOT_RUN');
  });

  it('redacts COMPILE_ERROR on hidden cases to prevent compiler error quoting hidden input', async () => {
    let callCount = 0;
    const mockExecute: ExecuteFn = async () => {
      callCount++;
      if (callCount <= 2) return makeMockExecution({ stdout: callCount === 1 ? '[0, 1]' : '[1, 2]' });
      return makeMockExecution({
        isError: true,
        errorType: 'compile_error',
        status: { id: 6, description: 'Compilation Error' },
        compileOutput: `error in line: ${secretInput}`,
      });
    };

    const outcome = await evaluateSubmission({
      problem: sampleProblem,
      judgeCases: mockJudgeCases,
      language: 'cpp',
      sourceCode: 'bad code',
      execute: mockExecute,
    });

    assert.equal(outcome.verdict, 'COMPILE_ERROR');
    assert.equal(outcome.success, false);
    assert.ok(outcome.hiddenCases);
    assert.equal(outcome.hiddenCases.results[0].outcome, 'COMPILE_ERROR');

    // The compiler output containing the secret input must NOT appear in the response!
    const serialized = JSON.stringify(outcome);
    assert.equal(serialized.includes(secretInput), false);
  });

  it('redacts RUNTIME_ERROR on hidden cases to prevent traceback quoting hidden input', async () => {
    let callCount = 0;
    const mockExecute: ExecuteFn = async () => {
      callCount++;
      if (callCount <= 2) return makeMockExecution({ stdout: callCount === 1 ? '[0, 1]' : '[1, 2]' });
      return makeMockExecution({
        isError: true,
        errorType: 'runtime_error',
        status: { id: 11, description: 'Runtime Error (NZEC)' },
        stderr: `Traceback: ValueError with value ${secretInput}`,
      });
    };

    const outcome = await evaluateSubmission({
      problem: sampleProblem,
      judgeCases: mockJudgeCases,
      language: 'python',
      sourceCode: 'class Solution: pass',
      execute: mockExecute,
    });

    assert.equal(outcome.verdict, 'RUNTIME_ERROR');
    assert.ok(outcome.hiddenCases);
    assert.equal(outcome.hiddenCases.results[0].outcome, 'RUNTIME_ERROR');

    const serialized = JSON.stringify(outcome);
    assert.equal(serialized.includes(secretInput), false);
  });

  it('handles TIME_LIMIT_EXCEEDED on hidden cases without leaking', async () => {
    let callCount = 0;
    const mockExecute: ExecuteFn = async () => {
      callCount++;
      if (callCount <= 2) return makeMockExecution({ stdout: callCount === 1 ? '[0, 1]' : '[1, 2]' });
      return makeMockExecution({
        isError: true,
        errorType: 'time_limit',
        status: { id: 5, description: 'Time Limit Exceeded' },
      });
    };

    const outcome = await evaluateSubmission({
      problem: sampleProblem,
      judgeCases: mockJudgeCases,
      language: 'python',
      sourceCode: 'class Solution: pass',
      execute: mockExecute,
    });

    assert.equal(outcome.verdict, 'TIME_LIMIT_EXCEEDED');
    assert.ok(outcome.hiddenCases);
    assert.equal(outcome.hiddenCases.results[0].outcome, 'TIME_LIMIT_EXCEEDED');
  });

  it('handles Judge0 infrastructure failure on hidden case with generic safe message', async () => {
    let callCount = 0;
    const mockExecute: ExecuteFn = async () => {
      callCount++;
      if (callCount <= 2) return makeMockExecution({ stdout: callCount === 1 ? '[0, 1]' : '[1, 2]' });
      return {
        success: false,
        judge0Available: false,
        error: `Connection refused with internal dump containing ${secretInput}`,
      };
    };

    const outcome = await evaluateSubmission({
      problem: sampleProblem,
      judgeCases: mockJudgeCases,
      language: 'python',
      sourceCode: 'class Solution: pass',
      execute: mockExecute,
    });

    assert.equal(outcome.verdict, 'SERVICE_UNAVAILABLE');
    assert.equal(outcome.success, false);
    // Generic message must be used, not the raw error string
    assert.match(outcome.error || '', /execution service failed while running a hidden test case/i);

    const serialized = JSON.stringify(outcome);
    assert.equal(serialized.includes(secretInput), false);
  });
});

describe('End-to-End tRPC Execution Router with Judge Cases', () => {
  it('evaluates via tRPC caller with mock store: returns ACCEPTED for all pass, WRONG_ANSWER on hidden fail', async () => {
    const mockCases: ExecutionTestCase[] = [
      {
        id: 'tc-h1',
        orderIndex: 0,
        isVisible: false,
        input: 'nums = [1, 5, 9], target = 10',
        expectedOutput: '[0,2]',
        structuredInput: { nums: [1, 5, 9], target: 10 },
      },
    ];

    const mockStore: TestCaseStore = {
      async listForEvaluation() {
        return mockCases;
      },
      async listForProblem() {
        return [];
      },
      async problemExists() {
        return true;
      },
      async create() {
        throw new Error('not implemented');
      },
      async update() {
        throw new Error('not implemented');
      },
      async remove() {
        throw new Error('not implemented');
      },
    };

    // Correct Two Sum code
    const correctCode = `
class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        lookup = {}
        for i, n in enumerate(nums):
            diff = target - n
            if diff in lookup:
                return [lookup[diff], i]
            lookup[n] = i
        return []
`;

    // Code that passes sample cases but fails the hidden case [1, 5, 9] target 10
    const incorrectCode = `
class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        # hardcode sample cases
        if target == 9: return [0, 1]
        if target == 6 and len(nums) == 3: return [1, 2]
        if target == 6 and len(nums) == 2: return [0, 1]
        return [0, 0] # fail hidden case
`;

    const caller = executionRouter.createCaller({ testCaseStore: mockStore });

    // 1. Submit correct code: evaluates sample cases + 1 hidden case
    const passRes = await caller.submit({
      problemSlug: 'two-sum',
      sourceCode: correctCode,
      language: 'python',
    });

    assert.equal(passRes.success, true);
    assert.equal(passRes.verdict, 'ACCEPTED');
    assert.equal(passRes.totalCases, 4); // 3 sample cases + 1 hidden case
    assert.equal(passRes.passedCases, 4);
    assert.ok(passRes.hiddenCases);
    assert.equal(passRes.hiddenCases.total, 1);
    assert.equal(passRes.hiddenCases.passed, 1);

    // 2. Submit cheat code that passes samples but fails hidden case
    const failRes = await caller.submit({
      problemSlug: 'two-sum',
      sourceCode: incorrectCode,
      language: 'python',
    });

    assert.equal(failRes.success, false);
    assert.equal(failRes.verdict, 'WRONG_ANSWER');
    assert.equal(failRes.passedCases, 3); // 3 samples passed, hidden failed
    assert.ok(failRes.hiddenCases);
    assert.equal(failRes.hiddenCases.passed, 0);
    assert.equal(failRes.hiddenCases.results[0].outcome, 'WRONG_ANSWER');

    // 3. Confirm execution.run cannot be called with hidden test case
    // execution.run only takes sample index (e.g. 0) or custom input, never hidden case IDs
    const runRes = await caller.run({
      problemSlug: 'two-sum',
      sourceCode: correctCode,
      language: 'python',
      testCaseIndex: 0,
    });
    assert.equal(runRes.success, true);
    assert.ok(runRes.testCaseEvaluation);
    assert.equal(runRes.testCaseEvaluation.isMatched, true);
  });
});
