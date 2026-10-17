import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JUDGE0_STATUS, mapJudge0StatusToErrorType } from '../src/services/judge0-status.ts';

describe('Judge0 Status Mapping', () => {
  it('correctly maps ACCEPTED status (3) to no error', () => {
    const result = mapJudge0StatusToErrorType(JUDGE0_STATUS.ACCEPTED);
    assert.equal(result.isError, false);
    assert.equal(result.errorType, undefined);
  });

  it('correctly maps WRONG_ANSWER status (4) to wrong_answer error', () => {
    const result = mapJudge0StatusToErrorType(JUDGE0_STATUS.WRONG_ANSWER);
    assert.equal(result.isError, true);
    assert.equal(result.errorType, 'wrong_answer');
  });

  it('correctly maps TIME_LIMIT_EXCEEDED status (5) to time_limit error', () => {
    const result = mapJudge0StatusToErrorType(JUDGE0_STATUS.TIME_LIMIT_EXCEEDED);
    assert.equal(result.isError, true);
    assert.equal(result.errorType, 'time_limit');
  });

  it('correctly maps COMPILATION_ERROR status (6) to compile_error', () => {
    const result = mapJudge0StatusToErrorType(JUDGE0_STATUS.COMPILATION_ERROR);
    assert.equal(result.isError, true);
    assert.equal(result.errorType, 'compile_error');
  });

  it('correctly maps runtime error statuses (7-12) to runtime_error', () => {
    const runtimeStatuses = [
      JUDGE0_STATUS.RUNTIME_ERROR_SIGSEGV,
      JUDGE0_STATUS.RUNTIME_ERROR_SIGXFSZ,
      JUDGE0_STATUS.RUNTIME_ERROR_SIGFPE,
      JUDGE0_STATUS.RUNTIME_ERROR_SIGABRT,
      JUDGE0_STATUS.RUNTIME_ERROR_NZEC,
      JUDGE0_STATUS.RUNTIME_ERROR_OTHER,
    ];

    for (const status of runtimeStatuses) {
      const result = mapJudge0StatusToErrorType(status);
      assert.equal(result.isError, true, `Status ${status} should be error`);
      assert.equal(result.errorType, 'runtime_error', `Status ${status} should be runtime_error`);
    }
  });

  it('correctly maps INTERNAL_ERROR status (13) to unknown error', () => {
    const result = mapJudge0StatusToErrorType(JUDGE0_STATUS.INTERNAL_ERROR);
    assert.equal(result.isError, true);
    assert.equal(result.errorType, 'unknown');
  });

  it('correctly maps EXEC_FORMAT_ERROR status (14) to unknown error', () => {
    const result = mapJudge0StatusToErrorType(JUDGE0_STATUS.EXEC_FORMAT_ERROR);
    assert.equal(result.isError, true);
    assert.equal(result.errorType, 'unknown');
  });

  it('correctly maps IN_QUEUE status (1) to no error', () => {
    const result = mapJudge0StatusToErrorType(JUDGE0_STATUS.IN_QUEUE);
    assert.equal(result.isError, false);
    assert.equal(result.errorType, undefined);
  });

  it('correctly maps PROCESSING status (2) to no error', () => {
    const result = mapJudge0StatusToErrorType(JUDGE0_STATUS.PROCESSING);
    assert.equal(result.isError, false);
    assert.equal(result.errorType, undefined);
  });

  it('maps unknown status codes to unknown error', () => {
    const result = mapJudge0StatusToErrorType(999);
    assert.equal(result.isError, true);
    assert.equal(result.errorType, 'unknown');
  });

  it('maps zero status to unknown error', () => {
    const result = mapJudge0StatusToErrorType(0);
    assert.equal(result.isError, true);
    assert.equal(result.errorType, 'unknown');
  });

  it('maps negative status to unknown error', () => {
    const result = mapJudge0StatusToErrorType(-1);
    assert.equal(result.isError, true);
    assert.equal(result.errorType, 'unknown');
  });
});
