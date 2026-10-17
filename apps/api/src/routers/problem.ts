import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getDb, problems, eq, and, or, ilike, sql, asc } from '@code-arena/db';
import type { Problem } from '@code-arena/shared';
import { router, publicProcedure } from '../trpc';

export const problemListInputSchema = z
  .object({
    search: z.string().optional().default(''),
    difficulty: z.union([z.literal('ALL'), z.enum(['Easy', 'Medium', 'Hard'])]).optional().default('ALL'),
    tag: z.string().optional().default(''),
    page: z.number().int().min(1).optional().default(1),
    limit: z.number().int().min(1).max(100).optional().default(50),
  })
  .default({
    search: '',
    difficulty: 'ALL',
    tag: '',
    page: 1,
    limit: 50,
  });

export const problemRouter = router({
  list: publicProcedure.input(problemListInputSchema).query(async ({ input }) => {
    const filters = input ?? {};
    const db = getDb();
    const conditions = [eq(problems.status, 'PUBLISHED')];

    // Difficulty filter
    if (filters.difficulty && filters.difficulty !== 'ALL') {
      conditions.push(eq(problems.difficulty, filters.difficulty));
    }

    // Tag filter via JSONB containment
    if (filters.tag && filters.tag.trim()) {
      const tagJson = JSON.stringify([filters.tag.trim()]);
      conditions.push(sql`${problems.tags} @> ${tagJson}::jsonb`);
    }

    // Search query (matches title or shortDescription)
    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      conditions.push(or(ilike(problems.title, term), ilike(problems.shortDescription, term))!);
    }

    const whereClause = and(...conditions);

    // Get total matching count
    const [countResult] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(problems)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const offset = (page - 1) * limit;

    // Get paginated items
    const rows = await db
      .select()
      .from(problems)
      .where(whereClause)
      .orderBy(asc(problems.id))
      .limit(limit)
      .offset(offset);

    return {
      items: rows as Problem[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(problems)
        .where(and(eq(problems.slug, input.slug), eq(problems.status, 'PUBLISHED')))
        .limit(1);

      const problem = rows[0];
      if (!problem) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Problem "${input.slug}" not found or is unpublished.`,
        });
      }

      return problem as Problem;
    }),

  stats: publicProcedure.query(async () => {
    const db = getDb();
    const rows = await db
      .select({
        difficulty: problems.difficulty,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(problems)
      .where(eq(problems.status, 'PUBLISHED'))
      .groupBy(problems.difficulty);

    const stats: Record<'Easy' | 'Medium' | 'Hard' | 'Total', number> = {
      Total: 0,
      Easy: 0,
      Medium: 0,
      Hard: 0,
    };

    for (const r of rows) {
      if (r.difficulty in stats) {
        stats[r.difficulty as 'Easy' | 'Medium' | 'Hard'] = r.count;
        stats.Total += r.count;
      }
    }

    return stats;
  }),
});
