'use client';

import Link from 'next/link';
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
const XP_PER_PRACTICE_SOLVE = 25;
const XP_PER_LEVEL = 100;

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

function calculateStreak(practiceDays: string[], today: string) {
  if (today === SERVER_DAY_SNAPSHOT) return 0;
  const days = new Set(practiceDays);
  let streak = 0;
  let day = today;
  if (!days.has(day)) {
    const yesterday = new Date(`${day}T12:00:00`);
    yesterday.setDate(yesterday.getDate() - 1);
    day = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  }

  while (days.has(day)) {
    streak += 1;
    const previous = new Date(`${day}T12:00:00`);
    previous.setDate(previous.getDate() - 1);
    day = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}-${String(previous.getDate()).padStart(2, '0')}`;
  }

  return streak;
}

function ActivityIcon() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300" aria-hidden="true">
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
  const firstStepsEarned = progress.solvedProblemSlugs.length > 0;
  const filteredEvents = activityFilter === 'All' ? events : events.filter((event) => event.type === 'practice_sample_passed');
  const currentBoard = previewBoards[boardPeriod];

  return (
    <main className="arena-shell flex-1 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-200">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />
              Player hub
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Your arena</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
              Your practice progress, campus energy, and the next milestone worth chasing.
            </p>
          </div>
          <div className={`inline-flex w-fit items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${isStreamConnected ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : 'border-amber-300/20 bg-amber-300/10 text-amber-100'}`} role="status" aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${isStreamConnected ? 'bg-emerald-300' : 'bg-amber-300'}`} />
            {isStreamConnected ? 'Live practice feed' : 'Preview feed · API offline'}
          </div>
        </header>

        <section className="arena-hero relative mb-6 overflow-hidden rounded-3xl border border-indigo-300/15 bg-[#111827] p-6 sm:p-8 lg:p-10" aria-labelledby="rank-heading">
          <div className="arena-grid pointer-events-none absolute inset-0 opacity-35" aria-hidden="true" />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-bold text-indigo-100">CA</div>
                <div>
                  <p className="text-sm font-semibold text-white">Practice profile</p>
                  <p className="text-xs text-zinc-400">Saved privately on this device</p>
                </div>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200/80">Competitive rank</p>
              <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
                <h2 id="rank-heading" className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Unranked</h2>
                <span className="mb-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-300">Earned in rated contests</span>
              </div>
              <p className="mt-3 max-w-lg text-sm leading-6 text-zinc-300">
                Practice XP builds your momentum. Your competitive rating starts when rated duels arrive.
              </p>
              <Link href="/problems" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300">
                Solve a challenge <span aria-hidden="true">→</span>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
                <p className="text-xs text-zinc-400">Practice XP</p>
                <p className="mt-2 text-3xl font-bold text-white">{progress.xp.toLocaleString()}</p>
                <p className="mt-1 text-[11px] text-indigo-200">Level {level} · {levelProgress}/{XP_PER_LEVEL} to next</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Progress to next practice level" aria-valuemin={0} aria-valuemax={XP_PER_LEVEL} aria-valuenow={levelProgress}>
                  <div className="h-full rounded-full bg-indigo-300 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${levelProgress}%` }} />
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
                <p className="text-xs text-zinc-400">Practice streak</p>
                <p className="mt-2 text-3xl font-bold text-white">{streak}<span className="ml-1 text-sm font-medium text-zinc-400">days</span></p>
                <p className="mt-1 text-[11px] text-zinc-400">Consecutive days with a sample pass</p>
              </div>
              <div className="col-span-2 rounded-2xl border border-indigo-300/10 bg-indigo-300/[0.06] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-indigo-100">Next achievement</p>
                    <p className="mt-1 text-sm font-semibold text-white">First light</p>
                  </div>
                  <span className="rounded-lg border border-indigo-200/15 bg-indigo-200/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-100">{firstStepsEarned ? 'Unlocked' : '1 sample pass'}</span>
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                  <div className={`h-full rounded-full bg-indigo-300 transition-[width] duration-500 motion-reduce:transition-none ${firstStepsEarned ? 'w-full' : 'w-0'}`} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="arena-panel rounded-2xl border border-white/[0.08] bg-[#101722] p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-white">Campus feed</h2>
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${isStreamConnected ? 'bg-emerald-300/10 text-emerald-200' : 'bg-amber-300/10 text-amber-100'}`}>{isStreamConnected ? 'SSE live' : 'Preview'}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">Practice sample verdicts · source code is never broadcast</p>
              </div>
              <div className="flex rounded-lg border border-white/[0.08] bg-black/20 p-1" aria-label="Filter activity">
                {(['All', 'Practice'] as const).map((filter) => (
                  <button key={filter} type="button" onClick={() => setActivityFilter(filter)} aria-pressed={activityFilter === filter} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300 ${activityFilter === filter ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}>
                    {filter}
                  </button>
                ))}
              </div>
            </div>
            {!isStreamConnected && <p className="mb-3 text-[11px] text-amber-100/70">Example activity is shown until the API event stream connects.</p>}
            {filteredEvents.length ? (
              <ol className="divide-y divide-white/[0.06]" aria-live="polite" aria-relevant="additions text">
                {filteredEvents.slice(0, 5).map((event) => (
                  <li key={event.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <ActivityIcon />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-100">A student passed sample tests</p>
                      <Link href={`/problems/${event.problemSlug}`} className="mt-0.5 block truncate text-xs text-zinc-400 transition hover:text-indigo-200">{event.problemTitle}</Link>
                    </div>
                    <time className="shrink-0 text-[11px] text-zinc-500" dateTime={event.createdAt}>{event.relativeTime}</time>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
                <p className="text-sm font-medium text-zinc-200">The arena is warming up.</p>
                <p className="mt-1 text-xs text-zinc-500">A practice sample pass will light up the feed.</p>
              </div>
            )}
          </div>

          <div className="arena-panel rounded-2xl border border-white/[0.08] bg-[#101722] p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Campus board</h2>
                <p className="mt-1 text-xs text-zinc-400">Preview standings · practice XP only</p>
              </div>
              <label className="sr-only" htmlFor="board-period">Leaderboard period</label>
              <select id="board-period" value={boardPeriod} onChange={(event) => setBoardPeriod(event.target.value as BoardPeriod)} className="rounded-lg border border-white/10 bg-[#0a1018] px-2.5 py-2 text-xs text-zinc-200 outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
                {(['Today', 'This week', 'All time'] as const).map((period) => <option key={period}>{period}</option>)}
              </select>
            </div>
            <ol className="space-y-2" aria-label={`${boardPeriod} preview standings`}>
              {currentBoard.map((player, index) => (
                <li key={player.handle} className="flex items-center gap-3 rounded-xl border border-transparent bg-white/[0.025] px-3 py-3">
                  <span className={`w-6 text-center font-mono text-xs ${index === 0 ? 'text-amber-200' : 'text-zinc-500'}`}>{String(index + 1).padStart(2, '0')}</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.07] text-[10px] font-bold uppercase text-zinc-300">{player.handle.slice(0, 2)}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-100">{player.handle}</span>
                  <span className="text-right"><span className="block text-xs font-semibold text-white">{player.points.toLocaleString()} XP</span><span className={`text-[10px] ${player.change.startsWith('+') ? 'text-emerald-300' : player.change.startsWith('−') ? 'text-rose-300' : 'text-zinc-500'}`}>{player.change}</span></span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[10px] leading-4 text-zinc-500">Sample handles and standings illustrate the layout. Real campus ranks need contest accounts and persisted results.</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="arena-panel rounded-2xl border border-white/[0.08] bg-[#101722] p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Achievement set</h2>
                <p className="mt-1 text-xs text-zinc-400">Earned by this browser profile</p>
              </div>
              <span className="text-xs font-medium text-zinc-500">{firstStepsEarned ? '1' : '0'} / 3</span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className={`rounded-xl border p-3 text-center ${firstStepsEarned ? 'border-emerald-300/20 bg-emerald-300/[0.06]' : 'border-white/[0.07] bg-white/[0.02]'}`}>
                <span className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${firstStepsEarned ? 'bg-emerald-300/10 text-emerald-200' : 'bg-white/5 text-zinc-500'}`} aria-hidden="true">01</span>
                <p className="mt-2 text-[11px] font-semibold text-zinc-100">First light</p>
                <p className="mt-1 text-[10px] text-zinc-500">First sample pass</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-sm font-bold text-zinc-500" aria-hidden="true">07</span>
                <p className="mt-2 text-[11px] font-semibold text-zinc-100">On a roll</p>
                <p className="mt-1 text-[10px] text-zinc-500">7-day streak</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-sm font-bold text-zinc-500" aria-hidden="true">03</span>
                <p className="mt-2 text-[11px] font-semibold text-zinc-100">Three-peat</p>
                <p className="mt-1 text-[10px] text-zinc-500">3 unique problems</p>
              </div>
            </div>
          </div>

          <div className="arena-panel rounded-2xl border border-white/[0.08] bg-[#101722] p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-200/80">Today’s warm-up</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Two Sum</h2>
                <p className="mt-1 max-w-md text-xs leading-5 text-zinc-400">Find the pair, pass the samples, and bank your first practice XP. Practice results don’t affect competitive rating.</p>
              </div>
              <Link href="/problems/two-sum" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-indigo-300/20 bg-indigo-300/10 px-4 py-2.5 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-300/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300">
                Open challenge <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.07] pt-4 text-[10px] text-zinc-500">
              <span className="rounded-md bg-white/[0.04] px-2 py-1">+{XP_PER_PRACTICE_SOLVE} practice XP on first sample pass</span>
              <span className="rounded-md bg-white/[0.04] px-2 py-1">Progress stays on this device</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
