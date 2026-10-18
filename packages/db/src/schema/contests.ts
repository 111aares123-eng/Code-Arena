import {
  pgTable,
  varchar,
  text,
  timestamp,
  pgEnum,
  integer,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { problems } from './problems';
import { submissions } from './submissions';

// Contest status enum: UPCOMING, ACTIVE, PAUSED, ENDED
export const contestStatusEnum = pgEnum('contest_status', [
  'UPCOMING',
  'ACTIVE',
  'PAUSED',
  'ENDED',
]);

/**
 * Contests table: competitive programming events with start/end windows.
 */
export const contests = pgTable(
  'contests',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull(),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    status: contestStatusEnum('status').notNull().default('UPCOMING'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('contests_status_idx').on(table.status),
    index('contests_start_time_idx').on(table.startTime),
    index('contests_end_time_idx').on(table.endTime),
  ]
);

/**
 * Contest-Problems junction table: links problems to contests with points and order.
 */
export const contestProblems = pgTable(
  'contest_problems',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    contestId: varchar('contest_id', { length: 64 })
      .notNull()
      .references(() => contests.id, { onDelete: 'cascade' }),
    problemId: varchar('problem_id', { length: 64 })
      .notNull()
      .references(() => problems.id, { onDelete: 'cascade' }),
    displayOrder: integer('display_order').notNull().default(1),
    points: integer('points').notNull().default(100),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('contest_problems_contest_problem_idx').on(table.contestId, table.problemId),
    index('contest_problems_contest_id_idx').on(table.contestId),
    index('contest_problems_problem_id_idx').on(table.problemId),
    index('contest_problems_order_idx').on(table.contestId, table.displayOrder),
  ]
);

/**
 * Contest Participants table: tracks registered users and their precomputed scores.
 * Enforces unique constraint on (contestId, userId).
 */
export const contestParticipants = pgTable(
  'contest_participants',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    contestId: varchar('contest_id', { length: 64 })
      .notNull()
      .references(() => contests.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    registeredAt: timestamp('registered_at', { withTimezone: true }).defaultNow().notNull(),
    score: integer('score').notNull().default(0),
    penaltyMinutes: integer('penalty_minutes').notNull().default(0),
    problemsSolved: integer('problems_solved').notNull().default(0),
    lastSubmissionTime: timestamp('last_submission_time', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('contest_participants_contest_user_idx').on(table.contestId, table.userId),
    index('contest_participants_contest_id_idx').on(table.contestId),
    index('contest_participants_user_id_idx').on(table.userId),
    index('contest_participants_ranking_idx').on(
      table.contestId,
      table.score,
      table.penaltyMinutes
    ),
  ]
);

/**
 * Contest Submissions table: tracks all submissions submitted within a contest context.
 * The canonical verdict is referenced from `submissions.verdict`.
 */
export const contestSubmissions = pgTable(
  'contest_submissions',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    contestId: varchar('contest_id', { length: 64 })
      .notNull()
      .references(() => contests.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    problemId: varchar('problem_id', { length: 64 })
      .notNull()
      .references(() => problems.id, { onDelete: 'cascade' }),
    submissionId: varchar('submission_id', { length: 64 })
      .notNull()
      .references(() => submissions.id, { onDelete: 'cascade' }),
    isAccepted: boolean('is_accepted').notNull().default(false),
    pointsAwarded: integer('points_awarded').notNull().default(0),
    penaltyMinutes: integer('penalty_minutes').notNull().default(0),
    isLate: boolean('is_late').notNull().default(false),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('contest_submissions_contest_user_idx').on(table.contestId, table.userId),
    index('contest_submissions_contest_problem_idx').on(table.contestId, table.problemId),
    index('contest_submissions_submitted_at_idx').on(table.submittedAt),
  ]
);

/**
 * Contest Solves table: database-level uniqueness constraint ensuring a problem
 * is awarded points at most ONCE per participant in any given contest.
 */
export const contestSolves = pgTable(
  'contest_solves',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    contestId: varchar('contest_id', { length: 64 })
      .notNull()
      .references(() => contests.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    problemId: varchar('problem_id', { length: 64 })
      .notNull()
      .references(() => problems.id, { onDelete: 'cascade' }),
    submissionId: varchar('submission_id', { length: 64 })
      .notNull()
      .references(() => submissions.id, { onDelete: 'cascade' }),
    points: integer('points').notNull().default(0),
    penaltyMinutes: integer('penalty_minutes').notNull().default(0),
    solvedAt: timestamp('solved_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('contest_solves_contest_user_problem_idx').on(
      table.contestId,
      table.userId,
      table.problemId
    ),
    index('contest_solves_contest_id_idx').on(table.contestId),
    index('contest_solves_user_id_idx').on(table.userId),
  ]
);

export type ContestSelect = typeof contests.$inferSelect;
export type ContestInsert = typeof contests.$inferInsert;
export type ContestProblemSelect = typeof contestProblems.$inferSelect;
export type ContestProblemInsert = typeof contestProblems.$inferInsert;
export type ContestParticipantSelect = typeof contestParticipants.$inferSelect;
export type ContestParticipantInsert = typeof contestParticipants.$inferInsert;
export type ContestSubmissionSelect = typeof contestSubmissions.$inferSelect;
export type ContestSubmissionInsert = typeof contestSubmissions.$inferInsert;
export type ContestSolveSelect = typeof contestSolves.$inferSelect;
export type ContestSolveInsert = typeof contestSolves.$inferInsert;
