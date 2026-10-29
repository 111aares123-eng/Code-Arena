import { initTRPC } from '@trpc/server';
import type { ApiContext } from '../context';
import { dbProgressStore } from '../services/progress-store';

const t = initTRPC.context<ApiContext>().create();
export const router = t.router;
export const publicProcedure = t.procedure;

export const progressRouter = router({
  /**
   * Retrieves server-verified student progress (XP, streaks, solved problems).
   *
   * Security & Identity:
   * - Uses verified context identity (`ctx.user.id`).
   * - Never trusts client-supplied XP, streaks, or solved lists.
   * - If unauthenticated, returns `{ authenticated: false, progress: null }`.
   */
  current: publicProcedure.query(async ({ ctx }) => {
    const user = ctx?.user;
    if (!user?.id) {
      return {
        authenticated: false as const,
        progress: null,
      };
    }

    const store = ctx?.progressStore ?? dbProgressStore;
    const progress = await store.getProgress(user.id);

    return {
      authenticated: true as const,
      progress,
    };
  }),
});
