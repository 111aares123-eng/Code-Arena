import { pgTable, varchar, text, timestamp, pgEnum, integer, jsonb, index } from 'drizzle-orm/pg-core';
import type { TestCaseEvaluation } from '@code-arena/shared';
import { users } from './users';
import { problems } from './problems';

// Submission verdict enum: PENDING, ACCEPTED, WRONG_ANSWER, TIME_LIMIT_EXCEEDED,
// MEMORY_LIMIT_EXCEEDED, COMPILE_ERROR, RUNTIME_ERROR, SAMPLE_PASSED, SAMPLE_FAILED, SERVICE_UNAVAILABLE
export const submissionVerdictEnum = pgEnum('submission_verdict', [
  'PENDING',
  'ACCEPTED',
  'WRONG_ANSWER',
  'TIME_LIMIT_EXCEEDED',
  'MEMORY_LIMIT_EXCEEDED',
  'COMPILE_ERROR',
  'RUNTIME_ERROR',
  'SAMPLE_PASSED',
  'SAMPLE_FAILED',
  'SERVICE_UNAVAILABLE',
]);

export const submissions = pgTable(
  'submissions',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: varchar('user_id', { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    problemId: varchar('problem_id', { length: 64 })
      .notNull()
      .references(() => problems.id, { onDelete: 'cascade' }),
    language: varchar('language', { length: 32 }).notNull(),
    code: text('code').notNull(),
    verdict: submissionVerdictEnum('verdict').notNull().default('PENDING'),
    passedCases: integer('passed_cases').notNull().default(0),
    totalCases: integer('total_cases').notNull().default(0),
    executionTime: varchar('execution_time', { length: 32 }),
    memory: integer('memory'),
    error: text('error'),
    evaluations: jsonb('evaluations').$type<TestCaseEvaluation[]>().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('submissions_user_id_idx').on(table.userId),
    index('submissions_problem_id_idx').on(table.problemId),
    index('submissions_user_problem_idx').on(table.userId, table.problemId),
    index('submissions_verdict_idx').on(table.verdict),
    index('submissions_created_at_idx').on(table.createdAt),
  ]
);

export type SubmissionSelect = typeof submissions.$inferSelect;
export type SubmissionInsert = typeof submissions.$inferInsert;
