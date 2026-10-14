import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb, type DatabaseInstance } from '../client';
import {
  contests,
  contestProblems,
  contestParticipants,
  contestSubmissions,
  contestSolves,
} from '../schema/contests';
import { users } from '../schema/users';
import { submissions } from '../schema/submissions';

export interface RecordContestSubmissionParams {
  id: string;
  contestId: string;
  userId: string;
  problemId: string;
  submissionId: string;
  verdict: string;
  submittedAt?: Date;
}

export interface ContestScoringResult {
  isAccepted: boolean;
  isLate: boolean;
  pointsAwarded: number;
  penaltyMinutes: number;
  isFirstSolveForUser: boolean;
}

/**
 * Records a contest submission and updates the participant's score and penalty:
 *
 * 1. Acceptance requirement: Points are awarded strictly for fully accepted solutions (`verdict === 'ACCEPTED'`).
 * 2. Concurrency safety: Enforced via `contest_solves` table with a DB unique constraint on (contest_id, user_id, problem_id).
 *    Atomic `onConflictDoNothing().returning(...)` inside a transaction prevents duplicate score increments.
 * 3. Status & time-window policy:
 *    - `ACTIVE`: Only submissions within the active window (`startTime <= submittedAt <= endTime`) award points and penalties.
 *    - `UPCOMING`: Contest has not started; awards 0 points and 0 penalty (`isLate = false`).
 *    - `PAUSED`: Submissions are frozen; awards 0 points and 0 penalty (`isLate = false`).
 *    - `ENDED`: Submissions after `endTime` or when status is `ENDED` are marked `isLate = true` and award 0 points.
 * 4. Rejected attempts: Only rejected attempts occurring strictly before this accepted submission and within the contest window
 *    (`startTime <= submittedAt < current_submission && submittedAt <= endTime`) incur a 20-minute penalty.
 *    System errors (`SERVICE_UNAVAILABLE`) and `PENDING` states are excluded.
 * 5. Automatic registration: Automatically registers participant if not already present.
 */
export async function recordContestSubmission(
  params: RecordContestSubmissionParams,
  dbInstance?: DatabaseInstance
): Promise<ContestScoringResult> {
  const db = dbInstance || getDb();
  const submissionTime = params.submittedAt || new Date();

  return await db.transaction(async (tx) => {
    // 1. Fetch contest window and problem points configuration
    const contestRows = await tx
      .select()
      .from(contests)
      .where(eq(contests.id, params.contestId))
      .limit(1);

    if (!contestRows[0]) {
      throw new Error(`Contest with ID "${params.contestId}" not found.`);
    }

    const contest = contestRows[0];
    const nowMs = submissionTime.getTime();
    const startMs = contest.startTime.getTime();
    const endMs = contest.endTime.getTime();

    const isBeforeStart = nowMs < startMs;
    const isAfterEnd = nowMs > endMs;
    const isLate = isAfterEnd || contest.status === 'ENDED';

    // Strictly enforce active window policy: only ACTIVE contests award points
    const isInActiveWindow =
      !isBeforeStart && !isAfterEnd && contest.status === 'ACTIVE';

    const problemConfigs = await tx
      .select()
      .from(contestProblems)
      .where(
        and(
          eq(contestProblems.contestId, params.contestId),
          eq(contestProblems.problemId, params.problemId)
        )
      )
      .limit(1);

    if (!problemConfigs[0]) {
      throw new Error(
        `Problem with ID "${params.problemId}" is not configured for contest "${params.contestId}".`
      );
    }

    const problemPoints = problemConfigs[0].points;

    // 2. Determine acceptance: award contest points only for fully accepted submissions
    const isAccepted = params.verdict === 'ACCEPTED';

    let isFirstSolveForUser = false;
    let pointsAwarded = 0;
    let penaltyMinutes = 0;

    // 3. Atomically attempt to register the first solve in the DB-level uniqueness table
    if (isAccepted && isInActiveWindow) {
      // Calculate elapsed minutes from contest start
      const elapsedMs = Math.max(0, nowMs - startMs);
      const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));

      // Query prior rejected attempts for this problem:
      // Must occur within the contest window AND strictly before this accepted submission.
      // Excludes system errors (SERVICE_UNAVAILABLE) and PENDING evaluations.
      const priorFails = await tx
        .select({
          id: contestSubmissions.id,
        })
        .from(contestSubmissions)
        .innerJoin(submissions, eq(contestSubmissions.submissionId, submissions.id))
        .where(
          and(
            eq(contestSubmissions.contestId, params.contestId),
            eq(contestSubmissions.userId, params.userId),
            eq(contestSubmissions.problemId, params.problemId),
            eq(contestSubmissions.isAccepted, false),
            eq(contestSubmissions.isLate, false),
            sql`${contestSubmissions.submittedAt} >= ${contest.startTime}`,
            sql`${contestSubmissions.submittedAt} <= ${contest.endTime}`,
            sql`${contestSubmissions.submittedAt} < ${submissionTime}`,
            sql`${submissions.verdict} NOT IN ('SERVICE_UNAVAILABLE', 'PENDING')`
          )
        );

      const calculatedPenalty = elapsedMinutes + priorFails.length * 20;

      // ATOMIC DB-LEVEL UNIQUENESS:
      // Insert into contestSolves with ON CONFLICT DO NOTHING.
      // Under high concurrency, only one transaction can successfully insert the row.
      const solveInsertResult = await tx
        .insert(contestSolves)
        .values({
          id: randomUUID(),
          contestId: params.contestId,
          userId: params.userId,
          problemId: params.problemId,
          submissionId: params.submissionId,
          points: problemPoints,
          penaltyMinutes: calculatedPenalty,
          solvedAt: submissionTime,
        })
        .onConflictDoNothing()
        .returning({ id: contestSolves.id });

      if (solveInsertResult.length > 0) {
        isFirstSolveForUser = true;
        pointsAwarded = problemPoints;
        penaltyMinutes = calculatedPenalty;
      }
    }

    // 4. Insert contest submission record (audit log of all attempts)
    await tx.insert(contestSubmissions).values({
      id: params.id,
      contestId: params.contestId,
      userId: params.userId,
      problemId: params.problemId,
      submissionId: params.submissionId,
      isAccepted,
      pointsAwarded,
      penaltyMinutes,
      isLate,
      submittedAt: submissionTime,
    });

    // 5. Update or register participant aggregate score atomically
    await tx
      .insert(contestParticipants)
      .values({
        id: randomUUID(),
        contestId: params.contestId,
        userId: params.userId,
        registeredAt: submissionTime,
        score: pointsAwarded,
        penaltyMinutes: penaltyMinutes,
        problemsSolved: isFirstSolveForUser ? 1 : 0,
        lastSubmissionTime: isFirstSolveForUser ? submissionTime : null,
      })
      .onConflictDoUpdate({
        target: [contestParticipants.contestId, contestParticipants.userId],
        set: {
          score: sql`${contestParticipants.score} + ${pointsAwarded}`,
          penaltyMinutes: sql`${contestParticipants.penaltyMinutes} + ${penaltyMinutes}`,
          problemsSolved: isFirstSolveForUser
            ? sql`${contestParticipants.problemsSolved} + 1`
            : contestParticipants.problemsSolved,
          lastSubmissionTime: isFirstSolveForUser
            ? submissionTime
            : contestParticipants.lastSubmissionTime,
        },
      });

    return {
      isAccepted,
      isLate,
      pointsAwarded,
      penaltyMinutes,
      isFirstSolveForUser,
    };
  });
}

