import { pgTable, varchar, text, boolean, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { problems } from './problems';

/**
 * Test cases for problems - supports both visible samples and hidden evaluation cases
 */
export const testCases = pgTable('test_cases', {
  id: varchar('id', { length: 64 }).primaryKey(),
  problemId: varchar('problem_id', { length: 64 })
    .notNull()
    .references(() => problems.id, { onDelete: 'cascade' }),

  // Test case order for execution
  orderIndex: integer('order_index').notNull().default(0),

  // Visibility: true = shown to students, false = hidden evaluation case
  isVisible: boolean('is_visible').notNull().default(true),

  // Input representation (shown to students if visible)
  input: text('input').notNull(),

  // Structured input for harness (JSON)
  structuredInput: jsonb('structured_input').$type<Record<string, unknown>>(),

  // Expected output (server-only for hidden cases)
  expectedOutput: text('expected_output').notNull(),

  // Optional explanation (only for visible samples)
  explanation: text('explanation'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type TestCaseSelect = typeof testCases.$inferSelect;
export type TestCaseInsert = typeof testCases.$inferInsert;
