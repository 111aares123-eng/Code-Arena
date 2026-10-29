import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { problemListInputSchema } from '../src/routers/problem';

describe('Problem Router Input Schema & Validation', () => {
  it('applies sensible defaults for empty filter input', () => {
    const parsed = problemListInputSchema.parse({});
    assert.equal(parsed.search, '');
    assert.equal(parsed.difficulty, 'ALL');
    assert.equal(parsed.tag, '');
    assert.equal(parsed.page, 1);
    assert.equal(parsed.limit, 50);
  });

  it('validates supported difficulty values and rejects arbitrary strings', () => {
    const validEasy = problemListInputSchema.parse({ difficulty: 'Easy' });
    assert.equal(validEasy.difficulty, 'Easy');

    const validAll = problemListInputSchema.parse({ difficulty: 'ALL' });
    assert.equal(validAll.difficulty, 'ALL');

    assert.throws(() => {
      problemListInputSchema.parse({ difficulty: 'SuperHard' });
    });
  });

  it('enforces pagination bounds: min 1 page, limit between 1 and 100', () => {
    const validPage = problemListInputSchema.parse({ page: 3, limit: 25 });
    assert.equal(validPage.page, 3);
    assert.equal(validPage.limit, 25);

    assert.throws(() => {
      problemListInputSchema.parse({ page: 0 });
    });

    assert.throws(() => {
      problemListInputSchema.parse({ limit: 0 });
    });

    assert.throws(() => {
      problemListInputSchema.parse({ limit: 101 });
    });
  });

  it('accepts search terms and topic tags', () => {
    const parsed = problemListInputSchema.parse({
      search: 'two sum',
      tag: 'Dynamic Programming',
    });
    assert.equal(parsed.search, 'two sum');
    assert.equal(parsed.tag, 'Dynamic Programming');
  });
});
