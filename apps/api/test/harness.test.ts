import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MOCK_PROBLEMS } from '@code-arena/shared';
import {
  PROBLEM_CONTRACTS,
  buildExecutionHarness,
  parseRawInput,
  resolveStructuredInput,
  isStandaloneCode,
} from '../src/services/harness';
import { executeWithJudge0, compareOutputs } from '../src/services/judge0';
import { publishPracticeSamplePassed, getRecentActivity } from '../src/services/activity-feed';
import { executionRouter } from '../src/routers/execution';

describe('Execution Harness & Driver Unit Tests', () => {
  it('covers all eight existing mock problems with explicit contracts', () => {
    assert.equal(MOCK_PROBLEMS.length, 8);
    for (const problem of MOCK_PROBLEMS) {
      const contract = PROBLEM_CONTRACTS[problem.slug];
      assert.ok(
        contract,
        `Problem "${problem.slug}" must have a registered execution contract`
      );
      assert.equal(contract.slug, problem.slug);
      assert.ok(contract.methodName.length > 0);
      assert.ok(contract.args.length > 0);
      assert.ok(contract.returnType);
    }
  });

  it('builds valid Python and C++ harnesses for all 8 problems without throwing', () => {
    for (const problem of MOCK_PROBLEMS) {
      const example = problem.examples[0];
      assert.ok(example, `Problem ${problem.slug} must have at least one example`);

      // Python harness
      const pyHarness = buildExecutionHarness({
        problemSlug: problem.slug,
        language: 'python',
        sourceCode: problem.starterCode?.python || '',
        structuredInput: example.structuredInput,
        rawInput: example.input,
      });
      assert.equal(pyHarness.wasHarnessed, true, `Python harness failed for ${problem.slug}`);
      assert.ok(pyHarness.code.includes('from __future__ import annotations'));
      assert.ok(pyHarness.code.includes('__arena_sol = Solution()'));
      assert.ok(pyHarness.code.includes(pyHarness.contract!.methodName));

      // C++ harness
      const cppHarness = buildExecutionHarness({
        problemSlug: problem.slug,
        language: 'cpp',
        sourceCode: problem.starterCode?.cpp || '',
        structuredInput: example.structuredInput,
        rawInput: example.input,
      });
      assert.equal(cppHarness.wasHarnessed, true, `C++ harness failed for ${problem.slug}`);
      assert.ok(cppHarness.code.includes('int main()'));
      assert.ok(cppHarness.code.includes('Solution __arena_sol;'));
      assert.ok(cppHarness.code.includes(cppHarness.contract!.methodName));
    }
  });

  it('identifies standalone code and bypasses harness injection', () => {
    const cppStandalone = `#include <iostream>\nint main() { std::cout << "Hello"; return 0; }`;
    assert.equal(isStandaloneCode(cppStandalone, 'cpp'), true);

    const cppLeetCode = `class Solution { public: int add(int a, int b) { return a + b; } };`;
    assert.equal(isStandaloneCode(cppLeetCode, 'cpp'), false);

    const pyStandalone = `print("Hello from standalone script")`;
    assert.equal(isStandaloneCode(pyStandalone, 'python'), true);

    const pyLeetCode = `class Solution:\n    def twoSum(self, nums, target):\n        return []`;
    assert.equal(isStandaloneCode(pyLeetCode, 'python'), false);
  });

  it('falls back to string parsing when structuredInput is not provided', () => {
    const raw = 'nums = [2,7,11,15], target = 9';
    const parsed = parseRawInput(raw);
    assert.deepEqual(parsed, { nums: [2, 7, 11, 15], target: 9 });

    const rawString = 's = "abcabcbb"';
    assert.deepEqual(parseRawInput(rawString), { s: 'abcabcbb' });
  });
});