export interface ContestLeaderboardFilters {
  limit?: number;
  offset?: number;
}

export interface ContestLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  score: number;
  penaltyMinutes: number;
  problemsSolved: number;
  lastSubmissionTime: Date | null;
  registeredAt: Date;
}

/**
 * Computes and returns the paginated leaderboard for a contest.
 *
 * Competition Rank Criteria (tied participants share a rank):
 * 1. Score DESC
 * 2. Penalty Minutes ASC
 * 3. Last Submission Time ASC NULLS LAST
 *
 * Deterministic Pagination Order (adds secondary stable ordering):
 * - Score DESC, Penalty ASC, Last Submission Time ASC NULLS LAST, Registered At ASC, User ID ASC
 */
export async function getContestLeaderboard(
  contestId: string,
  filters: ContestLeaderboardFilters = {},
  dbInstance?: DatabaseInstance
): Promise<ContestLeaderboardEntry[]> {
  const db = dbInstance || getDb();
  const limit = Math.min(Math.max(1, filters.limit || 50), 100);
  const offset = Math.max(0, filters.offset || 0);

  const rows = await db
    .select({
      userId: contestParticipants.userId,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      score: contestParticipants.score,
      penaltyMinutes: contestParticipants.penaltyMinutes,
      problemsSolved: contestParticipants.problemsSolved,
      lastSubmissionTime: contestParticipants.lastSubmissionTime,
      registeredAt: contestParticipants.registeredAt,
      // RANK uses ONLY the intended competitive criteria so genuinely tied participants share a rank
      rank: sql<number>`RANK() OVER (ORDER BY ${contestParticipants.score} DESC, ${contestParticipants.penaltyMinutes} ASC, ${contestParticipants.lastSubmissionTime} ASC NULLS LAST)`,
    })
    .from(contestParticipants)
    .innerJoin(users, eq(contestParticipants.userId, users.id))
    .where(eq(contestParticipants.contestId, contestId))
    .orderBy(
      desc(contestParticipants.score),
      asc(contestParticipants.penaltyMinutes),
      sql`${contestParticipants.lastSubmissionTime} ASC NULLS LAST`,
      asc(contestParticipants.registeredAt),
      asc(contestParticipants.userId) // Unique tie-breaker strictly for deterministic pagination
    )
    .limit(limit)
    .offset(offset);

  return rows.map((row) => ({
    ...row,
    rank: Number(row.rank),
  }));
}
