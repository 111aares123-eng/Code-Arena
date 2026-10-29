import { cache } from 'react';
import type { Problem, ProblemDifficulty } from '@code-arena/shared';
import { getMockProblems, getMockProblemBySlug, getDifficultyStats } from '@code-arena/shared';
import type {
  RunCodeInput,
  RunCodeResponse,
  SubmitCodeInput,
  SubmitCodeResponse,
} from '@code-arena/shared';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '');

/**
 * In-memory client instrumentation tracking API request counts and cache metrics.
 */
export interface ApiMetrics {
  totalRequests: number;
  requestsByProcedure: Record<string, number>;
  deduplicatedCalls: Record<string, number>;
}

const metrics: ApiMetrics = {
  totalRequests: 0,
  requestsByProcedure: {},
  deduplicatedCalls: {},
};

export function getApiMetrics(): ApiMetrics {
  return {
    totalRequests: metrics.totalRequests,
    requestsByProcedure: { ...metrics.requestsByProcedure },
    deduplicatedCalls: { ...metrics.deduplicatedCalls },
  };
}

export function resetApiMetrics(): void {
  metrics.totalRequests = 0;
  metrics.requestsByProcedure = {};
  metrics.deduplicatedCalls = {};
}

function recordApiCall(procedure: string) {
  metrics.totalRequests += 1;
  metrics.requestsByProcedure[procedure] = (metrics.requestsByProcedure[procedure] || 0) + 1;
}

function recordDeduplicatedCall(procedure: string) {
  metrics.deduplicatedCalls[procedure] = (metrics.deduplicatedCalls[procedure] || 0) + 1;
}

/**
 * Standard tRPC envelope formats.
 */
export interface TrpcSuccessEnvelope<T> {
  result: {
    data: T;
  };
}

export interface TrpcErrorEnvelope {
  error: {
    message: string;
    code?: number;
    data?: {
      code?: string;
      httpStatus?: number;
      stack?: string;
      path?: string;
    };
  };
}

export type TrpcEnvelope<T> = TrpcSuccessEnvelope<T> | TrpcErrorEnvelope;

/**
 * Typed client query helper using standard tRPC protocol over HTTP.
 */
export async function trpcQuery<TInput extends Record<string, unknown> | undefined, TOutput>(
  procedure: string,
  input?: TInput,
  options: RequestInit & { revalidate?: number | false } = {}
): Promise<{ data: TOutput | null; notFound?: boolean; error?: string }> {
  recordApiCall(procedure);

  let url = `${API_BASE_URL}/trpc/${procedure}`;
  if (input !== undefined && Object.keys(input).length > 0) {
    const encoded = encodeURIComponent(JSON.stringify(input));
    url += `?input=${encoded}`;
  }

  const { revalidate, ...init } = options;
  const fetchOptions: RequestInit & { next?: { revalidate?: number | false } } = {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.headers || {}),
    },
  };

  if (revalidate !== undefined) {
    fetchOptions.next = { revalidate };
  }

  const res = await fetch(url, fetchOptions);

  if (res.status === 404) {
    return { data: null, notFound: true, error: 'Resource not found' };
  }

  if (!res.ok) {
    let errMessage = `HTTP ${res.status}`;
    try {
      const errJson = (await res.json()) as TrpcErrorEnvelope;
      if (errJson.error?.data?.code === 'NOT_FOUND') {
        return { data: null, notFound: true, error: errJson.error.message };
      }
      if (errJson.error?.message) errMessage = errJson.error.message;
    } catch {
      // Ignore json parse error
    }
    return { data: null, error: errMessage };
  }

  const json = (await res.json()) as TrpcEnvelope<TOutput>;
  if ('error' in json && json.error) {
    if (json.error.data?.code === 'NOT_FOUND') {
      return { data: null, notFound: true, error: json.error.message };
    }
    return { data: null, error: json.error.message };
  }

  if ('result' in json && json.result?.data !== undefined) {
    return { data: json.result.data };
  }

  return { data: null, error: 'Malformed tRPC response envelope' };
}

/**
 * Typed client mutation helper using standard tRPC protocol over HTTP.
 */
