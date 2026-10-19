import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You must be logged in.' });
  }

  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

export const mentorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.role !== 'INSTRUCTOR' && ctx.role !== 'ADMIN') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'You must be a mentor.' });
  }

  return next({ ctx });
});
