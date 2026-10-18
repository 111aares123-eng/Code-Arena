import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Admin authorization for test-case management.
 *
 * CodeArena has no user accounts yet, so this is a deployment-level shared secret
 * (`ADMIN_API_TOKEN`), presented as `Authorization: Bearer <token>`. It is fail-closed:
 * when the token is unset or too weak, ALL admin operations are refused, so a deployment
 * that forgets to configure it does not expose an unauthenticated write endpoint.
 *
 * Replace with role-based checks once real authentication exists.
 */

export const MIN_ADMIN_TOKEN_LENGTH = 32;

export type AdminAuthResult =
  | { ok: true }
  | { ok: false; reason: 'disabled' | 'missing' | 'invalid' };

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function checkAdminAuthorization(
  authorizationHeader: string | null | undefined,
  configuredToken: string | undefined = process.env.ADMIN_API_TOKEN
): AdminAuthResult {
  const expected = configuredToken?.trim();
  if (!expected || expected.length < MIN_ADMIN_TOKEN_LENGTH) {
    return { ok: false, reason: 'disabled' };
  }

  if (!authorizationHeader || !authorizationHeader.trim()) {
    return { ok: false, reason: 'missing' };
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  if (!match) {
    return { ok: false, reason: 'invalid' };
  }

  // Compare fixed-length digests so neither content nor length leaks through timing.
  const provided = match[1].trim();
  return timingSafeEqual(digest(provided), digest(expected)) ? { ok: true } : { ok: false, reason: 'invalid' };
}
