import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TRPCError } from '@trpc/server';
import type { TestCase } from '@code-arena/shared';
import { testCaseAdminRouter } from '../src/routers/test-case-admin';
import type { TestCaseStore, CreateTestCaseData, UpdateTestCaseData } from '../src/services/test-case-store';
import { MIN_ADMIN_TOKEN_LENGTH } from '../src/services/admin-auth';

function createMockStore(initialCases: TestCase[] = []): TestCaseStore & { cases: TestCase[] } {
  const cases: TestCase[] = [...initialCases];
  return {
    cases,
    async listForEvaluation(problemId) {
      return cases
        .filter((c) => c.problemId === problemId)
        .map((c) => ({
          id: c.id,
          orderIndex: c.orderIndex,
          isVisible: c.isVisible,
          input: c.input,
          structuredInput: c.structuredInput,
          expectedOutput: c.expectedOutput,
        }));
    },
    async listForProblem(problemId) {
      return cases.filter((c) => c.problemId === problemId);
    },
    async problemExists(problemId) {
      return problemId === 'prob-1' || problemId === 'two-sum';
    },
    async create(data: CreateTestCaseData) {
      const newCase: TestCase = {
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
      cases.push(newCase);
      return newCase;
    },
    async update(id: string, data: UpdateTestCaseData) {
      const idx = cases.findIndex((c) => c.id === id);
      if (idx === -1) return null;
      cases[idx] = {
        ...cases[idx],
        ...data,
        structuredInput: data.structuredInput === null ? undefined : (data.structuredInput ?? cases[idx].structuredInput),
        explanation: data.explanation === null ? undefined : (data.explanation ?? cases[idx].explanation),
        updatedAt: new Date(),
      };
      return cases[idx];
    },
    async remove(id: string) {
      const idx = cases.findIndex((c) => c.id === id);
      if (idx === -1) return false;
      cases.splice(idx, 1);
      return true;
    },
  };
}

describe('Test Case Admin Router', () => {
  const validToken = 'x'.repeat(MIN_ADMIN_TOKEN_LENGTH);
  const originalEnvToken = process.env.ADMIN_API_TOKEN;

  // Setup / teardown token
  const setToken = (tok?: string) => {
    if (tok === undefined) delete process.env.ADMIN_API_TOKEN;
    else process.env.ADMIN_API_TOKEN = tok;
  };

  it('rejects all calls with FORBIDDEN when ADMIN_API_TOKEN is not configured', async () => {
    setToken(undefined);
    const store = createMockStore();
    const caller = testCaseAdminRouter.createCaller({
      authorization: 'Bearer ' + validToken,
      testCaseStore: store,
    });

    await assert.rejects(
      async () => {
        await caller.list({ problemId: 'prob-1' });
      },
      (err: unknown) => {
        assert.ok(err instanceof TRPCError);
        assert.equal(err.code, 'FORBIDDEN');
        assert.match(err.message, /disabled/i);
        return true;
      }
    );
  });

  it('rejects unauthenticated calls with UNAUTHORIZED when token is missing', async () => {
    setToken(validToken);
    try {
      const store = createMockStore();
      const caller = testCaseAdminRouter.createCaller({
        authorization: null,
        testCaseStore: store,
      });

      await assert.rejects(
        async () => {
          await caller.list({ problemId: 'prob-1' });
        },
        (err: unknown) => {
          assert.ok(err instanceof TRPCError);
          assert.equal(err.code, 'UNAUTHORIZED');
          return true;
        }
      );
    } finally {
      setToken(originalEnvToken);
    }
  });

  it('rejects invalid credentials with UNAUTHORIZED', async () => {
    setToken(validToken);
    try {
      const store = createMockStore();
      const caller = testCaseAdminRouter.createCaller({
        authorization: 'Bearer wrong-secret-token-key-1234567890',
        testCaseStore: store,
      });

      await assert.rejects(
        async () => {
          await caller.list({ problemId: 'prob-1' });
        },
        (err: unknown) => {
          assert.ok(err instanceof TRPCError);
          assert.equal(err.code, 'UNAUTHORIZED');
          return true;
        }
      );
    } finally {
      setToken(originalEnvToken);
    }
  });

  it('allows authorized admin to list, create, update, and delete test cases', async () => {
    setToken(validToken);
    try {
      const store = createMockStore();
      const caller = testCaseAdminRouter.createCaller({
        authorization: `Bearer ${validToken}`,
        testCaseStore: store,
      });

      // 1. Initially empty
      const initial = await caller.list({ problemId: 'prob-1' });
      assert.equal(initial.length, 0);

      // 2. Create visible case
      const createdVis = await caller.create({
        problemId: 'prob-1',
        isVisible: true,
        input: 'nums = [1, 2], target = 3',
        expectedOutput: '[0, 1]',
        explanation: '1 + 2 = 3',
        orderIndex: 0,
      });
      assert.equal(createdVis.problemId, 'prob-1');
      assert.equal(createdVis.isVisible, true);
      assert.equal(createdVis.expectedOutput, '[0, 1]');

      // 3. Create hidden case (defaults to isVisible: false)
      const createdHidden = await caller.create({
        problemId: 'prob-1',
        input: 'nums = [10, 20], target = 30',
        expectedOutput: '[0, 1]',
        structuredInput: { nums: [10, 20], target: 30 },
      });
      assert.equal(createdHidden.isVisible, false);

      // 4. List returns both cases
      const listed = await caller.list({ problemId: 'prob-1' });
      assert.equal(listed.length, 2);

      // 5. Update case
      const updated = await caller.update({
        id: createdHidden.id,
        expectedOutput: '[1, 0]',
      });
      assert.equal(updated.expectedOutput, '[1, 0]');

      // 6. Delete case
      const deleted = await caller.delete({ id: createdHidden.id });
      assert.equal(deleted.deleted, true);

      // 7. List now has 1 case
      const remaining = await caller.list({ problemId: 'prob-1' });
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0].id, createdVis.id);
    } finally {
      setToken(originalEnvToken);
    }
  });

  it('rejects creation for non-existent problem with NOT_FOUND', async () => {
    setToken(validToken);
    try {
      const store = createMockStore();
      const caller = testCaseAdminRouter.createCaller({
        authorization: `Bearer ${validToken}`,
        testCaseStore: store,
      });

      await assert.rejects(
        async () => {
          await caller.create({
            problemId: 'non-existent-problem',
            input: '1',
            expectedOutput: '2',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof TRPCError);
          assert.equal(err.code, 'NOT_FOUND');
          return true;
        }
      );
    } finally {
      setToken(originalEnvToken);
    }
  });

  it('rejects malformed create requests (empty fields, oversized payload)', async () => {
    setToken(validToken);
    try {
      const store = createMockStore();
      const caller = testCaseAdminRouter.createCaller({
        authorization: `Bearer ${validToken}`,
        testCaseStore: store,
      });

      // Empty problemId
      await assert.rejects(async () => {
        await caller.create({
          problemId: '',
          input: '1',
          expectedOutput: '2',
        });
      });

      // Oversized input (> 256KB)
      await assert.rejects(async () => {
        await caller.create({
          problemId: 'prob-1',
          input: 'x'.repeat(256 * 1024 + 10),
          expectedOutput: '2',
        });
      });
    } finally {
      setToken(originalEnvToken);
    }
  });
});