describe('Live Judge0 Sandbox Integration Tests', () => {
  it('correctly executes Python Two Sum and returns serialized [0,1]', async () => {
    const problem = MOCK_PROBLEMS.find((p) => p.slug === 'two-sum')!;
    const example = problem.examples[0];

    const studentCode = `
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

    const harness = buildExecutionHarness({
      problemSlug: 'two-sum',
      language: 'python',
      sourceCode: studentCode,
      structuredInput: example.structuredInput,
    });

    const exec = await executeWithJudge0({
      sourceCode: harness.code,
      language: 'python',
      stdin: '',
    });

    assert.equal(exec.success, true, `Execution failed: ${!exec.success && exec.error}`);
    if (exec.success) {
      assert.equal(exec.result.status.id, 3, 'Status must be Accepted (3)');
      assert.ok(compareOutputs(exec.result.stdout, example.output), `Expected ${example.output}, got ${exec.result.stdout}`);
    }
  });

  it('compiles and executes C++ Two Sum and returns serialized [0,1]', async () => {
    const problem = MOCK_PROBLEMS.find((p) => p.slug === 'two-sum')!;
    const example = problem.examples[0];

    const studentCode = `
#include <vector>
#include <unordered_map>

class Solution {
public:
    std::vector<int> twoSum(std::vector<int>& nums, int target) {
        std::unordered_map<int, int> lookup;
        for (int i = 0; i < (int)nums.size(); ++i) {
            int diff = target - nums[i];
            if (lookup.count(diff)) {
                return {lookup[diff], i};
            }
            lookup[nums[i]] = i;
        }
        return {};
    }
};
`;

    const harness = buildExecutionHarness({
      problemSlug: 'two-sum',
      language: 'cpp',
      sourceCode: studentCode,
      structuredInput: example.structuredInput,
    });

    const exec = await executeWithJudge0({
      sourceCode: harness.code,
      language: 'cpp',
      stdin: '',
    });

    assert.equal(exec.success, true, `Execution failed: ${!exec.success && exec.error}`);
    if (exec.success) {
      assert.equal(exec.result.status.id, 3, 'Status must be Accepted (3)');
      assert.ok(compareOutputs(exec.result.stdout, example.output), `Expected ${example.output}, got ${exec.result.stdout}`);
    }
  });

  it('correctly executes Python Reverse Linked List with custom ListNode', async () => {
    const problem = MOCK_PROBLEMS.find((p) => p.slug === 'reverse-linked-list')!;
    const example = problem.examples[0];

    const studentCode = `
class Solution:
    def reverseList(self, head):
        prev = None
        curr = head
        while curr:
            nxt = curr.next
            curr.next = prev
            prev = curr
            curr = nxt
        return prev
`;

    const harness = buildExecutionHarness({
      problemSlug: 'reverse-linked-list',
      language: 'python',
      sourceCode: studentCode,
      structuredInput: example.structuredInput,
    });

    const exec = await executeWithJudge0({
      sourceCode: harness.code,
      language: 'python',
      stdin: '',
    });

    assert.equal(exec.success, true);
    if (exec.success) {
      assert.equal(exec.result.status.id, 3);
      assert.ok(compareOutputs(exec.result.stdout, example.output));
    }
  });

  it('correctly executes C++ Reverse Linked List with ListNode preamble', async () => {
    const problem = MOCK_PROBLEMS.find((p) => p.slug === 'reverse-linked-list')!;
    const example = problem.examples[0];

    const studentCode = `
class Solution {
public:
    ListNode* reverseList(ListNode* head) {
        ListNode* prev = nullptr;
        ListNode* curr = head;
        while (curr) {
            ListNode* nxt = curr->next;
            curr->next = prev;
            prev = curr;
            curr = nxt;
        }
        return prev;
    }
};
`;

    const harness = buildExecutionHarness({
      problemSlug: 'reverse-linked-list',
      language: 'cpp',
      sourceCode: studentCode,
      structuredInput: example.structuredInput,
    });

    const exec = await executeWithJudge0({
      sourceCode: harness.code,
      language: 'cpp',
      stdin: '',
    });

    assert.equal(exec.success, true);
    if (exec.success) {
      assert.equal(exec.result.status.id, 3);
      assert.ok(compareOutputs(exec.result.stdout, example.output));
    }
  });

  it('returns syntax/runtime error for invalid Python syntax', async () => {
    const badCode = `class Solution:\n    def twoSum(: pass`;
    const harness = buildExecutionHarness({
      problemSlug: 'two-sum',
      language: 'python',
      sourceCode: badCode,
      structuredInput: { nums: [1, 2], target: 3 },
    });

    const exec = await executeWithJudge0({
      sourceCode: harness.code,
      language: 'python',
      stdin: '',
    });

    assert.equal(exec.success, true);
    if (exec.success) {
      assert.equal(exec.result.isError, true);
      assert.ok(exec.result.stderr && exec.result.stderr.includes('SyntaxError'));
    }
  });

  it('returns compilation error for invalid C++ syntax', async () => {
    const badCode = `class Solution { public: std::vector<int> twoSum( { return {}; } };`;
    const harness = buildExecutionHarness({
      problemSlug: 'two-sum',
      language: 'cpp',
      sourceCode: badCode,
      structuredInput: { nums: [1, 2], target: 3 },
    });

    const exec = await executeWithJudge0({
      sourceCode: harness.code,
      language: 'cpp',
      stdin: '',
    });

    assert.equal(exec.success, true);
    if (exec.success) {
      assert.equal(exec.result.status.id, 6, 'Should be Compilation Error (6)');
      assert.equal(exec.result.errorType, 'compile_error');
      assert.ok(exec.result.compileOutput && exec.result.compileOutput.length > 0);
    }
  });

  it('detects incorrect answer and yields mismatch verdict', async () => {
    const wrongCode = `
class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        return [99, 99]
`;
    const harness = buildExecutionHarness({
      problemSlug: 'two-sum',
      language: 'python',
      sourceCode: wrongCode,
      structuredInput: { nums: [2, 7, 11, 15], target: 9 },
    });

    const exec = await executeWithJudge0({
      sourceCode: harness.code,
      language: 'python',
      stdin: '',
    });

    assert.equal(exec.success, true);
    if (exec.success) {
      assert.equal(compareOutputs(exec.result.stdout, '[0,1]'), false);
    }
  });

  it('respects explicitly provided empty stdin instead of overriding with sample input', async () => {
    const standaloneCode = `
import sys
line = sys.stdin.read()
if line == "":
    print("EMPTY_STDIN_RECEIVED")
else:
    print("STDIN_NOT_EMPTY:", line)
`;

    const exec = await executeWithJudge0({
      sourceCode: standaloneCode,
      language: 'python',
      stdin: '',
    });

    assert.equal(exec.success, true);
    if (exec.success) {
      assert.ok(
        exec.result.stdout && exec.result.stdout.trim() === 'EMPTY_STDIN_RECEIVED',
        `Expected EMPTY_STDIN_RECEIVED, got: ${exec.result.stdout}`
      );
    }
  });

  it('preserves Live Game Layer activity event schema and subscription flow', () => {
    const beforeCount = getRecentActivity().length;
    const event = publishPracticeSamplePassed({
      slug: 'two-sum',
      title: 'Two Sum',
    });

    assert.ok(event.id);
    assert.equal(event.type, 'practice_sample_passed');
    assert.equal(event.problemSlug, 'two-sum');
    assert.equal(event.problemTitle, 'Two Sum');
    assert.ok(event.createdAt);

    const afterEvents = getRecentActivity();
    assert.equal(afterEvents.length, beforeCount + 1);
    assert.equal(afterEvents[0].id, event.id);
  });
});

describe('End-to-End tRPC Execution Router Tests', () => {
  const caller = executionRouter.createCaller({});

  const pythonTwoSumCode = `
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

  const cppTwoSumCode = `
#include <vector>
#include <unordered_map>

class Solution {
public:
    std::vector<int> twoSum(std::vector<int>& nums, int target) {
        std::unordered_map<int, int> lookup;
        for (int i = 0; i < (int)nums.size(); ++i) {
            int diff = target - nums[i];
            if (lookup.count(diff)) {
                return {lookup[diff], i};
            }
            lookup[nums[i]] = i;
        }
        return {};
    }
};
`;

  it('executes execution.run via tRPC and returns passing testCaseEvaluation', async () => {
    const response = await caller.run({
      problemSlug: 'two-sum',
      sourceCode: pythonTwoSumCode,
      language: 'python',
    });

    assert.equal(response.success, true);
    assert.equal(response.judge0Available, true);
    assert.equal(response.language, 'python');
    assert.ok(response.testCaseEvaluation);
    assert.equal(response.testCaseEvaluation.isMatched, true);
    assert.equal(response.testCaseEvaluation.caseIndex, 0);
  });

  it('executes execution.submit for Python Two Sum and returns SAMPLE_PASSED with 3/3 passed', async () => {
    const response = await caller.submit({
      problemSlug: 'two-sum',
      sourceCode: pythonTwoSumCode,
      language: 'python',
    });

    assert.equal(response.success, true);
    assert.equal(response.judge0Available, true);
    assert.equal(response.verdict, 'SAMPLE_PASSED');
    assert.equal(response.totalCases, 3);
    assert.equal(response.passedCases, 3);
    assert.equal(response.evaluations.length, 3);
    assert.ok(response.evaluations.every((ev) => ev.isMatched));
  });

  it('executes execution.submit for C++ Two Sum and returns SAMPLE_PASSED with 3/3 passed', async () => {
    const response = await caller.submit({
      problemSlug: 'two-sum',
      sourceCode: cppTwoSumCode,
      language: 'cpp',
    });

    assert.equal(response.success, true);
    assert.equal(response.judge0Available, true);
    assert.equal(response.verdict, 'SAMPLE_PASSED');
    assert.equal(response.totalCases, 3);
    assert.equal(response.passedCases, 3);
    assert.equal(response.evaluations.length, 3);
    assert.ok(response.evaluations.every((ev) => ev.isMatched));
  });
});
