import {
  getGlobalLeaderboard,
  type GlobalLeaderboardEntry,
  type GlobalLeaderboardFilters,
} from '@code-arena/db';

export type { GlobalLeaderboardEntry, GlobalLeaderboardFilters };

export interface LeaderboardStore {
  getGlobalLeaderboard(filters?: GlobalLeaderboardFilters): Promise<GlobalLeaderboardEntry[]>;
}

export const dbLeaderboardStore: LeaderboardStore = {
  getGlobalLeaderboard(filters) {
    return getGlobalLeaderboard(filters);
  },
};
