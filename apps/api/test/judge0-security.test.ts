import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getJudge0Config,
  checkJudge0Health,
  executeWithJudge0,
} from '../src/services/judge0';

describe('Judge0 Security & Authentication Hardening Tests', () => {
  it('correctly reads JUDGE0_API_KEY from environment in getJudge0Config', () => {
    const originalKey = process.env.JUDGE0_API_KEY;
    try {
      process.env.JUDGE0_API_KEY = 'test-token-123456';
      const config = getJudge0Config();
      assert.equal(config.apiKey, 'test-token-123456');
    } finally {
      if (originalKey === undefined) {
        delete process.env.JUDGE0_API_KEY;
      } else {
        process.env.JUDGE0_API_KEY = originalKey;
      }
    }
  });

  it('forwards X-Auth-Token in checkJudge0Health when apiKey is configured', async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.JUDGE0_API_KEY;
    let sentHeaders: HeadersInit | undefined;

    try {
      process.env.JUDGE0_API_KEY = 'secure-judge0-auth-token';
      globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
        sentHeaders = init?.headers;
        return new Response(JSON.stringify({ version: '1.13.1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      const health = await checkJudge0Health();
      assert.equal(health.available, true);
      assert.ok(sentHeaders);
      const headersRecord = sentHeaders as Record<string, string>;
      assert.equal(headersRecord['X-Auth-Token'], 'secure-judge0-auth-token');
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) {
        delete process.env.JUDGE0_API_KEY;
      } else {
        process.env.JUDGE0_API_KEY = originalKey;
      }
    }
  });

  it('forwards X-Auth-Token in executeWithJudge0 submissions when apiKey is configured', async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.JUDGE0_API_KEY;
    let sentHeaders: HeadersInit | undefined;

    try {
      process.env.JUDGE0_API_KEY = 'secure-judge0-auth-token';
      globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
        sentHeaders = init?.headers;
        return new Response(
          JSON.stringify({
            stdout: Buffer.from('hello').toString('base64'),
            stderr: null,
            status: { id: 3, description: 'Accepted' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const res = await executeWithJudge0({
        sourceCode: 'print("hello")',
        language: 'python',
      });

      assert.equal(res.success, true);
      assert.ok(sentHeaders);
      const headersRecord = sentHeaders as Record<string, string>;
      assert.equal(headersRecord['X-Auth-Token'], 'secure-judge0-auth-token');
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) {
        delete process.env.JUDGE0_API_KEY;
      } else {
        process.env.JUDGE0_API_KEY = originalKey;
      }
    }
  });

  it('handles 401 Unauthorized from Judge0 gracefully when token is invalid or missing', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ error: 'Unauthorized: invalid token' }), {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'Content-Type': 'application/json' },
        });

      const res = await executeWithJudge0({
        sourceCode: 'print("hello")',
        language: 'python',
      });

      assert.equal(res.success, false);
      if (!res.success) {
        assert.equal(res.judge0Available, false);
        assert.match(res.error, /401/);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Judge0 Static Configuration Verification Tests', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(__dirname, '../../..');
  const composePath = path.join(rootDir, 'docker/judge0/docker-compose.yml');
  const confPath = path.join(rootDir, 'docker/judge0/judge0.conf');
  const exampleConfPath = path.join(rootDir, 'docker/judge0/judge0.conf.example');

  it('verifies docker-compose.yml binds Judge0 host port exclusively to 127.0.0.1 loopback', () => {
    const composeContent = fs.readFileSync(composePath, 'utf8');
    assert.match(
      composeContent,
      /127\.0\.0\.1:2358:2358/,
      'Port 2358 must be bound to 127.0.0.1 to prevent LAN/internet exposure'
    );
    assert.doesNotMatch(
      composeContent,
      /^\s*-\s*"2358:2358"/m,
      'Port 2358 must NOT be bound to all interfaces'
    );
  });

  it('verifies judge0.conf enables authentication and disables submission networking', () => {
    const confContent = fs.readFileSync(confPath, 'utf8');

    // Authentication verification
    assert.match(confContent, /^AUTHN_HEADER=X-Auth-Token$/m);
    const tokenMatch = confContent.match(/^AUTHN_TOKEN=(.+)$/m);
    assert.ok(tokenMatch, 'AUTHN_TOKEN must be set');
    assert.ok(tokenMatch[1].trim().length >= 32, 'AUTHN_TOKEN must be at least 32 characters long');

    // Submission networking lockdown verification
    assert.match(confContent, /^ALLOW_ENABLE_NETWORK=false$/m, 'ALLOW_ENABLE_NETWORK must be false');
    assert.match(confContent, /^ENABLE_NETWORK=false$/m, 'ENABLE_NETWORK must be false');
  });

  it('verifies judge0.conf.example contains placeholders and NO plaintext secrets', () => {
    assert.ok(fs.existsSync(exampleConfPath), 'judge0.conf.example must exist');
    const exampleContent = fs.readFileSync(exampleConfPath, 'utf8');

    // Must have placeholders
    assert.match(exampleContent, /^AUTHN_HEADER=X-Auth-Token$/m);
    assert.match(exampleContent, /^AUTHN_TOKEN=replace_with_/m);
    assert.match(exampleContent, /^REDIS_PASSWORD=replace_with_/m);
    assert.match(exampleContent, /^POSTGRES_PASSWORD=replace_with_/m);
    assert.match(exampleContent, /^SECRET_KEY_BASE=replace_with_/m);

    // Hardened networking settings must be present in example
    assert.match(exampleContent, /^ALLOW_ENABLE_NETWORK=false$/m);
    assert.match(exampleContent, /^ENABLE_NETWORK=false$/m);
  });
});
