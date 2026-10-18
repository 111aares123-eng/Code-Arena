import { randomUUID } from 'node:crypto';
import type { ExecutionTestCase, TestCase } from '@code-arena/shared';
import { getDb, problems, testCases, eq, asc, type TestCaseSelect } from '@code-arena/db';

/**
 * Server-only access to judge test cases (visible + hidden).
 *
 * Nothing in this module may be returned from a public procedure without passing through
 * the evaluation service's redaction, and nothing here logs case contents.
 */

export interface CreateTestCaseData {
  problemId: string;
  isVisible: boolean;
  input: string;
  structuredInput?: Record<string, unknown> | null;
  expectedOutput: string;
  explanation?: string | null;
  orderIndex?: number;
}

export type UpdateTestCaseData = Partial<Omit<CreateTestCaseData, 'problemId'>>;

export interface TestCaseStore {
  /** All judge cases for a problem, ordered for execution. */
  listForEvaluation(problemId: string): Promise<ExecutionTestCase[]>;
  /** Admin-only: full records including hidden expected outputs. */
  listForProblem(problemId: string): Promise<TestCase[]>;
  problemExists(problemId: string): Promise<boolean>;
  create(data: CreateTestCaseData): Promise<TestCase>;
  update(id: string, data: UpdateTestCaseData): Promise<TestCase | null>;
  remove(id: string): Promise<boolean>;
}

function toTestCase(row: TestCaseSelect): TestCase {
  return {
    id: row.id,
    problemId: row.problemId,
    orderIndex: row.orderIndex,
    isVisible: row.isVisible,
    input: row.input,
    structuredInput: row.structuredInput ?? undefined,
    expectedOutput: row.expectedOutput,
    explanation: row.explanation ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const dbTestCaseStore: TestCaseStore = {
  async listForEvaluation(problemId) {
    const rows = await getDb()
      .select()
      .from(testCases)
      .where(eq(testCases.problemId, problemId))
      .orderBy(asc(testCases.orderIndex), asc(testCases.createdAt), asc(testCases.id));

    return rows.map((row) => ({
      id: row.id,
      orderIndex: row.orderIndex,
      isVisible: row.isVisible,
      input: row.input,
      structuredInput: row.structuredInput ?? undefined,
      expectedOutput: row.expectedOutput,
    }));
  },

  async listForProblem(problemId) {
    const rows = await getDb()
      .select()
      .from(testCases)
      .where(eq(testCases.problemId, problemId))
      .orderBy(asc(testCases.orderIndex), asc(testCases.createdAt), asc(testCases.id));
    return rows.map(toTestCase);
  },

  async problemExists(problemId) {
    const rows = await getDb().select({ id: problems.id }).from(problems).where(eq(problems.id, problemId)).limit(1);
    return rows.length > 0;
  },

  async create(data) {
    const [row] = await getDb()
      .insert(testCases)
      .values({
        id: randomUUID(),
        problemId: data.problemId,
        isVisible: data.isVisible,
        input: data.input,
        structuredInput: data.structuredInput ?? null,
        expectedOutput: data.expectedOutput,
        explanation: data.explanation ?? null,
        orderIndex: data.orderIndex ?? 0,
      })
      .returning();
    return toTestCase(row);
  },

  async update(id, data) {
    const set: Partial<typeof testCases.$inferInsert> = { updatedAt: new Date() };
    if (data.isVisible !== undefined) set.isVisible = data.isVisible;
    if (data.input !== undefined) set.input = data.input;
    if (data.structuredInput !== undefined) set.structuredInput = data.structuredInput;
    if (data.expectedOutput !== undefined) set.expectedOutput = data.expectedOutput;
    if (data.explanation !== undefined) set.explanation = data.explanation;
    if (data.orderIndex !== undefined) set.orderIndex = data.orderIndex;

    const [row] = await getDb().update(testCases).set(set).where(eq(testCases.id, id)).returning();
    return row ? toTestCase(row) : null;
  },

  async remove(id) {
    const rows = await getDb().delete(testCases).where(eq(testCases.id, id)).returning({ id: testCases.id });
    return rows.length > 0;
  },
};

/**
 * True when the error means the test_cases table does not exist yet (migration 0001 not applied).
 * In that state no judge cases can exist, so sample-only evaluation is the correct behaviour.
 */
export function isMissingTestCasesTable(err: unknown): boolean {
  const codeOf = (e: unknown): unknown =>
    e && typeof e === 'object' && 'code' in e ? (e as { code: unknown }).code : undefined;
  const cause = err && typeof err === 'object' && 'cause' in err ? (err as { cause: unknown }).cause : undefined;
  return codeOf(err) === '42P01' || codeOf(cause) === '42P01';
}
