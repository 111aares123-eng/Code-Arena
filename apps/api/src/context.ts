import type { TestCaseStore } from './services/test-case-store';

/**
 * Per-request tRPC context.
 *
 * Every field is optional so routers keep working with `createCaller({})` (used by the
 * existing harness tests). Services fall back to their real implementations when a field
 * is absent; tests may inject fakes.
 */
export interface ApiContext {
  [key: string]: unknown;
  /** Raw `Authorization` request header, if any. */
  authorization?: string | null;
  /** Test-only override for the judge test-case repository. */
  testCaseStore?: TestCaseStore;
}

export function createApiContext(req: Request): ApiContext {
  return {
    authorization: req.headers.get('authorization'),
  };
}
