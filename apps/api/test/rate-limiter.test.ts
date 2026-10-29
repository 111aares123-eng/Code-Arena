import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { TRPCError } from '@trpc/server';
import {
  runCodeInputSchema,
  submitCodeInputSchema,
} from '@code-arena/shared';
import {
  ExecutionRateLimiter,
  resolveClientIp,
  normalizeIp,
} from '../src/services/rate-limiter';
import { executionRouter } from '../src/routers/execution';

describe('Execution Rate Limiter Unit Tests', () => {
  let currentTime = 1_000_000;
  const mockNow = () => currentTime;

  beforeEach(() => {
    currentTime = 1_000_000;
  });

  it('allows requests within configured threshold and decrements remaining count', () => {
    const limiter = new ExecutionRateLimiter(
      {
        runMax: 3,
        runWindowMs: 60_000,
        sweepIntervalMs: 0,
      },
      mockNow
    );

    const r1 = limiter.checkRateLimit('192.168.1.10', 'run');
    assert.equal(r1.allowed, true);
    assert.equal(r1.remaining, 2);
    assert.equal(r1.limit, 3);

    const r2 = limiter.checkRateLimit('192.168.1.10', 'run');
    assert.equal(r2.allowed, true);
    assert.equal(r2.remaining, 1);

    const r3 = limiter.checkRateLimit('192.168.1.10', 'run');
    assert.equal(r3.allowed, true);
    assert.equal(r3.remaining, 0);
  });

  it('rejects exceeded requests with TOO_MANY_REQUESTS and retry metadata', () => {
    const limiter = new ExecutionRateLimiter(
      {
        runMax: 2,
        runWindowMs: 60_000,
        sweepIntervalMs: 0,
      },
      mockNow
    );

    limiter.checkRateLimit('192.168.1.10', 'run');
    currentTime += 10_000;
    limiter.checkRateLimit('192.168.1.10', 'run');

    // Third request at t = 1,010,000 should exceed limit
    currentTime += 5_000;
    assert.throws(
      () => limiter.checkRateLimit('192.168.1.10', 'run'),
      (err: unknown) => {
        assert.ok(err instanceof TRPCError);
        assert.equal(err.code, 'TOO_MANY_REQUESTS');
        const cause = err.cause as { retryAfter: number; remaining: number; limit: number; resetAt: string };
        assert.ok(cause);
        assert.equal(cause.limit, 2);
        assert.equal(cause.remaining, 0);
        // Oldest request was at 1,000,000; window is 60,000; current time is 1,015,000
        // ms remaining = 1,000,000 + 60,000 - 1,015,000 = 45,000ms => 45s
        assert.equal(cause.retryAfter, 45);
        assert.ok(cause.resetAt);
        return true;
      }
    );
  });

  it('resets window after configured duration expires', () => {
    const limiter = new ExecutionRateLimiter(
      {
        runMax: 1,
        runWindowMs: 10_000,
        sweepIntervalMs: 0,
      },
      mockNow
    );

    const r1 = limiter.checkRateLimit('10.0.0.1', 'run');
    assert.equal(r1.allowed, true);

    // Immediate repeat fails
    assert.throws(() => limiter.checkRateLimit('10.0.0.1', 'run'), (err: unknown) => {
      assert.ok(err instanceof TRPCError);
      assert.equal(err.code, 'TOO_MANY_REQUESTS');
      return true;
    });

    // Advance clock past window
    currentTime += 10_001;

    // Should succeed again
    const r2 = limiter.checkRateLimit('10.0.0.1', 'run');
    assert.equal(r2.allowed, true);
    assert.equal(r2.remaining, 0);
  });

  it('guarantees client isolation: exhaustion by Client A does not impact Client B', () => {
    const limiter = new ExecutionRateLimiter(
      {
        runMax: 1,
        runWindowMs: 60_000,
        sweepIntervalMs: 0,
      },
      mockNow
    );

    // Client A uses quota
    limiter.checkRateLimit('1.1.1.1', 'run');
    assert.throws(() => limiter.checkRateLimit('1.1.1.1', 'run'), TRPCError);

    // Client B can still make request
    const rB = limiter.checkRateLimit('2.2.2.2', 'run');
    assert.equal(rB.allowed, true);
  });

  it('isolates run and submit quotas independently for the same client', () => {
    const limiter = new ExecutionRateLimiter(
      {
        runMax: 2,
        submitMax: 1,
        runWindowMs: 60_000,
        submitWindowMs: 60_000,
        sweepIntervalMs: 0,
      },
      mockNow
    );

    const ip = '172.16.0.5';

    // Submit quota exhausted
    limiter.checkRateLimit(ip, 'submit');
    assert.throws(() => limiter.checkRateLimit(ip, 'submit'), TRPCError);

    // Run quota is still available
    const runResult = limiter.checkRateLimit(ip, 'run');
    assert.equal(runResult.allowed, true);
    assert.equal(runResult.remaining, 1);
  });
});

