import { z } from 'zod';

export const executionLanguageSchema = z.enum(['python', 'cpp']);

export const runCodeInputSchema = z.object({
  problemSlug: z.string().min(1, 'Problem slug is required'),
  sourceCode: z
    .string()
    .min(1, 'Source code cannot be empty')
    .max(65536, 'Source code exceeds maximum permitted size of 64KB'),
  language: executionLanguageSchema,
  stdin: z.string().optional().default(''),
  expectedOutput: z.string().optional().default(''),
  testCaseIndex: z.number().int().nonnegative().optional().default(0),
});

export const submitCodeInputSchema = z.object({
  problemSlug: z.string().min(1, 'Problem slug is required'),
  sourceCode: z
    .string()
    .min(1, 'Source code cannot be empty')
    .max(65536, 'Source code exceeds maximum permitted size of 64KB'),
  language: executionLanguageSchema,
});

export type RunCodeInput = z.infer<typeof runCodeInputSchema>;
export type SubmitCodeInput = z.infer<typeof submitCodeInputSchema>;
