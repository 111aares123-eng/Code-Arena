import type { SubmissionSelect } from '@code-arena/db';
import {
  createSubmission,
  getSubmissionById,
  listSubmissionsByUser,
  type CreateSubmissionParams,
  type ListSubmissionsFilters,
} from '@code-arena/db';

export type { CreateSubmissionParams, ListSubmissionsFilters };

export interface SubmissionStore {
  create(params: CreateSubmissionParams): Promise<SubmissionSelect>;
  getById(id: string): Promise<SubmissionSelect | null>;
  listByUser(userId: string, filters?: ListSubmissionsFilters): Promise<SubmissionSelect[]>;
}

export const dbSubmissionStore: SubmissionStore = {
  create(params) {
    return createSubmission(params);
  },
  getById(id) {
    return getSubmissionById(id);
  },
  listByUser(userId, filters) {
    return listSubmissionsByUser(userId, filters);
  },
};
