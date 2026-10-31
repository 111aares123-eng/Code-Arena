import { z } from 'zod';

export const executionLanguageSchema = z.enum(['python', 'cpp']);

export const runCodeInputSchema = z.object({
  problemSlug: z
    .string()
    .min(1, 'Problem slug is required')
    .max(128, 'Problem slug cannot exceed 128 characters'),
  sourceCode: z
    .string()
    .min(1, 'Source code cannot be empty')
    .max(65536, 'Source code exceeds maximum permitted size of 64KB'),
  language: executionLanguageSchema,
  testCaseId: z.string().max(64).optional(),
  stdin: z.string().max(65536, 'Standard input exceeds maximum permitted size of 64KB').optional(),
  expectedOutput: z.string().max(65536, 'Expected output exceeds maximum permitted size of 64KB').optional(),
  testCaseIndex: z.number().int().nonnegative().max(1000, 'Test case index out of range').optional().default(0),
});

export const submitCodeInputSchema = z.object({
  problemSlug: z
    .string()
    .min(1, 'Problem slug is required')
    .max(128, 'Problem slug cannot exceed 128 characters'),
  sourceCode: z
    .string()
    .min(1, 'Source code cannot be empty')
    .max(65536, 'Source code exceeds maximum permitted size of 64KB'),
  language: executionLanguageSchema,
});

export type RunCodeInput = z.infer<typeof runCodeInputSchema>;
export type SubmitCodeInput = z.infer<typeof submitCodeInputSchema>;
