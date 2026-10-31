import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import type { ExecutionTestCase, TestCase, TestCaseEvaluation } from '@code-arena/shared';
import type { SubmissionStore, CreateSubmissionParams, ListSubmissionsFilters } from '../src/services/submission-store';
import type { TestCaseStore } from '../src/services/test-case-store';
import type { SubmissionSelect } from '@code-arena/db';
import { executionRouter } from '../src/routers/execution';

// In-memory Submission Store for tests
class MockSubmissionStore implements SubmissionStore {
  submissions: SubmissionSelect[] = [];

  async create(params: CreateSubmissionParams): Promise<SubmissionSelect> {
    const row: SubmissionSelect = {
      id: params.id || `sub_${randomUUID()}`,
      userId: params.userId,
      problemId: params.problemId,
      language: params.language,
      code: params.code,
      verdict: params.verdict,
      passedCases: params.passedCases,
      totalCases: params.totalCases,
      executionTime: params.executionTime ?? null,
      memory: params.memory != null ? Math.round(params.memory) : null,
      error: params.error ?? null,
      evaluations: params.evaluations ?? [],
      createdAt: new Date(),
    };
    this.submissions.push(row);
    return row;
  }

  async getById(id: string): Promise<SubmissionSelect | null> {
    return this.submissions.find((s) => s.id === id) || null;
  }

  async listByUser(userId: string, filters: ListSubmissionsFilters = {}): Promise<SubmissionSelect[]> {
    let list = this.submissions.filter((s) => s.userId === userId);
    if (filters.problemId) {
      list = list.filter((s) => s.problemId === filters.problemId);
    }
    return list;
  }
}

// In-memory TestCaseStore for tests
class MockTestCaseStore implements TestCaseStore {
  testCases: ExecutionTestCase[] = [];

  async listForEvaluation(problemId: string): Promise<ExecutionTestCase[]> {
    return this.testCases;
  }

  async listForProblem(problemId: string): Promise<TestCase[]> {
    return [];
  }

  async problemExists(problemId: string): Promise<boolean> {
    return true;
  }

  async create(): Promise<TestCase> {
    throw new Error('Not implemented');
  }

  async update(): Promise<TestCase | null> {
    return null;
  }

  async remove(): Promise<boolean> {
    return false;
  }
}

