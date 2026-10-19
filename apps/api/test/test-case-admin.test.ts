import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TRPCError } from '@trpc/server';
import type { TestCase } from '@code-arena/shared';
import { testCaseAdminRouter } from '../src/routers/test-case-admin';
import type { TestCaseStore, CreateTestCaseData, UpdateTestCaseData } from '../src/services/test-case-store';

function createMockStore(initialCases: TestCase[] = []): TestCaseStore & { cases: TestCase[] } {
  const cases = [...initialCases];
  return {
    cases,
    async listForEvaluation(problemId) {
      return cases.filter((item) => item.problemId === problemId).map((item) => ({
        id: item.id,
        orderIndex: item.orderIndex,
        isVisible: item.isVisible,
        input: item.input,
        structuredInput: item.structuredInput,
        expectedOutput: item.expectedOutput,
      }));
    },
    async listForProblem(problemId) {
      return cases.filter((item) => item.problemId === problemId);
    },
    async problemExists(problemId) {
      return problemId === 'prob-1' || problemId === 'two-sum';
    },
    async create(data: CreateTestCaseData) {
      const created: TestCase = {
        id: `case-${cases.length + 1}`,
        problemId: data.problemId,
        orderIndex: data.orderIndex ?? 0,
        isVisible: data.isVisible,
        input: data.input,
        structuredInput: data.structuredInput ?? undefined,
        expectedOutput: data.expectedOutput,
        explanation: data.explanation ?? undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      cases.push(created);
      return created;
    },
    async update(id: string, data: UpdateTestCaseData) {
      const index = cases.findIndex((item) => item.id === id);
      if (index < 0) return null;
      cases[index] = { ...cases[index], ...data, updatedAt: new Date() };
      return cases[index];
    },
    async remove(id: string) {
      const index = cases.findIndex((item) => item.id === id);
      if (index < 0) return false;
      cases.splice(index, 1);
      return true;
    },
  };
}

const learnerContext = (store: TestCaseStore) => ({
  userId: 'learner-1',
  role: 'STUDENT' as const,
  testCaseStore: store,
});

const mentorContext = (store: TestCaseStore) => ({
  userId: 'mentor-1',
  role: 'INSTRUCTOR' as const,
  testCaseStore: store,
});

describe('Test Case Admin Router', () => {
  it('rejects unauthenticated callers', async () => {
    const caller = testCaseAdminRouter.createCaller({ testCaseStore: createMockStore() });
    await assert.rejects(
      () => caller.list({ problemId: 'prob-1' }),
      (error: unknown) => error instanceof TRPCError && error.code === 'UNAUTHORIZED'
    );
  });

  it('rejects learners with FORBIDDEN', async () => {
    const caller = testCaseAdminRouter.createCaller(learnerContext(createMockStore()));
    await assert.rejects(
      () => caller.list({ problemId: 'prob-1' }),
      (error: unknown) => error instanceof TRPCError && error.code === 'FORBIDDEN'
    );
  });

  it('allows mentors to list, create, update, and delete test cases', async () => {
    const store = createMockStore();
    const caller = testCaseAdminRouter.createCaller(mentorContext(store));

    assert.equal((await caller.list({ problemId: 'prob-1' })).length, 0);
    const visible = await caller.create({
      problemId: 'prob-1',
      isVisible: true,
      input: 'nums = [1, 2], target = 3',
      expectedOutput: '[0, 1]',
      explanation: '1 + 2 = 3',
      orderIndex: 0,
    });
    const hidden = await caller.create({
      problemId: 'prob-1',
      input: 'nums = [10, 20], target = 30',
      expectedOutput: '[0, 1]',
      structuredInput: { nums: [10, 20], target: 30 },
    });

    assert.equal(visible.isVisible, true);
    assert.equal(hidden.isVisible, false);
    assert.equal((await caller.list({ problemId: 'prob-1' })).length, 2);
    assert.equal((await caller.update({ id: hidden.id, expectedOutput: '[1, 0]' })).expectedOutput, '[1, 0]');
    assert.deepEqual(await caller.delete({ id: hidden.id }), { id: hidden.id, deleted: true });
    assert.deepEqual((await caller.list({ problemId: 'prob-1' })).map((item) => item.id), [visible.id]);
  });

  it('allows admins and rejects invalid requests for mentors', async () => {
    const caller = testCaseAdminRouter.createCaller({
      userId: 'admin-1',
      role: 'ADMIN',
      testCaseStore: createMockStore(),
    });
    await assert.rejects(
      () => caller.create({ problemId: 'missing', input: '1', expectedOutput: '2' }),
      (error: unknown) => error instanceof TRPCError && error.code === 'NOT_FOUND'
    );
    await assert.rejects(() => caller.create({ problemId: '', input: '1', expectedOutput: '2' }));
    await assert.rejects(() => caller.create({
      problemId: 'prob-1',
      input: 'x'.repeat(256 * 1024 + 10),
      expectedOutput: '2',
    }));
  });
});