export async function trpcMutate<TInput, TOutput>(
  procedure: string,
  input: TInput,
  options: RequestInit = {}
): Promise<{ data: TOutput | null; error?: string }> {
  recordApiCall(procedure);

  const url = `${API_BASE_URL}/trpc/${procedure}`;
  const res = await fetch(url, {
    method: 'POST',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
    body: JSON.stringify(input),
  });

  const json = (await res.json()) as TrpcEnvelope<TOutput>;
  if (!res.ok || ('error' in json && json.error)) {
    const message = ('error' in json && json.error?.message) || `HTTP ${res.status}`;
    return { data: null, error: message };
  }

  if ('result' in json && json.result?.data !== undefined) {
    return { data: json.result.data };
  }

  return { data: null, error: 'Malformed tRPC mutation response envelope' };
}

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
  if (params.search?.trim()) queryParams.search = params.search.trim();
  if (params.difficulty && params.difficulty !== 'ALL') queryParams.difficulty = params.difficulty;
  if (params.tag?.trim()) queryParams.tag = params.tag.trim();
  if (params.page) queryParams.page = params.page;
  if (params.limit) queryParams.limit = params.limit;

  try {
    const { data, error } = await trpcQuery<Record<string, unknown>, ProblemListResponse>(
      'problem.list',
      queryParams,
      { revalidate: 30 }
    );

    if (data) {
      return {
        ...data,
        source: 'api',
      };
    }

    throw new Error(error || 'Invalid API response format');
  } catch (err) {
    console.warn('[Problem Library] API query failed, using fallback dataset:', err);

    let items = getMockProblems();

    if (params.difficulty && params.difficulty !== 'ALL') {
      items = items.filter((p) => p.difficulty === params.difficulty);
    }

    if (params.tag?.trim()) {
      const t = params.tag.trim();
      items = items.filter((p) => p.tags.includes(t));
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

    const page = Math.max(1, Math.floor(params.page || 1));
    const limit = Math.max(1, Math.floor(params.limit || 50));
    return {
      items: items.slice((page - 1) * limit, page * limit),
      total: items.length,
      page,
      limit,
      totalPages: Math.ceil(items.length / limit),
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
  try {
    const { data, notFound, error } = await trpcQuery<{ slug: string }, Problem>(
      'problem.bySlug',
      { slug },
      { revalidate: 30 }
    );

    if (notFound) {
      return { problem: null, source: 'api' };
    }

    if (data) {
      return { problem: data, source: 'api' };
    }

    throw new Error(error || 'Invalid API response');
  } catch (err) {
    console.warn(`[Problem Library] API query for "${slug}" failed, checking fallback dataset:`, err);
    const mock = getMockProblemBySlug(slug) || null;
    return { problem: mock, source: 'fallback' };
  }
}

/**
 * Deduplicated problem detail getter using React Server Component request-scoped cache.
 * When called multiple times within a single server request (e.g. generateMetadata and ProblemDetailSection),
 * only one fetch executes.
 */
export const getCachedProblemBySlug = cache(async (slug: string) => {
  recordDeduplicatedCall(`problem.bySlug:${slug}`);
  return fetchProblemBySlug(slug);
});

/**
 * Fetches difficulty counts and totals from the tRPC API.
 */
export async function fetchProblemStats(): Promise<Record<ProblemDifficulty | 'Total', number>> {
  try {
    const { data } = await trpcQuery<undefined, Record<ProblemDifficulty | 'Total', number>>(
      'problem.stats',
      undefined,
      { revalidate: 30 }
    );

    if (data) {
      return data;
    }
  } catch (err) {
    console.warn('[Problem Library] API stats query failed, using fallback stats:', err);
  }

  return getDifficultyStats();
}

/**
 * Executes source code via backend Judge0 CE runner.
 */
export async function runCode(input: RunCodeInput): Promise<RunCodeResponse> {
  try {
    const { data, error } = await trpcMutate<RunCodeInput, RunCodeResponse>('execution.run', input);

    if (data) {
      return data;
    }

    return {
      success: false,
      judge0Available: false,
      language: input.language,
      error: error || 'API returned an error',
      executedAt: new Date().toISOString(),
    };
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
  const submittedAt = new Date().toISOString();
  const disclaimer =
    'Evaluated against available sample test cases only. Passing sample test cases does not guarantee acceptance on hidden judge tests.';

  try {
    const { data, error } = await trpcMutate<SubmitCodeInput, SubmitCodeResponse>(
      'execution.submit',
      input
    );

    if (data) {
      return data;
    }

    return {
      success: false,
      judge0Available: false,
      language: input.language,
      verdict: 'SERVICE_UNAVAILABLE',
      totalCases: 0,
      passedCases: 0,
      evaluations: [],
      summary: `Submission failed: ${error || 'Unknown error'}`,
      error: error || 'Unknown error',
      disclaimer,
      submittedAt,
    };
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
  try {
    const { data } = await trpcQuery<
      undefined,
      { available: boolean; judge0BaseUrl: string; error?: string }
    >('execution.health');
    return data || { available: false, judge0BaseUrl: 'unknown' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      available: false,
      judge0BaseUrl: 'unknown',
      error: message,
    };
  }
}

export interface GlobalLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  xp: number;
  rating: number;
  createdAt: string | Date;
}

export interface StudentProgressSummary {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  xp: number;
  rating: number;
  solvedCount: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  currentStreak: number;
  maxStreak: number;
  solvedProblemSlugs: string[];
}

/**
 * Fetches real database rankings from the backend API.
 * Returns null if the API is offline.
 */
export async function fetchLeaderboard(params: { limit?: number; offset?: number } = {}): Promise<{
  entries: GlobalLeaderboardEntry[];
  total: number;
} | null> {
  const queryParams: Record<string, unknown> = {};
  if (params.limit) queryParams.limit = params.limit;
  if (params.offset) queryParams.offset = params.offset;

  try {
    const { data } = await trpcQuery<
      Record<string, unknown>,
      { entries: GlobalLeaderboardEntry[]; total: number }
    >('leaderboard.global', queryParams, { revalidate: 30 });

    return data;
  } catch (err) {
    console.warn('[Leaderboard] API query failed, falling back:', err);
    return null;
  }
}

/**
 * Fetches server-verified progress for the current authenticated student.
 * Returns null if unauthenticated or API is offline.
 */
export async function fetchCurrentProgress(): Promise<StudentProgressSummary | null> {
  try {
    const { data } = await trpcQuery<
      undefined,
      { authenticated: boolean; progress: StudentProgressSummary | null }
    >('progress.current');

    if (data?.authenticated && data.progress) {
      return data.progress;
    }

    return null;
  } catch {
    return null;
  }
}