describe('Execution Concurrency Tracker Unit Tests', () => {
  it('enforces per-client concurrency limits and safely releases slots', () => {
    const limiter = new ExecutionRateLimiter({
      clientConcurrency: 1,
      globalConcurrency: 10,
      sweepIntervalMs: 0,
    });

    const clientIp = '192.168.1.50';

    // Acquire slot 1
    const release1 = limiter.acquireConcurrencySlot(clientIp);

    // Attempt second concurrent execution from same client
    assert.throws(() => limiter.acquireConcurrencySlot(clientIp), (err: unknown) => {
      assert.ok(err instanceof TRPCError);
      assert.equal(err.code, 'TOO_MANY_REQUESTS');
      assert.match(err.message, /already in progress/i);
      return true;
    });

    // Release slot 1
    release1();

    // Now second execution can proceed
    const release2 = limiter.acquireConcurrencySlot(clientIp);
    release2();
  });

  it('enforces global concurrency limits across all clients', () => {
    const limiter = new ExecutionRateLimiter({
      clientConcurrency: 2,
      globalConcurrency: 2,
      sweepIntervalMs: 0,
    });

    const releaseA = limiter.acquireConcurrencySlot('client-A');
    const releaseB = limiter.acquireConcurrencySlot('client-B');

    // Both global slots full; client C is rejected
    assert.throws(() => limiter.acquireConcurrencySlot('client-C'), (err: unknown) => {
      assert.ok(err instanceof TRPCError);
      assert.equal(err.code, 'TOO_MANY_REQUESTS');
      assert.match(err.message, /capacity reached/i);
      return true;
    });

    // Releasing one opens slot for client C
    releaseA();
    const releaseC = limiter.acquireConcurrencySlot('client-C');

    releaseB();
    releaseC();
    assert.equal(limiter.getStats().activeGlobal, 0);
  });

  it('guarantees release is idempotent and cannot decrement below zero', () => {
    const limiter = new ExecutionRateLimiter({
      clientConcurrency: 2,
      globalConcurrency: 2,
      sweepIntervalMs: 0,
    });

    const release = limiter.acquireConcurrencySlot('client-X');
    assert.equal(limiter.getStats().activeGlobal, 1);

    release();
    assert.equal(limiter.getStats().activeGlobal, 0);

    // Duplicate releases must be no-ops
    release();
    release();
    assert.equal(limiter.getStats().activeGlobal, 0);
  });

  it('bounds memory growth via LRU eviction of idle clients when max tracked is reached', () => {
    let mockTime = 1000;
    const limiter = new ExecutionRateLimiter(
      {
        runMax: 10,
        maxTrackedClients: 3,
        sweepIntervalMs: 0,
      },
      () => mockTime
    );

    // Add 3 clients
    mockTime = 1000;
    limiter.checkRateLimit('ip-1', 'run');
    mockTime = 2000;
    limiter.checkRateLimit('ip-2', 'run');
    mockTime = 3000;
    limiter.checkRateLimit('ip-3', 'run');

    assert.equal(limiter.getStats().trackedClients, 3);

    // Adding 4th client should evict oldest idle client (ip-1)
    mockTime = 4000;
    limiter.checkRateLimit('ip-4', 'run');
    assert.equal(limiter.getStats().trackedClients, 3);

    // ip-1 was evicted; checking ip-1 again starts with a fresh quota
    const r1 = limiter.checkRateLimit('ip-1', 'run');
    assert.equal(r1.remaining, 9);
  });
});

