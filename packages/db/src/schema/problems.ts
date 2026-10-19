import { pgTable, varchar, text, timestamp, pgEnum, jsonb, integer } from 'drizzle-orm/pg-core';
import type { ProblemExample } from '@code-arena/shared';
import { users } from './users';

// Difficulty enum: Easy, Medium, Hard
export const problemDifficultyEnum = pgEnum('problem_difficulty', ['Easy', 'Medium', 'Hard']);

// Publication status enum: DRAFT, PUBLISHED, ARCHIVED
export const problemStatusEnum = pgEnum('problem_status', ['DRAFT', 'PUBLISHED', 'ARCHIVED']);

export const problems = pgTable('problems', {
  id: varchar('id', { length: 64 }).primaryKey(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  title: varchar('title', { length: 255 }).notNull(),
  createdBy: varchar('created_by', { length: 64 }).references(() => users.id, {
    onDelete: 'set null',
  }),
  difficulty: problemDifficultyEnum('difficulty').notNull().default('Easy'),
  category: varchar('category', { length: 100 }).notNull().default('Algorithms'),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  shortDescription: text('short_description').notNull(),
  description: text('description').notNull(),
  examples: jsonb('examples').$type<ProblemExample[]>().notNull().default([]),
  constraints: jsonb('constraints').$type<string[]>().notNull().default([]),
  supportedLanguages: jsonb('supported_languages').$type<string[]>().notNull().default(['Python', 'C++']),
  starterCode: jsonb('starter_code').$type<Record<string, string>>().notNull().default({}),
  hints: jsonb('hints').$type<string[]>().default([]),
  acceptanceRate: varchar('acceptance_rate', { length: 32 }).default('0.0%'),
  totalSubmissions: integer('total_submissions').notNull().default(0),
  status: problemStatusEnum('status').notNull().default('PUBLISHED'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ProblemSelect = typeof problems.$inferSelect;
export type ProblemInsert = typeof problems.$inferInsert;
