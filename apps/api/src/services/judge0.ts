import type { ExecutionLanguage, ExecutionResult, Judge0Status } from '@code-arena/shared';

export interface Judge0Config {
  baseUrl: string;
  apiKey?: string;
  apiHost?: string;
  pythonLangId: number;
  cppLangId: number;
  timeoutMs: number;
}

export function getJudge0Config(): Judge0Config {
  return {
    baseUrl: (process.env.JUDGE0_BASE_URL || 'http://localhost:2358').replace(/\/+$/, ''),
    apiKey: process.env.JUDGE0_API_KEY || undefined,
    apiHost: process.env.JUDGE0_API_HOST || undefined,
    pythonLangId: Number(process.env.JUDGE0_PYTHON_LANG_ID) || 71, // Standard Judge0: Python 3 (3.8.1)
    cppLangId: Number(process.env.JUDGE0_CPP_LANG_ID) || 54,       // Standard Judge0: C++ (GCC 9.2.0)
    timeoutMs: Number(process.env.JUDGE0_SUBMISSION_TIMEOUT_MS) || 10000,
  };
}

export function getJudge0LanguageId(language: ExecutionLanguage, config: Judge0Config): number {
  switch (language) {
    case 'python':
      return config.pythonLangId;
    case 'cpp':
      return config.cppLangId;
    default:
      return config.pythonLangId;
  }
}

function getRequestHeaders(config: Judge0Config): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (config.apiKey) {
    headers['X-RapidAPI-Key'] = config.apiKey;
    headers['X-Auth-Token'] = config.apiKey;
  }

  if (config.apiHost) {
    headers['X-RapidAPI-Host'] = config.apiHost;
  }

  return headers;
}

/**
 * Normalizes output strings for consistent comparison:
 * - Normalizes Windows CRLF to LF
 * - Trims trailing whitespace from each line
 * - Trims overall leading and trailing whitespace
 */
export function normalizeOutput(output: string | null | undefined): string {
  if (output === null || output === undefined) return '';
  return output
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

/**
 * Compares actual stdout against expected output with normalization.
 */
export function compareOutputs(
  actual: string | null | undefined,
  expected: string | null | undefined
): boolean {
  return normalizeOutput(actual) === normalizeOutput(expected);
}

export interface RawJudge0SubmissionResponse {
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  exit_code?: number | null;
  exit_signal?: number | null;
  status?: {
    id: number;
    description: string;
  };
  time?: string | null;
  memory?: number | null;
  token?: string;
}

export async function checkJudge0Health(): Promise<{
  available: boolean;
  version?: string;
  error?: string;
}> {
  const config = getJudge0Config();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(`${config.baseUrl}/about`, {
      method: 'GET',
      headers: getRequestHeaders(config),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { version?: string };
      return {
        available: true,
        version: data.version || 'CE (Active)',
      };
    }

    return {
      available: false,
      error: `Judge0 returned HTTP status ${res.status} (${res.statusText})`,
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : String(err);
    return {
      available: false,
      error: `Judge0 unavailable at ${config.baseUrl}: ${message}`,
    };
  }
}

/**
 * Executes source code via Judge0 CE instance.
 * Handles both synchronous wait=true and polling for queued jobs.
 */

function decodeBase64(val: string | null | undefined): string | null {
  if (val === null || val === undefined) return null;
  try {
    return Buffer.from(val, 'base64').toString('utf8');
  } catch {
    return val;
  }
}

export async function executeWithJudge0(params: {
  sourceCode: string;
  language: ExecutionLanguage;
  stdin?: string;
}): Promise<
  | { success: true; result: ExecutionResult }
  | { success: false; error: string; judge0Available: boolean }
> {
  const config = getJudge0Config();
  const languageId = getJudge0LanguageId(params.language, config);

  const payload = {
    source_code: Buffer.from(params.sourceCode).toString('base64'),
    language_id: languageId,
    stdin: Buffer.from(params.stdin || '').toString('base64'),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    // 1. Submit execution request to Judge0
    const url = `${config.baseUrl}/submissions?base64_encoded=true&wait=true`;
    const res = await fetch(url, {
      method: 'POST',
      headers: getRequestHeaders(config),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });


    if (!res.ok) {
      if (res.status === 429) {
        return {
          success: false,
          judge0Available: true,
          error: 'Judge0 execution rate limit reached. Please wait a few seconds before trying again.',
        };
      }

      const errText = await res.text().catch(() => '');
      return {
        success: false,
        judge0Available: false,
        error: `Judge0 returned HTTP ${res.status}: ${errText || res.statusText}`,
      };
    }

    let submission = (await res.json()) as RawJudge0SubmissionResponse;

    // 2. If status is in queue (1) or processing (2), poll until completed or timeout
    if (submission.token && (submission.status?.id === 1 || submission.status?.id === 2)) {
      const pollStart = Date.now();
      const maxPollMs = config.timeoutMs;

      while (
        submission.status &&
        (submission.status.id === 1 || submission.status.id === 2) &&
        Date.now() - pollStart < maxPollMs
      ) {
        // Sleep 500ms between polls
        await new Promise((r) => setTimeout(r, 500));

        const pollRes = await fetch(
          `${config.baseUrl}/submissions/${submission.token}?base64_encoded=true`,
          {
            method: 'GET',
            headers: getRequestHeaders(config),
            signal: controller.signal,
          }
        );

        if (pollRes.ok) {
          submission = (await pollRes.json()) as RawJudge0SubmissionResponse;
        }
      }
    }

    if (!submission.status || submission.status.id < 3) {
      return { success: false, judge0Available: true, error: 'Execution did not finish before the request deadline. Please try again.' };
    }

    // 3. Map status and errors
    const statusId = submission.status?.id ?? 0;
    const statusDesc = submission.status?.description ?? 'Unknown';
    const status: Judge0Status = {
      id: statusId,
      description: statusDesc,
    };

    let errorType: ExecutionResult['errorType'];
    let isError = false;

    if (statusId === 6) {
      errorType = 'compile_error';
      isError = true;
    } else if (statusId >= 7 && statusId <= 12) {
      errorType = 'runtime_error';
      isError = true;
    } else if (statusId === 5) {
      errorType = 'time_limit';
      isError = true;
    } else if (statusId === 13 || statusId === 14) {
      errorType = 'unknown';
      isError = true;
    } else if (statusId !== 3 && statusId !== 4) {
      isError = true;
      errorType = 'unknown';
    }

    const result: ExecutionResult = {
      stdout: decodeBase64(submission.stdout),
      stderr: decodeBase64(submission.stderr),
      compileOutput: decodeBase64(submission.compile_output),
      message: decodeBase64(submission.message),
      exitCode: submission.exit_code ?? null,
      exitSignal: submission.exit_signal ?? null,
      time: submission.time ?? null,
      memory: submission.memory ?? null,
      status,
      token: submission.token,
      isError,
      errorType,
    };

    return {
      success: true,
      result,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    if (controller.signal.aborted || message.includes('abort') || message.includes('timeout')) {
      return {
        success: false,
        judge0Available: true,
        error: `Execution request timed out after ${config.timeoutMs / 1000} seconds.`,
      };
    }

    return {
      success: false,
      judge0Available: false,
      error: `Judge0 execution service unreachable at ${config.baseUrl}: ${message}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
