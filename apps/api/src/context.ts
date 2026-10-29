import type { Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import type { TestCaseStore } from './services/test-case-store';
import type { SubmissionStore } from './services/submission-store';
import type { LeaderboardStore } from './services/leaderboard-store';
import type { ProgressStore } from './services/progress-store';
import {
  resolveClientIp,
  type ExecutionRateLimiter,
} from './services/rate-limiter';

export interface AuthenticatedUser {
  id: string;
  role?: 'STUDENT' | 'ADMIN' | 'INSTRUCTOR';
}

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
  /** Authenticated user identity resolved by verified server-side session/token. */
  user?: AuthenticatedUser;
  /** Injectable submission store for persistence and isolated unit testing. */
  submissionStore?: SubmissionStore;
  /** Injectable leaderboard store for querying rankings and isolated unit testing. */
  leaderboardStore?: LeaderboardStore;
  /** Injectable progress store for awarding XP, tracking streaks, and isolated unit testing. */
  progressStore?: ProgressStore;
  /** Test-only override for the judge test-case repository. */
  testCaseStore?: TestCaseStore;
  /** Resolved, verified client IP address. */
  clientIp?: string;
  /** Injectable rate limiter for isolated unit testing. */
  rateLimiter?: ExecutionRateLimiter;
  /** Flag to bypass rate limiting (used selectively in testing). */
  skipRateLimit?: boolean;
}

export function createApiContext(req: Request, c?: Context): ApiContext {
  let directSocketIp: string | undefined;

  if (c) {
    try {
      const info = getConnInfo(c);
      directSocketIp = info?.remote?.address;
    } catch {
      // In non-standard environments, check bindings
      const env = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined;
      directSocketIp = env?.incoming?.socket?.remoteAddress;
    }
  }

  const trustedProxies = (process.env.TRUSTED_PROXIES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const clientIp = resolveClientIp(req, directSocketIp, trustedProxies);

  return {
    authorization: req.headers.get('authorization'),
    clientIp,
  };
}
