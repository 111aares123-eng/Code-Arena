import { randomUUID } from 'node:crypto';
import { eq, and, sql } from 'drizzle-orm';
import { getDb, type DatabaseInstance } from '../client';
import {
  studentProblemProgress,
  studentStats,
  type StudentProblemProgressSelect,
  type StudentStatsSelect,
} from '../schema/student-progress';
import { users } from '../schema/users';
import { problems } from '../schema/problems';
import type { SubmissionVerdict } from '@code-arena/shared';

export const XP_PER_PROBLEM_SOLVE = 25;

export interface RecordProgressParams {
  userId: string;
  problemId: string;
  verdict: SubmissionVerdict;
  submissionId?: string | null;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
}

export interface ProgressAwardResult {
  isFirstSolve: boolean;
  xpAwarded: number;
  totalXp: number;
  status: 'ATTEMPTED' | 'SOLVED';
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
 * Server-side progress awarding.
 *
 * Requirements:
 * 1. Progress and XP are awarded ONLY from server-verified evaluation verdicts.
 * 2. Awarding is idempotent: duplicate accepted submissions on the same problem
 *    never award duplicate XP.
 * 3. Client-asserted scores or solved statuses are never trusted.
 */
export async function recordProblemEvaluationProgress(
  params: RecordProgressParams,
  dbInstance?: DatabaseInstance
): Promise<ProgressAwardResult> {
  const db = dbInstance || getDb();
  const isAccepted = params.verdict === 'ACCEPTED';
  const now = new Date();

  // 1. Fetch current progress record for (userId, problemId)
  const existingRows = await db
    .select()
    .from(studentProblemProgress)
    .where(
      and(
        eq(studentProblemProgress.userId, params.userId),
        eq(studentProblemProgress.problemId, params.problemId)
      )
    )
    .limit(1);

  const existing = existingRows[0];
  const wasAlreadySolved = existing?.status === 'SOLVED';

  let isFirstSolve = false;
  let xpAwarded = 0;
  const newStatus: 'ATTEMPTED' | 'SOLVED' = wasAlreadySolved ? 'SOLVED' : isAccepted ? 'SOLVED' : 'ATTEMPTED';

  if (isAccepted && !wasAlreadySolved) {
    isFirstSolve = true;
    xpAwarded = XP_PER_PROBLEM_SOLVE;
  }

  // 2. Upsert studentProblemProgress
  if (!existing) {
    await db.insert(studentProblemProgress).values({
      id: randomUUID(),
      userId: params.userId,
      problemId: params.problemId,
      status: newStatus,
      attemptsCount: 1,
      firstSolvedAt: isFirstSolve ? now : null,
      lastAttemptedAt: now,
      bestSubmissionId: isAccepted ? (params.submissionId ?? null) : null,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await db
      .update(studentProblemProgress)
      .set({
        status: newStatus,
        attemptsCount: sql`${studentProblemProgress.attemptsCount} + 1`,
        firstSolvedAt: isFirstSolve ? now : existing.firstSolvedAt,
        lastAttemptedAt: now,
        bestSubmissionId: isAccepted
          ? (params.submissionId ?? existing.bestSubmissionId)
          : existing.bestSubmissionId,
        updatedAt: now,
      })
      .where(eq(studentProblemProgress.id, existing.id));
  }

  // 3. If first solve, atomically increment users.xp
  if (isFirstSolve) {
    await db
      .update(users)
      .set({
        xp: sql`${users.xp} + ${xpAwarded}`,
        updatedAt: now,
      })
      .where(eq(users.id, params.userId));
  }

  // 4. Update or initialize studentStats
  const statsRows = await db
    .select()
    .from(studentStats)
    .where(eq(studentStats.userId, params.userId))
    .limit(1);

  const existingStats = statsRows[0];

  let currentStreak = 1;
  let maxStreak = 1;

  if (existingStats?.lastActiveDate) {
    const lastDate = new Date(existingStats.lastActiveDate);
    const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    const isSameDay = lastDate.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
    const isConsecutiveDay = diffDays === 1;

    if (isSameDay) {
      currentStreak = existingStats.currentStreak;
      maxStreak = existingStats.maxStreak;
    } else if (isConsecutiveDay) {
      currentStreak = existingStats.currentStreak + 1;
      maxStreak = Math.max(existingStats.maxStreak, currentStreak);
    } else {
      currentStreak = 1;
      maxStreak = Math.max(existingStats.maxStreak, 1);
    }
  }

  const difficulty = params.difficulty || 'Easy';
  const easyInc = isFirstSolve && difficulty === 'Easy' ? 1 : 0;
  const mediumInc = isFirstSolve && difficulty === 'Medium' ? 1 : 0;
  const hardInc = isFirstSolve && difficulty === 'Hard' ? 1 : 0;
  const solvedInc = isFirstSolve ? 1 : 0;

  if (!existingStats) {
    await db.insert(studentStats).values({
      userId: params.userId,
      solvedCount: solvedInc,
      easySolved: easyInc,
      mediumSolved: mediumInc,
      hardSolved: hardInc,
      totalAttempts: 1,
      currentStreak,
      maxStreak,
      lastActiveDate: now,
      updatedAt: now,
    });
  } else {
    await db
      .update(studentStats)
      .set({
        solvedCount: sql`${studentStats.solvedCount} + ${solvedInc}`,
        easySolved: sql`${studentStats.easySolved} + ${easyInc}`,
        mediumSolved: sql`${studentStats.mediumSolved} + ${mediumInc}`,
        hardSolved: sql`${studentStats.hardSolved} + ${hardInc}`,
        totalAttempts: sql`${studentStats.totalAttempts} + 1`,
        currentStreak,
        maxStreak,
        lastActiveDate: now,
        updatedAt: now,
      })
      .where(eq(studentStats.userId, params.userId));
  }

  // 5. Query updated user total XP
  const userRows = await db
    .select({ xp: users.xp })
    .from(users)
    .where(eq(users.id, params.userId))
    .limit(1);

  return {
    isFirstSolve,
    xpAwarded,
    totalXp: userRows[0]?.xp ?? 0,
    status: newStatus,
  };
}

/**
 * Returns server-authoritative progress for a student.
 */
export async function getStudentProgress(
  userId: string,
  dbInstance?: DatabaseInstance
): Promise<StudentProgressSummary | null> {
  const db = dbInstance || getDb();

  const userRows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      xp: users.xp,
      rating: users.rating,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRows[0]) return null;
  const user = userRows[0];

  const statsRows = await db
    .select()
    .from(studentStats)
    .where(eq(studentStats.userId, userId))
    .limit(1);

  const stats = statsRows[0];

  const solvedRows = await db
    .select({
      slug: problems.slug,
    })
    .from(studentProblemProgress)
    .innerJoin(problems, eq(studentProblemProgress.problemId, problems.id))
    .where(
      and(
        eq(studentProblemProgress.userId, userId),
        eq(studentProblemProgress.status, 'SOLVED')
      )
    );

  return {
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    xp: user.xp,
    rating: user.rating,
    solvedCount: stats?.solvedCount ?? solvedRows.length,
    easySolved: stats?.easySolved ?? 0,
    mediumSolved: stats?.mediumSolved ?? 0,
    hardSolved: stats?.hardSolved ?? 0,
    currentStreak: stats?.currentStreak ?? 0,
    maxStreak: stats?.maxStreak ?? 0,
    solvedProblemSlugs: solvedRows.map((r) => r.slug),
  };
}
