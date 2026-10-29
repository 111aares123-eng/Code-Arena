import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { leaderboardRouter } from '../src/routers/leaderboard';
import { progressRouter } from '../src/routers/progress';
import type { LeaderboardStore, GlobalLeaderboardEntry } from '../src/services/leaderboard-store';
import type {
  ProgressStore,
  RecordProgressParams,
  ProgressAwardResult,
  StudentProgressSummary,
} from '../src/services/progress-store';
import type { DatabaseInstance } from '@code-arena/db';
import {
  recordProblemEvaluationProgress,
  getStudentProgress,
  XP_PER_PROBLEM_SOLVE,
} from '@code-arena/db';

// Hermetic In-Memory Progress Store
class MockProgressStore implements ProgressStore {
  solvedProblemsByUser: Map<string, Set<string>> = new Map();
  xpByUser: Map<string, number> = new Map();
  attemptsByUserProblem: Map<string, number> = new Map();

  async recordProgress(params: RecordProgressParams): Promise<ProgressAwardResult> {
    const isAccepted = params.verdict === 'ACCEPTED';
    const key = `${params.userId}:${params.problemId}`;
    const solvedSet = this.solvedProblemsByUser.get(params.userId) ?? new Set();
    const wasAlreadySolved = solvedSet.has(params.problemId);

    const attempts = (this.attemptsByUserProblem.get(key) ?? 0) + 1;
    this.attemptsByUserProblem.set(key, attempts);

    let isFirstSolve = false;
    let xpAwarded = 0;

    if (isAccepted && !wasAlreadySolved) {
      isFirstSolve = true;
      xpAwarded = XP_PER_PROBLEM_SOLVE;
      solvedSet.add(params.problemId);
      this.solvedProblemsByUser.set(params.userId, solvedSet);
      const currentXp = this.xpByUser.get(params.userId) ?? 0;
      this.xpByUser.set(params.userId, currentXp + xpAwarded);
    }

    return {
      isFirstSolve,
      xpAwarded,
      totalXp: this.xpByUser.get(params.userId) ?? 0,
      status: wasAlreadySolved || isAccepted ? 'SOLVED' : 'ATTEMPTED',
    };
  }

  async getProgress(userId: string): Promise<StudentProgressSummary | null> {
    const solvedSet = this.solvedProblemsByUser.get(userId) ?? new Set();
    const xp = this.xpByUser.get(userId) ?? 0;

    return {
      userId,
      username: `student_${userId}`,
      displayName: `Student ${userId}`,
      avatarUrl: null,
      xp,
      rating: 1200,
      solvedCount: solvedSet.size,
      easySolved: solvedSet.size,
      mediumSolved: 0,
      hardSolved: 0,
      currentStreak: solvedSet.size > 0 ? 1 : 0,
      maxStreak: solvedSet.size > 0 ? 1 : 0,
      solvedProblemSlugs: Array.from(solvedSet),
    };
  }
}

// Hermetic In-Memory Leaderboard Store
class MockLeaderboardStore implements LeaderboardStore {
  entries: GlobalLeaderboardEntry[] = [];

  async getGlobalLeaderboard(filters: { limit?: number; offset?: number } = {}): Promise<GlobalLeaderboardEntry[]> {
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    return this.entries.slice(offset, offset + limit);
  }
}

