import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkAdminAuthorization,
  MIN_ADMIN_TOKEN_LENGTH,
} from '../src/services/admin-auth';

describe('Admin Authorization Service', () => {
  const validToken = 'a'.repeat(MIN_ADMIN_TOKEN_LENGTH); // 32 characters

  it('fails closed when token is not configured (undefined)', () => {
    const result = checkAdminAuthorization('Bearer some-token', undefined);
    assert.deepEqual(result, { ok: false, reason: 'disabled' });
  });

  it('fails closed when token is empty or shorter than 32 characters', () => {
    assert.deepEqual(checkAdminAuthorization('Bearer some-token', ''), { ok: false, reason: 'disabled' });
    assert.deepEqual(checkAdminAuthorization('Bearer some-token', 'too-short-token-12345'), {
      ok: false,
      reason: 'disabled',
    });
  });

  it('returns missing when authorization header is absent or empty', () => {
    assert.deepEqual(checkAdminAuthorization(null, validToken), { ok: false, reason: 'missing' });
    assert.deepEqual(checkAdminAuthorization(undefined, validToken), { ok: false, reason: 'missing' });
    assert.deepEqual(checkAdminAuthorization('', validToken), { ok: false, reason: 'missing' });
    assert.deepEqual(checkAdminAuthorization('   ', validToken), { ok: false, reason: 'missing' });
  });

  it('returns invalid when scheme is not Bearer', () => {
    assert.deepEqual(checkAdminAuthorization(`Basic ${validToken}`, validToken), {
      ok: false,
      reason: 'invalid',
    });
    assert.deepEqual(checkAdminAuthorization(`Token ${validToken}`, validToken), {
      ok: false,
      reason: 'invalid',
    });
  });

  it('returns invalid when Bearer token does not match configured token', () => {
    const wrongToken = 'b'.repeat(MIN_ADMIN_TOKEN_LENGTH);
    assert.deepEqual(checkAdminAuthorization(`Bearer ${wrongToken}`, validToken), {
      ok: false,
      reason: 'invalid',
    });
    // Different length
    assert.deepEqual(checkAdminAuthorization('Bearer short', validToken), {
      ok: false,
      reason: 'invalid',
    });
  });

  it('returns ok: true when Bearer token matches configured token exactly', () => {
    assert.deepEqual(checkAdminAuthorization(`Bearer ${validToken}`, validToken), { ok: true });
    // Case-insensitive scheme match with trimming
    assert.deepEqual(checkAdminAuthorization(`bearer   ${validToken}  `, validToken), { ok: true });
  });
});
