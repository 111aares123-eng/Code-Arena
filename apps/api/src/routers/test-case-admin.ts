import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { mentorProcedure, router } from '../trpc';
import { dbTestCaseStore } from '../services/test-case-store';

const MAX_CASE_TEXT = 256 * 1024; // 256 KB per input / expected output
const MAX_EXPLANATION = 4096;
const MAX_STRUCTURED_INPUT_BYTES = 256 * 1024;

const testCaseAdminProcedure = mentorProcedure.use(({ ctx, next }) => {
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

export const testCaseAdminRouter = router({
  list: testCaseAdminProcedure.input(z.object({ problemId: idSchema })).query(async ({ ctx, input }) => {
    return ctx.testCaseStore.listForProblem(input.problemId);
  }),

  create: testCaseAdminProcedure.input(createTestCaseInputSchema).mutation(async ({ ctx, input }) => {
    if (!(await ctx.testCaseStore.problemExists(input.problemId))) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Problem not found.' });
    }
    return ctx.testCaseStore.create(input);
  }),

  update: testCaseAdminProcedure.input(updateTestCaseInputSchema).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    const updated = await ctx.testCaseStore.update(id, data);
    if (!updated) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Test case not found.' });
    }
    return updated;
  }),

  delete: testCaseAdminProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
    const removed = await ctx.testCaseStore.remove(input.id);
    if (!removed) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Test case not found.' });
    }
    return { id: input.id, deleted: true as const };
  }),
});
