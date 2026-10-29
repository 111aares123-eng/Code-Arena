import {
  recordProblemEvaluationProgress,
  getStudentProgress,
  type RecordProgressParams,
  type ProgressAwardResult,
  type StudentProgressSummary,
} from '@code-arena/db';

export type { RecordProgressParams, ProgressAwardResult, StudentProgressSummary };

export interface ProgressStore {
  recordProgress(params: RecordProgressParams): Promise<ProgressAwardResult>;
  getProgress(userId: string): Promise<StudentProgressSummary | null>;
}

export const dbProgressStore: ProgressStore = {
  recordProgress(params) {
    return recordProblemEvaluationProgress(params);
  },
  getProgress(userId) {
    return getStudentProgress(userId);
  },
};
