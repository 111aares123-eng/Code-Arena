import test from 'node:test';
import assert from 'node:assert/strict';
import { executeWithJudge0 } from '../apps/api/src/services/judge0.ts';

test('queued Judge0 poll is aborted at the shared request deadline', async () => {
  const originalFetch = globalThis.fetch;
  const originalTimeout = process.env.JUDGE0_SUBMISSION_TIMEOUT_MS;
  process.env.JUDGE0_SUBMISSION_TIMEOUT_MS = '600';
  let requests = 0;
  globalThis.fetch = async (_url, options) => {
    if (++requests === 1) return new Response(JSON.stringify({ token: 'queued', status: { id: 1 } }));
    return new Promise((_resolve, reject) => {
      assert.ok(options.signal, 'poll must carry the deadline signal');
      if (options.signal.aborted) reject(new Error('aborted'));
      else options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
  };
  try {
    const result = await executeWithJudge0({ sourceCode: 'print(1)', language: 'python' });
    assert.equal(requests, 2);
    assert.equal(result.success, false);
    assert.match(result.error, /timed out/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalTimeout === undefined) delete process.env.JUDGE0_SUBMISSION_TIMEOUT_MS;
    else process.env.JUDGE0_SUBMISSION_TIMEOUT_MS = originalTimeout;
  }
});
