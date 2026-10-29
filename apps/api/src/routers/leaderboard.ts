import { z } from 'zod';
import { initTRPC } from '@trpc/server';
import type { ApiContext } from '../context';
import { dbLeaderboardStore } from '../services/leaderboard-store';

const t = initTRPC.context<ApiContext>().create();
export const router = t.router;
export const publicProcedure = t.procedure;

export const leaderboardRouter = router({
  /**
   * Returns global student XP and rating rankings with deterministic pagination.
   *
   * Visibility Rules:
   * - Only students (role = 'STUDENT') are included in the leaderboard.
   * - Empty leaderboards return an empty list gracefully.
   */
  global: publicProcedure
    .input(
      z
        .object({
          limit: z.number().int().positive().max(100).optional().default(50),
          offset: z.number().int().nonnegative().optional().default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const store = ctx?.leaderboardStore ?? dbLeaderboardStore;
      const entries = await store.getGlobalLeaderboard({
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
      });

      return {
        entries,
        total: entries.length,
      };
    }),
});
