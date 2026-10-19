import { pgTable, varchar, text, timestamp, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Definition table for achievements and badges available on the platform.
 */
export const achievements = pgTable(
  'achievements',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull(),
    badgeIcon: varchar('badge_icon', { length: 100 }).notNull().default('award'),
    category: varchar('category', { length: 50 }).notNull().default('GENERAL'),
    criteriaType: varchar('criteria_type', { length: 50 }).notNull(),
    criteriaThreshold: integer('criteria_threshold').notNull().default(1),
    xpReward: integer('xp_reward').notNull().default(50),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('achievements_category_idx').on(table.category),
    index('achievements_criteria_type_idx').on(table.criteriaType),
  ]
);

/**
 * Junction table recording which user has earned which achievement.
 * A unique compound index on (user_id, achievement_id) ensures a user earns an achievement at most once.
 */
export const userAchievements = pgTable(
  'user_achievements',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: varchar('user_id', { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    achievementId: varchar('achievement_id', { length: 64 })
      .notNull()
      .references(() => achievements.id, { onDelete: 'cascade' }),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_achievements_user_achievement_idx').on(table.userId, table.achievementId),
    index('user_achievements_user_id_idx').on(table.userId),
    index('user_achievements_achievement_id_idx').on(table.achievementId),
    index('user_achievements_unlocked_at_idx').on(table.unlockedAt),
  ]
);

export type AchievementSelect = typeof achievements.$inferSelect;
export type AchievementInsert = typeof achievements.$inferInsert;
export type UserAchievementSelect = typeof userAchievements.$inferSelect;
export type UserAchievementInsert = typeof userAchievements.$inferInsert;
