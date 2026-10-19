import { pgTable, varchar, timestamp, pgEnum, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';
import { problems } from './problems';
import { submissions } from './submissions';

// Student problem progress status enum: ATTEMPTED, SOLVED
export const studentProblemStatusEnum = pgEnum('student_problem_status', ['ATTEMPTED', 'SOLVED']);

/**
 * Tracks each student's progress on each problem.
 * A unique compound index on (user_id, problem_id) prevents duplicate progress rows.
 */
export const studentProblemProgress = pgTable(
  'student_problem_progress',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: varchar('user_id', { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    problemId: varchar('problem_id', { length: 64 })
      .notNull()
      .references(() => problems.id, { onDelete: 'cascade' }),
    status: studentProblemStatusEnum('status').notNull().default('ATTEMPTED'),
    attemptsCount: integer('attempts_count').notNull().default(1),
    firstSolvedAt: timestamp('first_solved_at', { withTimezone: true }),
    lastAttemptedAt: timestamp('last_attempted_at', { withTimezone: true }).defaultNow().notNull(),
    bestSubmissionId: varchar('best_submission_id', { length: 64 })
      .references(() => submissions.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('student_problem_progress_user_problem_idx').on(table.userId, table.problemId),
    index('student_problem_progress_user_id_idx').on(table.userId),
    index('student_problem_progress_problem_id_idx').on(table.problemId),
    index('student_problem_progress_status_idx').on(table.status),
  ]
);

/**
 * Aggregated statistics per student to avoid computing counts on every page/dashboard view.
 */
export const studentStats = pgTable(
  'student_stats',
  {
    userId: varchar('user_id', { length: 64 })
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    solvedCount: integer('solved_count').notNull().default(0),
    easySolved: integer('easy_solved').notNull().default(0),
    mediumSolved: integer('medium_solved').notNull().default(0),
    hardSolved: integer('hard_solved').notNull().default(0),
    totalAttempts: integer('total_attempts').notNull().default(0),
    currentStreak: integer('current_streak').notNull().default(0),
    maxStreak: integer('max_streak').notNull().default(0),
    lastActiveDate: timestamp('last_active_date', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('student_stats_solved_count_idx').on(table.solvedCount),
    index('student_stats_current_streak_idx').on(table.currentStreak),
  ]
);

export type StudentProblemProgressSelect = typeof studentProblemProgress.$inferSelect;
export type StudentProblemProgressInsert = typeof studentProblemProgress.$inferInsert;
export type StudentStatsSelect = typeof studentStats.$inferSelect;
export type StudentStatsInsert = typeof studentStats.$inferInsert;