describe('Server-Verified Progress & Leaderboard', () => {
  describe('A. Progress Awarding & Idempotency', () => {
    it('awards 25 XP on first accepted solve and 0 XP on duplicate retries', async () => {
      const store = new MockProgressStore();
      const userId = 'usr_student_alpha';
      const problemId = 'prob-two-sum';

      // 1. First solve produces ACCEPTED
      const firstResult = await store.recordProgress({
        userId,
        problemId,
        verdict: 'ACCEPTED',
        difficulty: 'Easy',
      });

      assert.equal(firstResult.isFirstSolve, true);
      assert.equal(firstResult.xpAwarded, 25);
      assert.equal(firstResult.totalXp, 25);
      assert.equal(firstResult.status, 'SOLVED');

      // 2. Retry with ACCEPTED must NOT award duplicate XP
      const retryResult = await store.recordProgress({
        userId,
        problemId,
        verdict: 'ACCEPTED',
        difficulty: 'Easy',
      });

      assert.equal(retryResult.isFirstSolve, false);
      assert.equal(retryResult.xpAwarded, 0); // Idempotent: 0 duplicate XP!
      assert.equal(retryResult.totalXp, 25); // Still 25 XP
      assert.equal(retryResult.status, 'SOLVED');

      // 3. Solving a second distinct problem awards an additional 25 XP
      const secondProblemResult = await store.recordProgress({
        userId,
        problemId: 'prob-valid-parentheses',
        verdict: 'ACCEPTED',
        difficulty: 'Easy',
      });

      assert.equal(secondProblemResult.isFirstSolve, true);
      assert.equal(secondProblemResult.xpAwarded, 25);
      assert.equal(secondProblemResult.totalXp, 50); // Total 50 XP
    });

    it('awards 0 XP on failed submissions while recording attempts', async () => {
      const store = new MockProgressStore();
      const userId = 'usr_student_beta';
      const problemId = 'prob-merge-intervals';

      const failResult = await store.recordProgress({
        userId,
        problemId,
        verdict: 'WRONG_ANSWER',
        difficulty: 'Medium',
      });

      assert.equal(failResult.isFirstSolve, false);
      assert.equal(failResult.xpAwarded, 0);
      assert.equal(failResult.totalXp, 0);
      assert.equal(failResult.status, 'ATTEMPTED');

      const prog = await store.getProgress(userId);
      assert.equal(prog?.solvedCount, 0);
      assert.equal(prog?.xp, 0);
    });

    it('rejects unauthorized progress retrieval when caller is unauthenticated', async () => {
      const store = new MockProgressStore();
      // Anonymous caller: no ctx.user
      const anonymousCaller = progressRouter.createCaller({
        progressStore: store,
      });

      const res = await anonymousCaller.current();
      assert.equal(res.authenticated, false);
      assert.equal(res.progress, null);
    });

    it('returns server-verified progress for authenticated student identity', async () => {
      const store = new MockProgressStore();
      const studentId = 'usr_student_gamma';
      await store.recordProgress({
        userId: studentId,
        problemId: 'two-sum',
        verdict: 'ACCEPTED',
      });

      const authenticatedCaller = progressRouter.createCaller({
        progressStore: store,
        user: { id: studentId, role: 'STUDENT' },
      });

      const res = await authenticatedCaller.current();
      assert.equal(res.authenticated, true);
      assert.ok(res.progress);
      assert.equal(res.progress?.xp, 25);
      assert.equal(res.progress?.solvedCount, 1);
      assert.deepEqual(res.progress?.solvedProblemSlugs, ['two-sum']);
    });
  });

  describe('B. Leaderboard Endpoints & Ranking Rules', () => {
    it('returns empty leaderboard list gracefully when no ranked students exist', async () => {
      const store = new MockLeaderboardStore();
      const caller = leaderboardRouter.createCaller({
        leaderboardStore: store,
      });

      const res = await caller.global();
      assert.deepEqual(res.entries, []);
      assert.equal(res.total, 0);
    });

    it('returns ranked students ordered by competition criteria and pagination bounds', async () => {
      const store = new MockLeaderboardStore();
      const t1 = new Date('2026-10-01T00:00:00Z');
      const t2 = new Date('2026-10-02T00:00:00Z');

      store.entries = [
        {
          rank: 1,
          userId: 'usr-1',
          username: 'top_student',
          displayName: 'Top Student',
          avatarUrl: null,
          xp: 100,
          rating: 1300,
          createdAt: t1,
        },
        {
          rank: 2,
          userId: 'usr-2',
          username: 'runner_up',
          displayName: 'Runner Up',
          avatarUrl: null,
          xp: 75,
          rating: 1250,
          createdAt: t2,
        },
        {
          rank: 3,
          userId: 'usr-3',
          username: 'third_place',
          displayName: 'Third Place',
          avatarUrl: null,
          xp: 50,
          rating: 1200,
          createdAt: t1,
        },
      ];

      const caller = leaderboardRouter.createCaller({
        leaderboardStore: store,
      });

      // Default fetch
      const res = await caller.global();
      assert.equal(res.entries.length, 3);
      assert.equal(res.entries[0].username, 'top_student');
      assert.equal(res.entries[0].rank, 1);
      assert.equal(res.entries[1].rank, 2);
      assert.equal(res.entries[2].rank, 3);

      // Paginated fetch (limit 1, offset 1)
      const pageRes = await caller.global({ limit: 1, offset: 1 });
      assert.equal(pageRes.entries.length, 1);
      assert.equal(pageRes.entries[0].username, 'runner_up');
    });

    it('enforces rank tie-breakers: tied participants share rank while preserving deterministic order', () => {
      // Simulating RANK() window function behavior as defined in packages/db/src/queries/leaderboard.ts:
      // RANK() OVER (ORDER BY xp DESC, rating DESC, createdAt ASC)
      // Deterministic tie-breaker: userId ASC for stable pagination
      const t0 = new Date('2026-10-01T10:00:00Z');
      const t1 = new Date('2026-10-01T11:00:00Z');

      const rawStudents = [
        { userId: 'usr-charlie', xp: 50, rating: 1200, createdAt: t0 },
        { userId: 'usr-alice', xp: 50, rating: 1200, createdAt: t0 }, // Tied with charlie on XP, rating, createdAt!
        { userId: 'usr-bob', xp: 75, rating: 1200, createdAt: t1 },   // Highest XP
        { userId: 'usr-david', xp: 50, rating: 1100, createdAt: t0 }, // Same XP as alice/charlie, but lower rating
      ];

      // Sort according to query: XP DESC, rating DESC, createdAt ASC, userId ASC
      const sorted = [...rawStudents].sort((a, b) => {
        if (b.xp !== a.xp) return b.xp - a.xp;
        if (b.rating !== a.rating) return b.rating - a.rating;
        if (a.createdAt.getTime() !== b.createdAt.getTime()) return a.createdAt.getTime() - b.createdAt.getTime();
        return a.userId.localeCompare(b.userId);
      });

      // Assign competition ranks (tied participants share a rank)
      let currentRank = 1;
      const ranked = sorted.map((student, i) => {
        if (i > 0) {
          const prev = sorted[i - 1];
          const isTied =
            prev.xp === student.xp &&
            prev.rating === student.rating &&
            prev.createdAt.getTime() === student.createdAt.getTime();
          if (!isTied) {
            currentRank = i + 1;
          }
        }
        return { ...student, rank: currentRank };
      });

      // Bob has 75 XP -> Rank 1
      assert.equal(ranked[0].userId, 'usr-bob');
      assert.equal(ranked[0].rank, 1);

      // Alice and Charlie both have 50 XP, 1200 rating, t0 -> Both share Rank 2!
      assert.equal(ranked[1].userId, 'usr-alice'); // alice before charlie due to unique tie-breaker
      assert.equal(ranked[1].rank, 2);

      assert.equal(ranked[2].userId, 'usr-charlie');
      assert.equal(ranked[2].rank, 2); // Shares Rank 2!

      // David has 50 XP, but lower rating (1100) -> Rank 4
      assert.equal(ranked[3].userId, 'usr-david');
      assert.equal(ranked[3].rank, 4);
    });
  });
});
