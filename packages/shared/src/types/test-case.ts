/**
 * Test case visibility levels
 */
export type TestCaseVisibility = 'visible' | 'hidden';

/**
 * Full test case (server-only) - includes expected output for all cases
 */
export interface TestCase {
  id: string;
  problemId: string;
  orderIndex: number;
  isVisible: boolean;
  input: string;
  structuredInput?: Record<string, unknown>;
  expectedOutput: string;
  explanation?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/**
 * Public test case sample (student-facing). Contains the expected output, so it must
 * only ever be constructed from VISIBLE cases. Hidden cases have no public representation.
 */
export interface PublicTestCase {
  id: string;
  orderIndex: number;
  input: string;
  expectedOutput: string;
  explanation?: string;
}

/**
 * Test case for execution (server-only) - includes structured input and expected output
 */
export interface ExecutionTestCase {
  id: string;
  orderIndex: number;
  isVisible: boolean;
  input: string;
  structuredInput?: Record<string, unknown>;
  expectedOutput: string;
}
