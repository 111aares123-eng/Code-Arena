import { pgTable, varchar, text, timestamp, pgEnum, integer, index } from 'drizzle-orm/pg-core';

// User role enum: STUDENT, ADMIN, INSTRUCTOR
export const userRoleEnum = pgEnum('user_role', ['STUDENT', 'ADMIN', 'INSTRUCTOR']);

export const users = pgTable(
  'users',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    username: varchar('username', { length: 50 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 100 }),
    avatarUrl: text('avatar_url'),
    role: userRoleEnum('role').notNull().default('STUDENT'),
    xp: integer('xp').notNull().default(0),
    rating: integer('rating').notNull().default(1200),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('users_xp_idx').on(table.xp),
    index('users_rating_idx').on(table.rating),
    index('users_role_idx').on(table.role),
  ]
);

export type UserSelect = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
