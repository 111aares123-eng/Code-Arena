import type { Problem, ProblemDifficulty } from '@code-arena/shared';
import { getMockProblems, getMockProblemBySlug, getDifficultyStats } from '@code-arena/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ProblemListResponse {
  items: Problem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  source: 'api' | 'fallback';
}

export interface FetchProblemsParams {
  search?: string;
  difficulty?: 'ALL' | ProblemDifficulty;
  tag?: string;
  page?: number;
  limit?: number;
}

/**
 * Fetches published problems from the tRPC API with graceful fallback to mock data.
 */
export async function fetchProblems(
  params: FetchProblemsParams = {}
): Promise<ProblemListResponse> {
  const queryParams: Record<string, unknown> = {};
  if (params.search) queryParams.search = params.search;
  if (params.difficulty && params.difficulty !== 'ALL') queryParams.difficulty = params.difficulty;
  if (params.tag) queryParams.tag = params.tag;
  if (params.page) queryParams.page = params.page;
  if (params.limit) queryParams.limit = params.limit;

  const inputParam = encodeURIComponent(JSON.stringify(queryParams));
  const url = `${API_BASE_URL}/trpc/problem.list?input=${inputParam}`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 30 },
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`API returned status ${res.status}`);
    }

    const json = await res.json();
    if (json.result?.data) {
      return {
        ...json.result.data,
        source: 'api',
      };
    }

    throw new Error(json.error?.message || 'Invalid API response format');
  } catch (err) {
    // Deliberate fallback to mock data if API is offline
    console.warn('[Problem Library] API query failed, using fallback dataset:', err);

    let items = getMockProblems();

    if (params.difficulty && params.difficulty !== 'ALL') {
      items = items.filter((p) => p.difficulty === params.difficulty);
    }

    if (params.tag) {
      items = items.filter((p) => p.tags.includes(params.tag!));
    }

    if (params.search?.trim()) {
      const q = params.search.toLowerCase().trim();
      items = items.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.shortDescription.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return {
      items,
      total: items.length,
      page: params.page ?? 1,
      limit: params.limit ?? 50,
      totalPages: 1,
      source: 'fallback',
    };
  }
}

/**
 * Fetches a single published problem by slug from the tRPC API.
 * Returns null if the problem does not exist or is unpublished.
 */
export async function fetchProblemBySlug(
  slug: string
): Promise<{ problem: Problem | null; source: 'api' | 'fallback' }> {
  const inputParam = encodeURIComponent(JSON.stringify({ slug }));
  const url = `${API_BASE_URL}/trpc/problem.bySlug?input=${inputParam}`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 30 },
      headers: { Accept: 'application/json' },
    });

    if (res.status === 404) {
      return { problem: null, source: 'api' };
    }

    const json = await res.json();
    if (json.error?.data?.code === 'NOT_FOUND') {
      return { problem: null, source: 'api' };
    }

    if (json.result?.data) {
      return { problem: json.result.data as Problem, source: 'api' };
    }

    throw new Error(json.error?.message || 'Invalid API response');
  } catch (err) {
    console.warn(`[Problem Library] API query for "${slug}" failed, checking fallback dataset:`, err);
    const mock = getMockProblemBySlug(slug) || null;
    return { problem: mock, source: 'fallback' };
  }
}

/**
 * Fetches difficulty counts and totals from the tRPC API.
 */
export async function fetchProblemStats(): Promise<Record<ProblemDifficulty | 'Total', number>> {
  const url = `${API_BASE_URL}/trpc/problem.stats`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 30 },
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) throw new Error(`API returned status ${res.status}`);

    const json = await res.json();
    if (json.result?.data) {
      return json.result.data;
    }
  } catch (err) {
    console.warn('[Problem Library] API stats query failed, using fallback stats:', err);
  }

  return getDifficultyStats();
}

import type {
  RunCodeInput,
  RunCodeResponse,
  SubmitCodeInput,
  SubmitCodeResponse,
} from '@code-arena/shared';

/**
 * Executes source code via backend Judge0 CE runner.
 */
export async function runCode(input: RunCodeInput): Promise<RunCodeResponse> {
  const url = `${API_BASE_URL}/trpc/execution.run`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(input),
    });

    const json = await res.json();

    if (!res.ok || json.error) {
      const errMsg = json.error?.message || `API returned HTTP ${res.status}`;
      return {
        success: false,
        judge0Available: false,
        language: input.language,
        error: errMsg,
        executedAt: new Date().toISOString(),
      };
    }

    if (json.result?.data) {
      return json.result.data as RunCodeResponse;
    }

    throw new Error('Invalid response format from execution.run');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      judge0Available: false,
      language: input.language,
      error: `Could not reach execution API server at ${API_BASE_URL}: ${message}`,
      executedAt: new Date().toISOString(),
    };
  }
}

/**
 * Submits source code for sample test evaluation via backend Judge0 CE runner.
 */
export async function submitCode(input: SubmitCodeInput): Promise<SubmitCodeResponse> {
  const url = `${API_BASE_URL}/trpc/execution.submit`;
  const submittedAt = new Date().toISOString();
  const disclaimer =
    'Evaluated against available sample test cases only. Passing sample test cases does not guarantee acceptance on hidden judge tests.';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(input),
    });

    const json = await res.json();

    if (!res.ok || json.error) {
      const errMsg = json.error?.message || `API returned HTTP ${res.status}`;
      return {
        success: false,
        judge0Available: false,
        language: input.language,
        verdict: 'SERVICE_UNAVAILABLE',
        totalCases: 0,
        passedCases: 0,
        evaluations: [],
        summary: `Submission failed: ${errMsg}`,
        error: errMsg,
        disclaimer,
        submittedAt,
      };
    }

    if (json.result?.data) {
      return json.result.data as SubmitCodeResponse;
    }

    throw new Error('Invalid response format from execution.submit');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      judge0Available: false,
      language: input.language,
      verdict: 'SERVICE_UNAVAILABLE',
      totalCases: 0,
      passedCases: 0,
      evaluations: [],
      summary: `Could not connect to API server: ${message}`,
      error: message,
      disclaimer,
      submittedAt,
    };
  }
}

/**
 * Health check for Judge0 CE connectivity.
 */
export async function checkExecutionHealth(): Promise<{
  available: boolean;
  judge0BaseUrl: string;
  error?: string;
}> {
  const url = `${API_BASE_URL}/trpc/execution.health`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.result?.data || { available: false, judge0BaseUrl: 'unknown' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      available: false,
      judge0BaseUrl: 'unknown',
      error: message,
    };
  }
}

