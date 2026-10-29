import test from 'node:test';
import assert from 'node:assert/strict';

// 1. Test tRPC Input Parameter Serializer & Query URL Builder
function buildTrpcQueryUrl(baseUrl, procedure, input) {
  let url = `${baseUrl.replace(/\/+$/, '')}/trpc/${procedure}`;
  if (input !== undefined && Object.keys(input).length > 0) {
    const cleanInput = {};
    for (const [key, val] of Object.entries(input)) {
      if (val !== undefined && val !== null) {
        if (key === 'difficulty' && val === 'ALL') {
          // Exclude 'ALL' difficulty to avoid filtering out problems
          continue;
        } else if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed) cleanInput[key] = trimmed;
        } else {
          cleanInput[key] = val;
        }
      }
    }
    if (Object.keys(cleanInput).length > 0) {
      url += `?input=${encodeURIComponent(JSON.stringify(cleanInput))}`;
    }
  }
  return url;
}

test('buildTrpcQueryUrl correctly encodes tRPC input and strips default ALL difficulty', () => {
  const url1 = buildTrpcQueryUrl('http://localhost:3001', 'problem.list', {
    search: '  two sum  ',
    difficulty: 'ALL',
    tag: 'Array',
    page: 2,
    limit: 25,
  });

  const parsedUrl = new URL(url1);
  assert.equal(parsedUrl.pathname, '/trpc/problem.list');
  const inputJson = JSON.parse(decodeURIComponent(parsedUrl.searchParams.get('input')));
  assert.equal(inputJson.search, 'two sum'); // trimmed
  assert.equal(inputJson.tag, 'Array');
  assert.equal(inputJson.page, 2);
  assert.equal(inputJson.limit, 25);
  assert.equal(inputJson.difficulty, undefined); // 'ALL' was omitted
});

test('buildTrpcQueryUrl omits input parameter when query params are empty', () => {
  const url = buildTrpcQueryUrl('http://localhost:3001', 'problem.stats', {});
  assert.equal(url, 'http://localhost:3001/trpc/problem.stats');
});

// 2. Test Request-Scoped Cache Deduplication & Instrumentation
class RequestCache {
  constructor() {
    this.cache = new Map();
    this.fetchCount = 0;
    this.deduplicatedCallCount = 0;
  }

  fetchProblem(slug) {
    this.fetchCount += 1;
    return Promise.resolve({
      id: `prob-${slug}`,
      slug,
      title: slug === 'two-sum' ? 'Two Sum' : slug,
    });
  }

  getCachedProblem(slug) {
    this.deduplicatedCallCount += 1;
    if (!this.cache.has(slug)) {
      this.cache.set(slug, this.fetchProblem(slug));
    }
    return this.cache.get(slug);
  }
}

test('request-scoped cache deduplicates concurrent calls and halves network requests', async () => {
  const requestCtx = new RequestCache();

  // Simulating generateMetadata and ProblemDetailSection both fetching the same slug
  const [metaResult, renderResult] = await Promise.all([
    requestCtx.getCachedProblem('two-sum'),
    requestCtx.getCachedProblem('two-sum'),
  ]);

  assert.equal(metaResult.slug, 'two-sum');
  assert.equal(renderResult.slug, 'two-sum');
  assert.equal(metaResult, renderResult); // Same promise result

  // Total deduplicated calls invoked: 2
  assert.equal(requestCtx.deduplicatedCallCount, 2);

  // Actual fetcher executed: exactly 1 (0 duplicate fetches, 50% request reduction)
  assert.equal(requestCtx.fetchCount, 1);
});

test('uncached fetching makes redundant network requests for identical slugs', async () => {
  const requestCtx = new RequestCache();

  // Without deduplication cache:
  await requestCtx.fetchProblem('two-sum');
  await requestCtx.fetchProblem('two-sum');

  // Both calls hit the network
  assert.equal(requestCtx.fetchCount, 2);
});

// 3. Test In-Memory & Server-Side Filter Simulation
const SAMPLE_PROBLEMS = [
  { id: '1', title: 'Two Sum', difficulty: 'Easy', tags: ['Array', 'Hash Table'], shortDescription: 'Find pair summing to target' },
  { id: '2', title: 'Add Two Numbers', difficulty: 'Medium', tags: ['Linked List', 'Math'], shortDescription: 'Add two numbers as lists' },
  { id: '3', title: 'Trapping Rain Water', difficulty: 'Hard', tags: ['Array', 'Two Pointers'], shortDescription: 'Compute trapped rainwater' },
  { id: '4', title: 'Valid Parentheses', difficulty: 'Easy', tags: ['String', 'Stack'], shortDescription: 'Validate bracket strings' },
];

function filterProblems(problems, { search, difficulty, tag, page = 1, limit = 50 }) {
  let items = problems;
  if (difficulty && difficulty !== 'ALL') {
    items = items.filter((p) => p.difficulty === difficulty);
  }
  if (tag) {
    items = items.filter((p) => p.tags.includes(tag));
  }
  if (search?.trim()) {
    const q = search.toLowerCase().trim();
    items = items.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.shortDescription.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    );
  }
  const total = items.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const offset = (page - 1) * limit;
  return {
    items: items.slice(offset, offset + limit),
    total,
    page,
    limit,
    totalPages,
  };
}

test('filtering by difficulty returns only matching items', () => {
  const easy = filterProblems(SAMPLE_PROBLEMS, { difficulty: 'Easy' });
  assert.equal(easy.items.length, 2);
  assert.ok(easy.items.every((p) => p.difficulty === 'Easy'));

  const hard = filterProblems(SAMPLE_PROBLEMS, { difficulty: 'Hard' });
  assert.equal(hard.items.length, 1);
  assert.equal(hard.items[0].title, 'Trapping Rain Water');
});

test('filtering by topic tag isolates problems matching the tag', () => {
  const arrayProbs = filterProblems(SAMPLE_PROBLEMS, { tag: 'Array' });
  assert.equal(arrayProbs.items.length, 2);
  assert.ok(arrayProbs.items.every((p) => p.tags.includes('Array')));

  const stackProbs = filterProblems(SAMPLE_PROBLEMS, { tag: 'Stack' });
  assert.equal(stackProbs.items.length, 1);
  assert.equal(stackProbs.items[0].title, 'Valid Parentheses');
});

test('filtering by search term searches title, description, and tags', () => {
  const searchByTitle = filterProblems(SAMPLE_PROBLEMS, { search: 'two sum' });
  assert.equal(searchByTitle.items.length, 1);
  assert.equal(searchByTitle.items[0].title, 'Two Sum');

  const searchByDesc = filterProblems(SAMPLE_PROBLEMS, { search: 'bracket' });
  assert.equal(searchByDesc.items.length, 1);
  assert.equal(searchByDesc.items[0].title, 'Valid Parentheses');

  const searchEmpty = filterProblems(SAMPLE_PROBLEMS, { search: 'non-existent-xyz' });
  assert.equal(searchEmpty.items.length, 0);
  assert.equal(searchEmpty.total, 0);
});

test('pagination correctly partitions results and computes page bounds', () => {
  const p1 = filterProblems(SAMPLE_PROBLEMS, { page: 1, limit: 2 });
  assert.equal(p1.items.length, 2);
  assert.equal(p1.page, 1);
  assert.equal(p1.totalPages, 2);
  assert.equal(p1.total, 4);

  const p2 = filterProblems(SAMPLE_PROBLEMS, { page: 2, limit: 2 });
  assert.equal(p2.items.length, 2);
  assert.equal(p2.page, 2);
  assert.notEqual(p1.items[0].id, p2.items[0].id);
});
