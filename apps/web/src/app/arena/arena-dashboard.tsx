'use client';

import Link from 'next/link';
import { calculateStreak, getAchievements, longestStreak, dateKey, XP_PER_SOLVE, XP_PER_LEVEL } from '../../lib/game-rules';
import { getMockProblems } from '@code-arena/shared';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  EMPTY_PRACTICE_PROGRESS,
  getDaySnapshot,
  readPracticeProgress,
  SERVER_DAY_SNAPSHOT,
  subscribeToDaySnapshot,
  subscribeToPracticeProgress,
} from '../../lib/arena-progress';

type FeedEvent = {
  id: string;
  type: 'practice_sample_passed';
  problemSlug: string;
  problemTitle: string;
  createdAt: string;
  relativeTime: string;
};

type BoardPeriod = 'Today' | 'This week' | 'All time';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const XP_PER_PRACTICE_SOLVE = XP_PER_SOLVE;

const sampleEvents: FeedEvent[] = [
  { id: 'preview-1', type: 'practice_sample_passed', problemSlug: 'two-sum', problemTitle: 'Two Sum', createdAt: '2026-10-15T11:42:00.000Z', relativeTime: '8m ago' },
  { id: 'preview-2', type: 'practice_sample_passed', problemSlug: 'valid-parentheses', problemTitle: 'Valid Parentheses', createdAt: '2026-10-15T11:35:00.000Z', relativeTime: '15m ago' },
  { id: 'preview-3', type: 'practice_sample_passed', problemSlug: 'merge-sorted-array', problemTitle: 'Merge Sorted Array', createdAt: '2026-10-15T11:27:00.000Z', relativeTime: '23m ago' },
];

const previewBoards: Record<BoardPeriod, { handle: string; points: number; change: string }[]> = {
  Today: [
    { handle: 'bitwise.bee', points: 460, change: '+2' },
    { handle: 'stacktrace', points: 410, change: '+1' },
    { handle: 'nullnvoid', points: 340, change: '−1' },
  ],
  'This week': [
    { handle: 'stacktrace', points: 1840, change: '+3' },
    { handle: 'bitwise.bee', points: 1725, change: '—' },
    { handle: 'nullnvoid', points: 1390, change: '−2' },
  ],
  'All time': [
    { handle: 'nullnvoid', points: 12840, change: '+1' },
    { handle: 'stacktrace', points: 11420, change: '—' },
    { handle: 'bitwise.bee', points: 10860, change: '−1' },
  ],
};

function formatTime(isoDate: string) {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 60_000));
  if (elapsedMinutes < 1) return 'just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  return `${Math.floor(elapsedHours / 24)}d ago`;
}

function ActivityIcon() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-700/20 bg-emerald-800/10 text-emerald-800" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" />
      </svg>
    </span>
  );
}

