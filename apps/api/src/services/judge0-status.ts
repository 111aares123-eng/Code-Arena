/**
 * Judge0 CE Status Code Reference
 * See: https://github.com/judge0/judge0/blob/master/CHANGELOG.md
 */

export const JUDGE0_STATUS = {
  // Queue statuses
  IN_QUEUE: 1,
  PROCESSING: 2,

  // Success statuses
  ACCEPTED: 3,

  // Error statuses
  WRONG_ANSWER: 4,
  TIME_LIMIT_EXCEEDED: 5,
  COMPILATION_ERROR: 6,
  RUNTIME_ERROR_SIGSEGV: 7,
  RUNTIME_ERROR_SIGXFSZ: 8,
  RUNTIME_ERROR_SIGFPE: 9,
  RUNTIME_ERROR_SIGABRT: 10,
  RUNTIME_ERROR_NZEC: 11,
  RUNTIME_ERROR_OTHER: 12,
  INTERNAL_ERROR: 13,
  EXEC_FORMAT_ERROR: 14,

  // Note: Some Judge0 deployments use different IDs for memory limit
  // Standard: Not defined in base Judge0 (handled via status 11 + message)
  // RapidAPI: May use custom status codes
} as const;

export type Judge0StatusId = typeof JUDGE0_STATUS[keyof typeof JUDGE0_STATUS];

/**
 * Maps Judge0 status ID to execution error type
 */
export function mapJudge0StatusToErrorType(statusId: number): {
  isError: boolean;
  errorType?: 'compile_error' | 'runtime_error' | 'time_limit' | 'wrong_answer' | 'unknown';
} {
  // Success - Accepted
  if (statusId === JUDGE0_STATUS.ACCEPTED) {
    return { isError: false };
  }

  // Wrong Answer
  if (statusId === JUDGE0_STATUS.WRONG_ANSWER) {
    return { isError: true, errorType: 'wrong_answer' };
  }

  // Time Limit Exceeded
  if (statusId === JUDGE0_STATUS.TIME_LIMIT_EXCEEDED) {
    return { isError: true, errorType: 'time_limit' };
  }

  // Compilation Error
  if (statusId === JUDGE0_STATUS.COMPILATION_ERROR) {
    return { isError: true, errorType: 'compile_error' };
  }

  // Runtime Errors (SIGSEGV, SIGXFSZ, SIGFPE, SIGABRT, NZEC, Other)
  if (statusId >= JUDGE0_STATUS.RUNTIME_ERROR_SIGSEGV &&
      statusId <= JUDGE0_STATUS.RUNTIME_ERROR_OTHER) {
    return { isError: true, errorType: 'runtime_error' };
  }

  // Internal/Exec Format Errors
  if (statusId === JUDGE0_STATUS.INTERNAL_ERROR ||
      statusId === JUDGE0_STATUS.EXEC_FORMAT_ERROR) {
    return { isError: true, errorType: 'unknown' };
  }

  // Queue/Processing (should not reach here in normal flow)
  if (statusId === JUDGE0_STATUS.IN_QUEUE ||
      statusId === JUDGE0_STATUS.PROCESSING) {
    return { isError: false };
  }

  // Unknown status
  return { isError: true, errorType: 'unknown' };
}
