import { z } from 'zod';

export const problemDifficultySchema = z.enum(['Easy', 'Medium', 'Hard']);

export const problemStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

export const problemExampleSchema = z.object({
  id: z.number().int().positive(),
  input: z.string(),
  output: z.string(),
  explanation: z.string().optional(),
});

export const problemStarterCodeSchema = z.record(z.string(), z.string()).optional();

export const problemSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  title: z.string().min(1).max(255),
  difficulty: problemDifficultySchema,
  category: z.string().min(1).default('Algorithms'),
  tags: z.array(z.string()).default([]),
  shortDescription: z.string().min(1),
  description: z.string().min(1),
  examples: z.array(problemExampleSchema).default([]),
  constraints: z.array(z.string()).default([]),
  supportedLanguages: z.array(z.string()).default(['Python', 'C++']),
  starterCode: problemStarterCodeSchema,
  hints: z.array(z.string()).optional().default([]),
  acceptanceRate: z.string().default('0.0%'),
  totalSubmissions: z.number().int().nonnegative().default(0),
  status: problemStatusSchema.default('PUBLISHED'),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
});

export const createProblemSchema = problemSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export const updateProblemSchema = createProblemSchema.partial();

export const problemFiltersSchema = z.object({
  search: z.string().optional().default(''),
  difficulty: z.union([z.literal('ALL'), problemDifficultySchema]).optional().default('ALL'),
  tag: z.string().optional().default(''),
});

export type ProblemSchemaType = z.infer<typeof problemSchema>;
export type CreateProblemInput = z.infer<typeof createProblemSchema>;
export type UpdateProblemInput = z.infer<typeof updateProblemSchema>;
export type ProblemFiltersInput = z.infer<typeof problemFiltersSchema>;