export function ArenaDashboard() {
  const progress = useSyncExternalStore(
    subscribeToPracticeProgress,
    readPracticeProgress,
    () => EMPTY_PRACTICE_PROGRESS
  );
  const today = useSyncExternalStore(subscribeToDaySnapshot, getDaySnapshot, () => SERVER_DAY_SNAPSHOT);
  const [events, setEvents] = useState<FeedEvent[]>(sampleEvents);
  const [isStreamConnected, setIsStreamConnected] = useState(false);
  const [boardPeriod, setBoardPeriod] = useState<BoardPeriod>('Today');
  const [activityFilter, setActivityFilter] = useState<'All' | 'Practice'>('All');

  useEffect(() => {
    const stream = new EventSource(`${API_BASE_URL}/events`);

    stream.onopen = () => setIsStreamConnected(true);
    stream.addEventListener('snapshot', (rawEvent) => {
      const snapshotEvent = rawEvent as MessageEvent<string>;
      try {
        const snapshot = JSON.parse(snapshotEvent.data) as FeedEvent[];
        setEvents(snapshot.map((event) => ({ ...event, relativeTime: formatTime(event.createdAt) })));
        setIsStreamConnected(true);
      } catch {
        setEvents([]);
      }
    });
    stream.addEventListener('activity', (rawEvent) => {
      const activityEvent = rawEvent as MessageEvent<string>;
      try {
        const activity = JSON.parse(activityEvent.data) as FeedEvent;
        const liveActivity = { ...activity, relativeTime: 'just now' };
        setEvents((current) => [liveActivity, ...current.filter((event) => event.id !== activity.id)].slice(0, 20));
        setIsStreamConnected(true);
      } catch {
        // Ignore malformed events and keep the last valid activity visible.
      }
    });
    stream.onerror = () => setIsStreamConnected(false);

    return () => stream.close();
  }, []);

  const streak = useMemo(() => calculateStreak(progress.practiceDays, today), [progress.practiceDays, today]);
  const level = Math.floor(progress.xp / XP_PER_LEVEL) + 1;
  const levelProgress = progress.xp % XP_PER_LEVEL;
  const achievements = getAchievements(progress);
  const nextAchievement = achievements.find((item) => item.current < item.target);
  const earnedCount = achievements.filter((item) => item.current >= item.target).length;
  const practicedToday = progress.practiceDays.includes(today);
  const recentDays = today === SERVER_DAY_SNAPSHOT ? [] : Array.from({ length: 28 }, (_, index) => {
    const day = new Date(`${today}T12:00:00`);
    day.setDate(day.getDate() - (27 - index));
    return dateKey(day);
  });
  const challenges = getMockProblems();
  const warmup = challenges.find((problem) => !progress.solvedProblemSlugs.includes(problem.slug)) ?? challenges[0];
  const filteredEvents = activityFilter === 'All' ? events : events.filter((event) => event.type === 'practice_sample_passed');
  const currentBoard = previewBoards[boardPeriod];

  return (
    <main className="arena-shell flex-1 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#252D25]/15 bg-[#E8E2D6] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#344E41]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#344E41]" />
              Player hub
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#252D25] sm:text-4xl">Your arena</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#526052] sm:text-base">
              Your practice progress, campus energy, and the next milestone worth chasing.
            </p>
          </div>
          <div className={`inline-flex w-fit items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${isStreamConnected ? 'border-emerald-700/25 bg-emerald-800/10 text-emerald-800' : 'border-amber-700/25 bg-amber-800/10 text-amber-900'}`} role="status" aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${isStreamConnected ? 'bg-emerald-700' : 'bg-amber-700'}`} />
            {isStreamConnected ? 'Live practice feed' : 'Preview feed · API offline'}
          </div>
        </header>

        <section className="arena-hero relative mb-6 overflow-hidden rounded-2xl border border-[#252D25]/10 bg-[#E8E2D6] p-6 sm:p-8 lg:p-10 shadow-xs" aria-labelledby="rank-heading">
          <div className="arena-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#252D25]/10 bg-[#DDE5D5] text-sm font-bold text-[#344E41]">CA</div>
                <div>
                  <p className="text-sm font-semibold text-[#252D25]">Practice profile</p>
                  <p className="text-xs text-[#526052]">Saved privately on this device</p>
                </div>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#526052]">Competitive rank</p>
              <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
                <h2 id="rank-heading" className="text-4xl font-bold tracking-tight text-[#252D25] sm:text-5xl">Unranked</h2>
                <span className="mb-1 rounded-lg border border-[#252D25]/10 bg-[#F5F1E8] px-2.5 py-1 text-[11px] font-medium text-[#526052]">Earned in rated contests</span>
              </div>
              <p className="mt-3 max-w-lg text-sm leading-6 text-[#526052]">
                Practice XP builds your momentum. Your competitive rating starts when rated duels arrive.
              </p>
              <Link href="/problems" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#344E41] hover:bg-[#25382E] px-4 py-2.5 text-sm font-semibold text-[#F5F1E8] shadow-xs transition-all active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#344E41]">
                Solve a challenge <span aria-hidden="true">→</span>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="rounded-xl border border-[#252D25]/10 bg-[#F5F1E8] p-4 sm:p-5 shadow-xs">
                <p className="text-xs text-[#526052]">Practice XP</p>
                <p className="mt-2 text-3xl font-bold font-mono text-[#252D25]">{progress.xp.toLocaleString()}</p>
                <p className="mt-1 text-[11px] font-medium text-[#344E41]">Level {level} · {levelProgress}/{XP_PER_LEVEL} to next</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#E8E2D6]" role="progressbar" aria-label="Progress to next practice level" aria-valuemin={0} aria-valuemax={XP_PER_LEVEL} aria-valuenow={levelProgress}>
                  <div className="h-full rounded-full bg-[#344E41] transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${levelProgress}%` }} />
                </div>
              </div>
              <div className="rounded-xl border border-[#252D25]/10 bg-[#F5F1E8] p-4 sm:p-5 shadow-xs">
                <p className="text-xs text-[#526052]">Practice streak</p>
                <p className="mt-2 text-3xl font-bold font-mono text-[#252D25]">{streak}<span className="ml-1 text-sm font-medium text-[#526052]">days</span></p>
                <p className="mt-1 text-[11px] text-[#526052]">Consecutive days with a sample pass</p>
              </div>
              <div className="col-span-2 rounded-xl border border-[#344E41]/20 bg-[#DDE5D5]/60 p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[#344E41]">{nextAchievement ? 'Next achievement' : 'Achievement set complete'}</p>
                    <p className="mt-1 text-sm font-semibold text-[#252D25]">{nextAchievement?.name ?? 'All milestones unlocked'}</p>
                  </div>
                  <span className="rounded-lg border border-[#344E41]/20 bg-[#F5F1E8] px-2.5 py-1 text-[11px] font-semibold text-[#344E41]">{nextAchievement ? `${nextAchievement.current}/${nextAchievement.target}` : 'Unlocked'}</span>
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#E8E2D6]" aria-hidden="true">
                  <div className="h-full rounded-full bg-[#344E41] transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${nextAchievement ? (nextAchievement.current / nextAchievement.target) * 100 : 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-6 md:grid-cols-2" aria-label="Practice goals and history">
          <div className="rounded-xl border border-[#344E41]/20 bg-[#DDE5D5]/60 p-6 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#344E41]">Daily quest</p>
            <h2 className="mt-2 text-xl font-semibold text-[#252D25]">{practicedToday ? 'Quest complete!' : 'Keep your momentum'}</h2>
            <p className="mt-2 text-sm text-[#526052] leading-relaxed">Pass the samples for any problem today. Revisiting a solved problem keeps your streak alive; XP is awarded once per unique problem.</p>
            <Link href="/problems" className="mt-4 inline-block rounded-lg bg-[#344E41] hover:bg-[#25382E] px-4 py-2 text-sm font-semibold text-[#F5F1E8] shadow-xs transition-all active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#344E41]">{practicedToday ? 'Practice another' : 'Start today’s quest'} →</Link>
          </div>
          <div className="rounded-xl border border-[#252D25]/10 bg-[#E8E2D6] p-6 shadow-xs">
            <div className="flex justify-between gap-3"><h2 className="font-semibold text-[#252D25]">28-day practice trail</h2><span className="text-xs text-[#526052] font-mono">Best: {longestStreak(progress.practiceDays)} days</span></div>
            <div className="mt-4 grid grid-cols-7 gap-2" aria-label="Recent practice days">
              {recentDays.map((day) => <div key={day} title={`${day}: ${progress.practiceDays.includes(day) ? 'Practiced' : 'No practice'}`} aria-label={`${day}: ${progress.practiceDays.includes(day) ? 'Practiced' : 'No practice'}`} className={`flex h-8 items-center justify-center rounded font-mono text-[10px] ${progress.practiceDays.includes(day) ? 'bg-emerald-800/15 text-emerald-900 border border-emerald-700/30 font-semibold' : 'bg-[#F5F1E8] text-[#526052] border border-[#252D25]/10'} ${day === today ? 'ring-2 ring-[#344E41]' : ''}`}>{day.slice(-2)}</div>)}
            </div>
            <p className="mt-3 text-xs text-[#526052]">Green = practiced · outlined = today · local calendar days</p>
          </div>
        </section>

        <section className="mb-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="arena-panel rounded-xl border border-[#252D25]/10 bg-[#E8E2D6] p-5 sm:p-6 shadow-xs">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-[#252D25]">Campus feed</h2>
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${isStreamConnected ? 'bg-emerald-800/10 text-emerald-800 border border-emerald-700/25' : 'bg-amber-800/10 text-amber-900 border border-amber-700/25'}`}>{isStreamConnected ? 'SSE live' : 'Preview'}</span>
                </div>
                <p className="mt-1 text-xs text-[#526052]">Practice sample verdicts · source code is never broadcast</p>
              </div>
              <div className="flex rounded-lg border border-[#252D25]/15 bg-[#F5F1E8] p-1" aria-label="Filter activity">
                {(['All', 'Practice'] as const).map((filter) => (
                  <button key={filter} type="button" onClick={() => setActivityFilter(filter)} aria-pressed={activityFilter === filter} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#344E41] ${activityFilter === filter ? 'bg-[#344E41] text-[#F5F1E8]' : 'text-[#526052] hover:text-[#252D25]'}`}>
                    {filter}
                  </button>
                ))}
              </div>
            </div>
            {!isStreamConnected && <p className="mb-3 text-[11px] text-amber-900 font-medium">Example activity is shown until the API event stream connects.</p>}
            {filteredEvents.length ? (
              <ol className="divide-y divide-[#252D25]/10" aria-live="polite" aria-relevant="additions text">
                {filteredEvents.slice(0, 5).map((event) => (
                  <li key={event.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <ActivityIcon />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#252D25]">A student passed sample tests</p>
                      <Link href={`/problems/${event.problemSlug}`} className="mt-0.5 block truncate text-xs text-[#526052] transition-colors hover:text-[#344E41]">{event.problemTitle}</Link>
                    </div>
                    <time className="shrink-0 font-mono text-[11px] text-[#526052]" dateTime={event.createdAt}>{event.relativeTime}</time>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="rounded-xl border border-dashed border-[#252D25]/15 bg-[#F5F1E8] px-4 py-8 text-center">
                <p className="text-sm font-semibold text-[#252D25]">The arena is warming up.</p>
                <p className="mt-1 text-xs text-[#526052]">A practice sample pass will light up the feed.</p>
              </div>
            )}
          </div>

          <div className="arena-panel rounded-xl border border-[#252D25]/10 bg-[#E8E2D6] p-5 sm:p-6 shadow-xs">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#252D25]">Campus board</h2>
                <p className="mt-1 text-xs text-[#526052]">Preview standings · practice XP only</p>
              </div>
              <label className="sr-only" htmlFor="board-period">Leaderboard period</label>
              <select id="board-period" value={boardPeriod} onChange={(event) => setBoardPeriod(event.target.value as BoardPeriod)} className="rounded-lg border border-[#252D25]/15 bg-[#FDFBF7] px-2.5 py-1.5 text-xs text-[#252D25] outline-none focus-visible:ring-2 focus-visible:ring-[#344E41]">
                {(['Today', 'This week', 'All time'] as const).map((period) => <option key={period}>{period}</option>)}
              </select>
            </div>
            <ol className="space-y-2" aria-label={`${boardPeriod} preview standings`}>
              {currentBoard.map((player, index) => (
                <li key={player.handle} className="flex items-center gap-3 rounded-xl border border-[#252D25]/5 bg-[#F5F1E8] px-3 py-2.5">
                  <span className={`w-6 text-center font-mono text-xs ${index === 0 ? 'text-amber-800 font-bold' : 'text-[#526052]'}`}>{String(index + 1).padStart(2, '0')}</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#DDE5D5] text-[10px] font-bold uppercase text-[#344E41]">{player.handle.slice(0, 2)}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#252D25]">{player.handle}</span>
                  <span className="text-right"><span className="block text-xs font-semibold font-mono text-[#252D25]">{player.points.toLocaleString()} XP</span><span className={`text-[10px] font-mono ${player.change.startsWith('+') ? 'text-emerald-800' : player.change.startsWith('−') ? 'text-rose-900' : 'text-[#526052]'}`}>{player.change}</span></span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[10px] leading-4 text-[#526052]">Sample handles and standings illustrate the layout. Real campus ranks need contest accounts and persisted results.</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="arena-panel rounded-xl border border-[#252D25]/10 bg-[#E8E2D6] p-5 sm:p-6 shadow-xs">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[#252D25]">Achievement set</h2>
                <p className="mt-1 text-xs text-[#526052]">Earned by this browser profile</p>
              </div>
              <span className="text-xs font-semibold font-mono text-[#344E41]">{earnedCount} / {achievements.length}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {achievements.map((item) => {
                const earned = item.current >= item.target;
                return <div key={item.id} className={`rounded-xl border p-3 text-center ${earned ? 'border-emerald-700/25 bg-emerald-800/10' : 'border-[#252D25]/10 bg-[#F5F1E8]'}`}>
                  <span className={`text-lg font-bold font-mono ${earned ? 'text-emerald-800' : 'text-[#526052]'}`} aria-label={earned ? 'Unlocked' : 'Locked'}>{earned ? '✓' : `${item.current}/${item.target}`}</span>
                  <p className="mt-2 text-xs font-semibold text-[#252D25]">{item.name}</p>
                  <p className="mt-1 text-[10px] text-[#526052]">{item.description}</p>
                </div>;
              })}
            </div>
          </div>

          <div className="arena-panel rounded-xl border border-[#252D25]/10 bg-[#E8E2D6] p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#344E41]">Today’s warm-up</p>
                <h2 className="mt-2 text-xl font-semibold text-[#252D25]">{warmup?.title ?? "Practice library"}</h2>
                <p className="mt-1 max-w-md text-xs leading-5 text-[#526052]">Your next unsolved challenge is ready. Pass its samples to earn practice XP. Practice results don’t affect competitive rating.</p>
              </div>
              <Link href={warmup ? `/problems/${warmup.slug}` : "/problems"} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#344E41] hover:bg-[#25382E] px-4 py-2.5 text-sm font-semibold text-[#F5F1E8] shadow-xs transition-all active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#344E41]">
                Open challenge <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-[#252D25]/10 pt-4 text-[10px] text-[#526052]">
              <span className="rounded-md bg-[#F5F1E8] border border-[#252D25]/10 px-2 py-1">+{XP_PER_PRACTICE_SOLVE} practice XP on first sample pass</span>
              <span className="rounded-md bg-[#F5F1E8] border border-[#252D25]/10 px-2 py-1">Progress stays on this device</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
