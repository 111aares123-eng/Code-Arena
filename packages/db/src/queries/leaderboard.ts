import { eq, desc, asc, sql } from 'drizzle-orm';
import { getDb, type DatabaseInstance } from '../client';
import { users } from '../schema/users';

export interface GlobalLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  xp: number;
  rating: number;
  createdAt: Date;
}

export interface GlobalLeaderboardFilters {
  limit?: number;
  offset?: number;
}

/**
 * Returns the global XP and rating leaderboard for students with deterministic pagination.
 *
 * Competition Rank Criteria (tied participants share a rank):
 * 1. XP DESC (primary)
 * 2. Rating DESC (secondary)
 * 3. Created At ASC (tertiary)
 *
 * Deterministic Pagination Order:
 * - XP DESC, Rating DESC, Created At ASC, User ID ASC (unique tie-breaker for stable pages)
 */
export async function getGlobalLeaderboard(
  filters: GlobalLeaderboardFilters = {},
  dbInstance?: DatabaseInstance
): Promise<GlobalLeaderboardEntry[]> {
  const db = dbInstance || getDb();
  const limit = Math.min(Math.max(1, filters.limit || 50), 100);
  const offset = Math.max(0, filters.offset || 0);

  const rows = await db
    .select({
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      xp: users.xp,
      rating: users.rating,
      createdAt: users.createdAt,
      // RANK uses ONLY intended criteria so tied participants share a rank
      rank: sql<number>`RANK() OVER (ORDER BY ${users.xp} DESC, ${users.rating} DESC, ${users.createdAt} ASC)`,
    })
    .from(users)
    .where(eq(users.role, 'STUDENT'))
    .orderBy(desc(users.xp), desc(users.rating), asc(users.createdAt), asc(users.id))
    .limit(limit)
    .offset(offset);

  return rows.map((row) => ({
    ...row,
    rank: Number(row.rank),
  }));
}