describe('Trusted Proxy & IP Resolution Unit Tests', () => {
  it('normalizes IPv6-mapped IPv4 addresses', () => {
    assert.equal(normalizeIp('::ffff:127.0.0.1'), '127.0.0.1');
    assert.equal(normalizeIp('::ffff:192.168.1.1'), '192.168.1.1');
    assert.equal(normalizeIp('10.0.0.1'), '10.0.0.1');
    assert.equal(normalizeIp(null), '127.0.0.1');
  });

  it('ignores spoofed X-Forwarded-For headers when direct socket is not in trusted proxies', () => {
    const req = new Request('http://localhost:3001/trpc/execution.run', {
      headers: {
        'x-forwarded-for': '203.0.113.195, 70.41.3.18',
        'x-real-ip': '203.0.113.195',
      },
    });

    // Untrusted direct connection (e.g. from an untrusted public host)
    const directSocket = '198.51.100.42';
    const trustedProxies: string[] = ['127.0.0.1', '10.0.0.1'];

    const clientIp = resolveClientIp(req, directSocket, trustedProxies);
    // MUST NOT trust X-Forwarded-For or X-Real-IP
    assert.equal(clientIp, '198.51.100.42');
  });

  it('respects X-Forwarded-For leftmost IP when upstream connection is a configured trusted proxy', () => {
    const req = new Request('http://localhost:3001/trpc/execution.run', {
      headers: {
        'x-forwarded-for': '198.51.100.99, 10.0.0.1',
      },
    });

    const trustedProxySocket = '10.0.0.1';
    const trustedProxies: string[] = ['10.0.0.1', '127.0.0.1'];

    const clientIp = resolveClientIp(req, trustedProxySocket, trustedProxies);
    assert.equal(clientIp, '198.51.100.99');
  });

  it('falls back to direct when socket remote address is unavailable (e.g. unit test caller)', () => {
    const req = new Request('http://localhost:3001/trpc/execution.run');
    const clientIp = resolveClientIp(req, undefined, []);
    assert.equal(clientIp, 'direct');
  });
});

