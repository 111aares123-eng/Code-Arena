import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { ExecutionTestCase, TestCaseEvaluation } from '@code-arena/shared';
import { executionRouter } from '../src/routers/execution';
import type { TestCaseStore } from '../src/services/test-case-store';
import type {
  SubmissionStore,
  CreateSubmissionParams,
  ListSubmissionsFilters,
} from '../src/services/submission-store';
import {
  createSubmission,
  getSubmissionById,
  listSubmissionsByUser,
  type SubmissionSelect,
  type DatabaseInstance,
} from '@code-arena/db';

// In-memory submission store for hermetic testing
class MockSubmissionStore implements SubmissionStore {
  submissions: SubmissionSelect[] = [];
  shouldThrowOnCreate = false;

  async create(params: CreateSubmissionParams): Promise<SubmissionSelect> {
    if (this.shouldThrowOnCreate) {
      throw new Error('Database connection lost: ECONNREFUSED 5432');
    }

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
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    return list.slice(offset, offset + limit);
  }
}

describe('Persistent Submission History & Identity Isolation', () => {
  const secretHiddenInput = 'CONFIDENTIAL_INPUT_HIDDEN_TEST_99';
  const secretHiddenOutput = 'CONFIDENTIAL_OUTPUT_HIDDEN_TEST_99';

  const mockTestCases: ExecutionTestCase[] = [
    {
      id: 'tc-visible-1',
      orderIndex: 0,
      isVisible: true,
      input: 'nums = [2,7,11,15], target = 9',
      expectedOutput: '[0,1]',
      structuredInput: { nums: [2, 7, 11, 15], target: 9 },
    },
    {
      id: 'tc-hidden-1',
      orderIndex: 1,
      isVisible: false,
      input: secretHiddenInput,
      expectedOutput: secretHiddenOutput,
      structuredInput: { nums: [100, 200], target: 300 },
    },
  ];

  const mockTestCaseStore: TestCaseStore = {
    async listForEvaluation() {
      return mockTestCases;
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
      return null;
    },
    async remove() {
      return false;
    },
  };

  const correctSolutionCode = `
class Solution:
    def twoSum(self, nums, target):
        return [0, 1]
`.trim();

  function createMockJudge0Fetch(hiddenExpectedOutput = secretHiddenOutput) {
    const originalFetch = globalThis.fetch;
    return {
      install: () => {
        globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
          const urlStr = typeof url === 'string' ? url : url.toString();
          if (urlStr.includes('/submissions')) {
            const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
            const sourceCode = body.source_code ? Buffer.from(body.source_code, 'base64').toString('utf8') : '';

            let stdout = '[0,1]';
            if (sourceCode.includes(secretHiddenInput) || sourceCode.includes('300')) {
              stdout = hiddenExpectedOutput;
            } else if (sourceCode.includes('3,2,4') || sourceCode.includes('3, 2, 4')) {
              stdout = '[1,2]';
            } else if (sourceCode.includes('3,3') || sourceCode.includes('3, 3')) {
              stdout = '[0,1]';
            }

            const responseData = {
              stdout: Buffer.from(stdout).toString('base64'),
              stderr: null,
              compile_output: null,
              message: null,
              exit_code: 0,
              exit_signal: null,
              status: { id: 3, description: 'Accepted' },
              time: '0.018',
              memory: 14500,
            };
            return new Response(JSON.stringify(responseData), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return originalFetch(url, init);
        };
      },
      restore: () => {
        globalThis.fetch = originalFetch;
      },
    };
  }

  it('persists submission for an authenticated student with all required fields', async () => {
    const mockSubStore = new MockSubmissionStore();
    const mockFetch = createMockJudge0Fetch();
    mockFetch.install();

    try {
      const studentId = 'usr_student_alpha';
      const caller = executionRouter.createCaller({
        testCaseStore: mockTestCaseStore,
        submissionStore: mockSubStore,
        user: { id: studentId, role: 'STUDENT' },
      });

      const res = await caller.submit({
        problemSlug: 'two-sum',
        sourceCode: correctSolutionCode,
        language: 'python',
      });

      assert.equal(res.success, true);
      assert.equal(res.verdict, 'ACCEPTED');
      assert.equal(res.persisted, true);
      assert.ok(typeof res.submissionId === 'string' && res.submissionId.length > 0);

      // Verify row persisted in storage
      assert.equal(mockSubStore.submissions.length, 1);
      const stored = mockSubStore.submissions[0];
      assert.equal(stored.id, res.submissionId);
      assert.equal(stored.userId, studentId);
      assert.equal(stored.problemId, 'prob-001');
      assert.equal(stored.language, 'python');
      assert.equal(stored.code, correctSolutionCode);
      assert.equal(stored.verdict, 'ACCEPTED');
      assert.equal(stored.passedCases, 4); // 3 visible samples + 1 hidden case
      assert.equal(stored.totalCases, 4);
      assert.equal(stored.executionTime, res.executionTime);
      assert.equal(stored.memory, res.memory);
      assert.equal(stored.error, null);

      // Verify CONFIDENTIALITY: stored evaluations must NOT contain hidden test cases
      assert.ok(Array.isArray(stored.evaluations));
      const storedEvalJson = JSON.stringify(stored.evaluations);
      assert.ok(!storedEvalJson.includes(secretHiddenInput), 'Hidden input leaked into persisted evaluations');
      assert.ok(!storedEvalJson.includes(secretHiddenOutput), 'Hidden output leaked into persisted evaluations');
    } finally {
      mockFetch.restore();
    }
  });

  it('does NOT persist submissions for anonymous students to avoid fake user assignments', async () => {
    const mockSubStore = new MockSubmissionStore();
    const mockFetch = createMockJudge0Fetch();
    mockFetch.install();

    try {
      // Anonymous caller: no ctx.user
      const anonymousCaller = executionRouter.createCaller({
        testCaseStore: mockTestCaseStore,
        submissionStore: mockSubStore,
        user: undefined,
      });

      const res = await anonymousCaller.submit({
        problemSlug: 'two-sum',
        sourceCode: correctSolutionCode,
        language: 'python',
      });

      // Evaluation succeeds and returns verdict
      assert.equal(res.success, true);
      assert.equal(res.verdict, 'ACCEPTED');
      // Persistence is cleanly bypassed rather than polluting DB with fake users
      assert.equal(res.persisted, false);
      assert.equal(res.submissionId, null);

      // ZERO submissions saved to the store
      assert.equal(mockSubStore.submissions.length, 0);
    } finally {
      mockFetch.restore();
    }
  });

  it('protects evaluation verdicts against database failures: verdict is never corrupted', async () => {
    const failingStore = new MockSubmissionStore();
    failingStore.shouldThrowOnCreate = true;
    const mockFetch = createMockJudge0Fetch();
    mockFetch.install();

    try {
      const caller = executionRouter.createCaller({
        testCaseStore: mockTestCaseStore,
        submissionStore: failingStore,
        user: { id: 'usr_student_alpha', role: 'STUDENT' },
      });

      const res = await caller.submit({
        problemSlug: 'two-sum',
        sourceCode: correctSolutionCode,
        language: 'python',
      });

      // Crucial requirement: verdict remains ACCEPTED even when database persistence throws!
      assert.equal(res.success, true);
      assert.equal(res.verdict, 'ACCEPTED');
      assert.equal(res.persisted, false);
      assert.equal(res.submissionId, null);
    } finally {
      mockFetch.restore();
    }
  });

  it('enforces student identity isolation on submission history and individual lookup', async () => {
    const mockSubStore = new MockSubmissionStore();
    await mockSubStore.create({
      id: 'sub_alpha_1',
      userId: 'usr_student_alpha',
      problemId: 'prob-001',
      language: 'python',
      code: 'print("Alpha code")',
      verdict: 'ACCEPTED',
      passedCases: 4,
      totalCases: 4,
      executionTime: '0.02',
      memory: 10000,
      evaluations: [],
    });

    await mockSubStore.create({
      id: 'sub_beta_1',
      userId: 'usr_student_beta',
      problemId: 'prob-001',
      language: 'cpp',
      code: '// Beta code',
      verdict: 'WRONG_ANSWER',
      passedCases: 1,
      totalCases: 4,
      executionTime: '0.01',
      memory: 8000,
      evaluations: [],
    });

    // 1. Unauthenticated callers cannot access history
    const anonymousCaller = executionRouter.createCaller({
      submissionStore: mockSubStore,
    });

    await assert.rejects(
      async () => anonymousCaller.history(),
      (err: any) => err.code === 'UNAUTHORIZED'
    );

    await assert.rejects(
      async () => anonymousCaller.getSubmission({ id: 'sub_alpha_1' }),
      (err: any) => err.code === 'UNAUTHORIZED'
    );

    // 2. Student Alpha sees only their own history
    const alphaCaller = executionRouter.createCaller({
      submissionStore: mockSubStore,
      user: { id: 'usr_student_alpha', role: 'STUDENT' },
    });

    const alphaHistory = await alphaCaller.history();
    assert.equal(alphaHistory.submissions.length, 1);
    assert.equal(alphaHistory.submissions[0].id, 'sub_alpha_1');
    assert.equal(alphaHistory.submissions[0].code, 'print("Alpha code")');

    const alphaSubmission = await alphaCaller.getSubmission({ id: 'sub_alpha_1' });
    assert.equal(alphaSubmission.id, 'sub_alpha_1');

    // 3. Student Beta CANNOT inspect Student Alpha's submission (Forbidden)
    const betaCaller = executionRouter.createCaller({
      submissionStore: mockSubStore,
      user: { id: 'usr_student_beta', role: 'STUDENT' },
    });

    await assert.rejects(
      async () => betaCaller.getSubmission({ id: 'sub_alpha_1' }),
      (err: any) => err.code === 'FORBIDDEN'
    );

    // 4. Admin CAN inspect any submission
    const adminCaller = executionRouter.createCaller({
      submissionStore: mockSubStore,
      user: { id: 'usr_admin', role: 'ADMIN' },
    });

    const inspected = await adminCaller.getSubmission({ id: 'sub_alpha_1' });
    assert.equal(inspected.id, 'sub_alpha_1');
  });

  describe('Database Submission Queries (Unit Tests with Fixture)', () => {
    it('creates a submission row and sanitizes memory and defaults', async () => {
      let insertedValues: any = null;

      const mockDb = {
        insert: () => ({
          values: (vals: any) => {
            insertedValues = vals;
            return {
              returning: async () => [{ ...vals, createdAt: new Date() }],
            };
          },
        }),
      } as unknown as DatabaseInstance;

      const created = await createSubmission(
        {
          userId: 'usr_test_1',
          problemId: 'prob-001',
          language: 'python',
          code: 'print("hello")',
          verdict: 'ACCEPTED',
          passedCases: 3,
          totalCases: 3,
          executionTime: '0.015s',
          memory: 12050.8, // floating point memory
        },
        mockDb
      );

      assert.ok(created.id);
      assert.equal(created.userId, 'usr_test_1');
      assert.equal(created.problemId, 'prob-001');
      assert.equal(created.verdict, 'ACCEPTED');
      assert.equal(insertedValues.memory, 12051); // rounded integer
      assert.deepEqual(insertedValues.evaluations, []); // default empty array
    });

    it('queries submission by ID from database fixture', async () => {
      const sampleRow: SubmissionSelect = {
        id: 'sub_found_1',
        userId: 'usr_test_1',
        problemId: 'prob-001',
        language: 'python',
        code: 'print("code")',
        verdict: 'ACCEPTED',
        passedCases: 2,
        totalCases: 2,
        executionTime: '0.01s',
        memory: 10000,
        error: null,
        evaluations: [],
        createdAt: new Date(),
      };

      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [sampleRow],
            }),
          }),
        }),
      } as unknown as DatabaseInstance;

      const found = await getSubmissionById('sub_found_1', mockDb);
      assert.ok(found);
      assert.equal(found.id, 'sub_found_1');
      assert.equal(found.verdict, 'ACCEPTED');

      const notFoundDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [],
            }),
          }),
        }),
      } as unknown as DatabaseInstance;

      const notFound = await getSubmissionById('non_existent', notFoundDb);
      assert.equal(notFound, null);
    });

    it('queries and paginates submission history by user', async () => {
      let capturedLimit: number | null = null;
      let capturedOffset: number | null = null;

      const mockRows: SubmissionSelect[] = [
        {
          id: 'sub_page_1',
          userId: 'usr_student_alpha',
          problemId: 'prob-001',
          language: 'python',
          code: 'print(1)',
          verdict: 'ACCEPTED',
          passedCases: 3,
          totalCases: 3,
          executionTime: '0.01s',
          memory: 10000,
          error: null,
          evaluations: [],
          createdAt: new Date(),
        },
      ];

      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: (lim: number) => {
                  capturedLimit = lim;
                  return {
                    offset: async (off: number) => {
                      capturedOffset = off;
                      return mockRows;
                    },
                  };
                },
              }),
            }),
          }),
        }),
      } as unknown as DatabaseInstance;

      const results = await listSubmissionsByUser(
        'usr_student_alpha',
        { problemId: 'prob-001', limit: 25, offset: 5 },
        mockDb
      );

      assert.equal(results.length, 1);
      assert.equal(results[0].id, 'sub_page_1');
      assert.equal(capturedLimit, 25);
      assert.equal(capturedOffset, 5);
    });
  });
});
