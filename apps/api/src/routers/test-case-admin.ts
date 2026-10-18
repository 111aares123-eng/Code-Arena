import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { ApiContext } from '../context';
import { checkAdminAuthorization } from '../services/admin-auth';
import { dbTestCaseStore } from '../services/test-case-store';

/**
 * Test-case management (admin only).
 *
 * Every procedure here goes through `adminProcedure`, which is fail-closed: it refuses all
 * calls unless ADMIN_API_TOKEN is configured and presented as a Bearer token. There is no
 * public procedure in this router. Handlers never log request payloads.
 */

const t = initTRPC.context<ApiContext>().create();

const MAX_CASE_TEXT = 256 * 1024; // 256 KB per input / expected output
const MAX_EXPLANATION = 4096;
const MAX_STRUCTURED_INPUT_BYTES = 256 * 1024;

const adminProcedure = t.procedure.use(({ ctx, next }) => {
  const auth = checkAdminAuthorization(ctx.authorization);
  if (!auth.ok) {
    if (auth.reason === 'disabled') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Test-case administration is disabled on this server.',
      });
    }
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Valid admin credentials are required.' });
  }
  return next({ ctx: { ...ctx, testCaseStore: ctx.testCaseStore ?? dbTestCaseStore } });
});

const idSchema = z.string().trim().min(1).max(64);

const structuredInputSchema = z
  .record(z.string(), z.unknown())
  .refine((value) => {
    try {
      return Buffer.byteLength(JSON.stringify(value), 'utf8') <= MAX_STRUCTURED_INPUT_BYTES;
    } catch {
      return false; // not JSON-serializable
    }
  }, 'structuredInput must be JSON-serializable and at most 256 KB');

const caseFields = {
  isVisible: z.boolean(),
  input: z.string().max(MAX_CASE_TEXT),
  structuredInput: structuredInputSchema.nullable().optional(),
  expectedOutput: z.string().max(MAX_CASE_TEXT),
  explanation: z.string().max(MAX_EXPLANATION).nullable().optional(),
  orderIndex: z.number().int().min(0).max(1_000_000).optional(),
};

export const createTestCaseInputSchema = z.object({
  problemId: idSchema,
  ...caseFields,
  // A hidden case defaults to hidden unless explicitly made visible.
  isVisible: caseFields.isVisible.default(false),
});

export const updateTestCaseInputSchema = z
  .object({
    id: idSchema,
    isVisible: caseFields.isVisible.optional(),
    input: caseFields.input.optional(),
    structuredInput: caseFields.structuredInput,
    expectedOutput: caseFields.expectedOutput.optional(),
    explanation: caseFields.explanation,
    orderIndex: caseFields.orderIndex,
  })
  .refine((v) => Object.keys(v).some((k) => k !== 'id' && v[k as keyof typeof v] !== undefined), {
    message: 'At least one field to update is required',
  });

export const testCaseAdminRouter = t.router({
  list: adminProcedure.input(z.object({ problemId: idSchema })).query(async ({ ctx, input }) => {
    return ctx.testCaseStore.listForProblem(input.problemId);
  }),

  create: adminProcedure.input(createTestCaseInputSchema).mutation(async ({ ctx, input }) => {
    if (!(await ctx.testCaseStore.problemExists(input.problemId))) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Problem not found.' });
    }
    return ctx.testCaseStore.create(input);
  }),

  update: adminProcedure.input(updateTestCaseInputSchema).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    const updated = await ctx.testCaseStore.update(id, data);
    if (!updated) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Test case not found.' });
    }
    return updated;
  }),

  delete: adminProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
    const removed = await ctx.testCaseStore.remove(input.id);
    if (!removed) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Test case not found.' });
    }
    return { id: input.id, deleted: true as const };
  }),
});