describe('Worker Orchestration — API Integration', () => {
  const secretInput = 'SECRET_HIDDEN_INPUT_998877';
  const secretOutput = 'SECRET_HIDDEN_OUTPUT_112233';

  const mockTwoSumCases: ExecutionTestCase[] = [
    {
      id: 'case-visible-1',
      orderIndex: 0,
      isVisible: true,
      input: '2 7\n',
      expectedOutput: '9',
    },
    {
      id: 'case-visible-2',
      orderIndex: 1,
      isVisible: true,
      input: '3 4\n',
      expectedOutput: '7',
    },
    {
      id: 'case-hidden-1',
      orderIndex: 2,
      isVisible: false,
      input: secretInput,
      expectedOutput: secretOutput,
    },
  ];

  const pythonSumCode = `import sys
lines = sys.stdin.read().strip().split()
if len(lines) >= 2:
    a, b = int(lines[0]), int(lines[1])
    print(a + b)
elif lines:
    print("SECRET_HIDDEN_OUTPUT_112233")
`;

  it('1. Running one selected visible sample test case', async () => {
    const store = new MockTestCaseStore();
    store.testCases = [...mockTwoSumCases];

    const caller = executionRouter.createCaller({
      executionEngine: 'worker',
      user: { id: 'usr_student_1', role: 'STUDENT' },
      testCaseStore: store,
      skipRateLimit: true,
    });

    const res = await caller.run({
      problemSlug: 'two-sum',
      language: 'python',
      sourceCode: pythonSumCode,
      testCaseId: 'case-visible-1',
    });

    assert.equal(res.success, true);
    assert.equal(res.language, 'python');
    assert.ok(res.testCaseEvaluation);
    assert.equal(res.testCaseEvaluation.isMatched, true);
    assert.equal(res.testCaseEvaluation.actualOutput?.trim(), '9');
  });

  it('2. Running all visible samples when no sample is selected', async () => {
    const store = new MockTestCaseStore();
    store.testCases = [...mockTwoSumCases];

    const caller = executionRouter.createCaller({
      executionEngine: 'worker',
      user: { id: 'usr_student_1', role: 'STUDENT' },
      testCaseStore: store,
      skipRateLimit: true,
    });

    const res = await caller.run({
      problemSlug: 'two-sum',
      language: 'python',
      sourceCode: pythonSumCode,
    });

    assert.equal(res.success, true);
    assert.ok(res.testCaseEvaluation);
    assert.equal(res.testCaseEvaluation.isMatched, true);
  });

  it('3. Rejecting a selected hidden test case', async () => {
    const store = new MockTestCaseStore();
    store.testCases = [...mockTwoSumCases];

    const caller = executionRouter.createCaller({
      executionEngine: 'worker',
      user: { id: 'usr_student_1', role: 'STUDENT' },
      testCaseStore: store,
      skipRateLimit: true,
    });

    await assert.rejects(
      async () => {
        await caller.run({
          problemSlug: 'two-sum',
          language: 'python',
          sourceCode: pythonSumCode,
          testCaseId: 'case-hidden-1',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof TRPCError);
        assert.equal(err.code, 'FORBIDDEN');
        assert.match(err.message, /Cannot execute a hidden test case/);
        return true;
      }
    );
  });

  it('4. Rejecting a test case belonging to another problem', async () => {
    const store = new MockTestCaseStore();
    store.testCases = [...mockTwoSumCases];

    const caller = executionRouter.createCaller({
      executionEngine: 'worker',
      user: { id: 'usr_student_1', role: 'STUDENT' },
      testCaseStore: store,
      skipRateLimit: true,
    });

    await assert.rejects(
      async () => {
        await caller.run({
          problemSlug: 'two-sum',
          language: 'python',
          sourceCode: pythonSumCode,
          testCaseId: 'foreign-case-999',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof TRPCError);
        assert.equal(err.code, 'NOT_FOUND');
        assert.match(err.message, /not found/);
        return true;
      }
    );
  });

  it('5. Submitting against the complete server-owned test suite', async () => {
    const store = new MockTestCaseStore();
    store.testCases = [...mockTwoSumCases];
    const subStore = new MockSubmissionStore();

    const caller = executionRouter.createCaller({
      executionEngine: 'worker',
      user: { id: 'usr_student_1', role: 'STUDENT' },
      testCaseStore: store,
      submissionStore: subStore,
      skipRateLimit: true,
    });

    const res = await caller.submit({
      problemSlug: 'two-sum',
      language: 'python',
      sourceCode: pythonSumCode,
    });

    assert.equal(res.success, true);
    assert.equal(res.verdict, 'ACCEPTED');
    assert.equal(res.totalCases, 3);
    assert.equal(res.passedCases, 3);
  });

  it('6. Ensuring hidden test data never appears in API responses', async () => {
    const store = new MockTestCaseStore();
    store.testCases = [...mockTwoSumCases];
    const subStore = new MockSubmissionStore();

    const caller = executionRouter.createCaller({
      executionEngine: 'worker',
      user: { id: 'usr_student_1', role: 'STUDENT' },
      testCaseStore: store,
      submissionStore: subStore,
      skipRateLimit: true,
    });

    const res = await caller.submit({
      problemSlug: 'two-sum',
      language: 'python',
      sourceCode: pythonSumCode,
    });

    // 1. Visible evaluations only contains the 2 visible cases
    assert.equal(res.evaluations.length, 2);
    for (const ev of res.evaluations) {
      assert.notEqual(ev.input, secretInput);
      assert.notEqual(ev.expectedOutput, secretOutput);
      assert.notEqual(ev.actualOutput, secretOutput);
    }

    // 2. Hidden cases summary carries NO input or output
    assert.ok(res.hiddenCases);
    assert.equal(res.hiddenCases.total, 1);
    assert.equal(res.hiddenCases.passed, 1);
    assert.equal(res.hiddenCases.results.length, 1);

    const hiddenSummary = res.hiddenCases.results[0] as any;
    assert.equal(hiddenSummary.input, undefined);
    assert.equal(hiddenSummary.expectedOutput, undefined);
    assert.equal(hiddenSummary.actualOutput, undefined);
    assert.equal(hiddenSummary.stderr, undefined);

    // 3. Stringified JSON carries zero secret leaks
    const serialized = JSON.stringify(res);
    assert.equal(serialized.includes(secretInput), false);
    assert.equal(serialized.includes(secretOutput), false);
  });

  it('7. Rejecting unauthenticated execution requests', async () => {
    const caller = executionRouter.createCaller({
      executionEngine: 'worker',
      user: undefined, // Unauthenticated
      skipRateLimit: true,
    });

    await assert.rejects(
      async () => {
        await caller.run({
          problemSlug: 'two-sum',
          language: 'python',
          sourceCode: 'print(1)',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof TRPCError);
        assert.equal(err.code, 'UNAUTHORIZED');
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await caller.submit({
          problemSlug: 'two-sum',
          language: 'python',
          sourceCode: 'print(1)',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof TRPCError);
        assert.equal(err.code, 'UNAUTHORIZED');
        return true;
      }
    );
  });

  it('8. Supporting Python and C++', async () => {
    const store = new MockTestCaseStore();
    store.testCases = [
      {
        id: 'cpp-case-1',
        orderIndex: 0,
        isVisible: true,
        input: '10 20\n',
        expectedOutput: '30',
      },
    ];

    const caller = executionRouter.createCaller({
      executionEngine: 'worker',
      user: { id: 'usr_student_cpp', role: 'STUDENT' },
      testCaseStore: store,
      skipRateLimit: true,
    });

    const cppCode = `#include <iostream>
int main() {
    int a, b;
    if (std::cin >> a >> b) {
        std::cout << (a + b) << std::endl;
    }
    return 0;
}
`;

    const res = await caller.run({
      problemSlug: 'two-sum',
      language: 'cpp',
      sourceCode: cppCode,
    });

    assert.equal(res.success, true);
    assert.equal(res.language, 'cpp');
    assert.ok(res.testCaseEvaluation);
    assert.equal(res.testCaseEvaluation.actualOutput?.trim(), '30');
  });

  it('9. Correct persistence of submission results', async () => {
    const store = new MockTestCaseStore();
    store.testCases = [...mockTwoSumCases];
    const subStore = new MockSubmissionStore();

    const caller = executionRouter.createCaller({
      executionEngine: 'worker',
      user: { id: 'usr_student_persisted', role: 'STUDENT' },
      testCaseStore: store,
      submissionStore: subStore,
      skipRateLimit: true,
    });

    const res = await caller.submit({
      problemSlug: 'two-sum',
      language: 'python',
      sourceCode: pythonSumCode,
    });

    assert.equal(res.persisted, true);
    assert.ok(typeof res.submissionId === 'string');

    // Verify row in submission store
    assert.equal(subStore.submissions.length, 1);
    const saved = subStore.submissions[0];
    assert.equal(saved.userId, 'usr_student_persisted');
    assert.equal(saved.verdict, 'ACCEPTED');
    assert.equal(saved.totalCases, 3);
    assert.equal(saved.passedCases, 3);
    assert.equal(saved.evaluations.length, 2); // Visible evaluations only
  });
});