describe('End-to-End tRPC Caller with Rate Limiting', () => {
  it('enforces rate limits on executionRouter.run via tRPC context', async () => {
    const limiter = new ExecutionRateLimiter({
      runMax: 2,
      runWindowMs: 60_000,
      sweepIntervalMs: 0,
    });

    const caller = executionRouter.createCaller({
      clientIp: '203.0.113.5',
      rateLimiter: limiter,
    });

    // Mock fetch for Judge0 submissions
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          stdout: Buffer.from('[0,1]').toString('base64'),
          stderr: null,
          compile_output: null,
          status: { id: 3, description: 'Accepted' },
          time: '0.010',
          memory: 10000,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

    try {
      // Call 1: succeeds
      const res1 = await caller.run({
        problemSlug: 'two-sum',
        language: 'python',
        sourceCode: 'class Solution: pass',
      });
      assert.equal(res1.success, true);

      // Call 2: succeeds
      const res2 = await caller.run({
        problemSlug: 'two-sum',
        language: 'python',
        sourceCode: 'class Solution: pass',
      });
      assert.equal(res2.success, true);

      // Call 3: exceeds rate limit and throws TOO_MANY_REQUESTS
      await assert.rejects(
        () =>
          caller.run({
            problemSlug: 'two-sum',
            language: 'python',
            sourceCode: 'class Solution: pass',
          }),
        (err: unknown) => {
          assert.ok(err instanceof TRPCError);
          assert.equal(err.code, 'TOO_MANY_REQUESTS');
          return true;
        }
      );

      // Concurrency slot must be 0 after completed/rejected calls
      assert.equal(limiter.getStats().activeGlobal, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('releases concurrency slot even when execution throws an unhandled error', async () => {
    const limiter = new ExecutionRateLimiter({
      clientConcurrency: 1,
      runMax: 10,
      sweepIntervalMs: 0,
    });

    const caller = executionRouter.createCaller({
      clientIp: '203.0.113.9',
      rateLimiter: limiter,
    });

    // Calling with non-existent problem throws NOT_FOUND inside the try block
    await assert.rejects(
      () =>
        caller.run({
          problemSlug: 'non-existent-problem-slug-xyz',
          language: 'python',
          sourceCode: 'class Solution: pass',
        }),
      (err: unknown) => {
        assert.ok(err instanceof TRPCError);
        assert.equal(err.code, 'NOT_FOUND');
        return true;
      }
    );

    // Slot MUST have been released despite throwing NOT_FOUND
    assert.equal(limiter.getStats().activeGlobal, 0);

    // Next request can immediately acquire slot without being blocked
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          stdout: Buffer.from('[0,1]').toString('base64'),
          stderr: null,
          status: { id: 3, description: 'Accepted' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

    try {
      const nextRun = await caller.run({
        problemSlug: 'two-sum',
        language: 'python',
        sourceCode: 'class Solution: pass',
      });
      assert.equal(nextRun.success, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Execution Input Schema Bounds & Validation', () => {
  it('rejects problemSlug exceeding 128 characters', () => {
    const longSlug = 'a'.repeat(129);
    const runResult = runCodeInputSchema.safeParse({
      problemSlug: longSlug,
      language: 'python',
      sourceCode: 'pass',
    });
    assert.equal(runResult.success, false);
    if (!runResult.success) {
      assert.match(runResult.error.issues[0].message, /128 characters/i);
    }

    const submitResult = submitCodeInputSchema.safeParse({
      problemSlug: longSlug,
      language: 'python',
      sourceCode: 'pass',
    });
    assert.equal(submitResult.success, false);
    if (!submitResult.success) {
      assert.match(submitResult.error.issues[0].message, /128 characters/i);
    }
  });

  it('rejects stdin and expectedOutput exceeding 64KB', () => {
    const oversizedString = 'x'.repeat(65537);
    const stdinResult = runCodeInputSchema.safeParse({
      problemSlug: 'two-sum',
      language: 'python',
      sourceCode: 'pass',
      stdin: oversizedString,
    });
    assert.equal(stdinResult.success, false);
    if (!stdinResult.success) {
      assert.match(stdinResult.error.issues[0].message, /64KB/i);
    }

    const outputResult = runCodeInputSchema.safeParse({
      problemSlug: 'two-sum',
      language: 'python',
      sourceCode: 'pass',
      expectedOutput: oversizedString,
    });
    assert.equal(outputResult.success, false);
    if (!outputResult.success) {
      assert.match(outputResult.error.issues[0].message, /64KB/i);
    }
  });

  it('rejects testCaseIndex if out of range (< 0 or > 1000)', () => {
    const negativeResult = runCodeInputSchema.safeParse({
      problemSlug: 'two-sum',
      language: 'python',
      sourceCode: 'pass',
      testCaseIndex: -1,
    });
    assert.equal(negativeResult.success, false);

    const excessiveResult = runCodeInputSchema.safeParse({
      problemSlug: 'two-sum',
      language: 'python',
      sourceCode: 'pass',
      testCaseIndex: 1001,
    });
    assert.equal(excessiveResult.success, false);
    if (!excessiveResult.success) {
      assert.match(excessiveResult.error.issues[0].message, /range/i);
    }
  });

  it('accepts valid inputs within bounds', () => {
    const validRun = runCodeInputSchema.safeParse({
      problemSlug: 'two-sum',
      language: 'python',
      sourceCode: 'pass',
      stdin: '1 2 3',
      expectedOutput: '6',
      testCaseIndex: 2,
    });
    assert.equal(validRun.success, true);

    const validSubmit = submitCodeInputSchema.safeParse({
      problemSlug: 'two-sum',
      language: 'cpp',
      sourceCode: 'int main() {}',
    });
    assert.equal(validSubmit.success, true);
  });
});

