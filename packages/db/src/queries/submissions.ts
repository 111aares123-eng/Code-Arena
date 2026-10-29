import { randomUUID } from 'node:crypto';
import { eq, desc, and } from 'drizzle-orm';
import { getDb, type DatabaseInstance } from '../client';
import { submissions, type SubmissionSelect } from '../schema/submissions';
import type { TestCaseEvaluation, SubmissionVerdict } from '@code-arena/shared';

export interface CreateSubmissionParams {
  id?: string;
  userId: string;
  problemId: string;
  language: string;
  code: string;
  verdict: SubmissionVerdict;
  passedCases: number;
  totalCases: number;
  executionTime?: string | null;
  memory?: number | null;
  error?: string | null;
  evaluations?: TestCaseEvaluation[];
}

export interface ListSubmissionsFilters {
  problemId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Persists a new submission record in the database.
 */
export async function createSubmission(
  params: CreateSubmissionParams,
  dbInstance?: DatabaseInstance
): Promise<SubmissionSelect> {
  const db = dbInstance || getDb();
  const id = params.id || randomUUID();

  const [row] = await db
    .insert(submissions)
    .values({
      id,
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
    })
    .returning();

  return row;
}

/**
 * Retrieves a submission record by its unique ID.
 */
export async function getSubmissionById(
  id: string,
  dbInstance?: DatabaseInstance
): Promise<SubmissionSelect | null> {
  const db = dbInstance || getDb();
  const rows = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, id))
    .limit(1);

  return rows[0] || null;
}

/**
 * Retrieves submission history for a specific student, optionally filtered by problem.
 * Results are paginated and ordered from newest to oldest.
 */
export async function listSubmissionsByUser(
  userId: string,
  filters: ListSubmissionsFilters = {},
  dbInstance?: DatabaseInstance
): Promise<SubmissionSelect[]> {
  const db = dbInstance || getDb();
  const limit = Math.min(Math.max(1, filters.limit || 50), 100);
  const offset = Math.max(0, filters.offset || 0);

  const conditions = [eq(submissions.userId, userId)];
  if (filters.problemId) {
    conditions.push(eq(submissions.problemId, filters.problemId));
  }

  return db
    .select()
    .from(submissions)
    .where(and(...conditions))
    .orderBy(desc(submissions.createdAt), desc(submissions.id))
    .limit(limit)
    .offset(offset);
}
