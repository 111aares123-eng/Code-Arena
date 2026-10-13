import Link from 'next/link';
import { getDifficultyStats, getMockProblems } from '@code-arena/shared';
import { DifficultyBadge } from '../components/difficulty-badge';

export default function Home() {
  const stats = getDifficultyStats();
  const featuredProblems = getMockProblems().slice(0, 4);

  return (
    <div className="flex-1 bg-zinc-950 flex flex-col justify-between">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-semibold text-indigo-300 mb-6">
            <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
            Phase 2B • PostgreSQL & tRPC API Live
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Elevate Your Coding Skills in the{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
              Arena
            </span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            A gamified competitive programming platform tailored for college students. Practice algorithmic challenges, prepare for technical interviews, and execute Python and C++ solutions.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/problems"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 transition-all hover:scale-105"
            >
              Browse Problem Library
              <span aria-hidden="true">→</span>
            </Link>

            <Link
              href="/problems/two-sum"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/80 px-6 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              Try Two Sum Problem
            </Link>
          </div>

          {/* Quick Problem Library Stats */}
          <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
              <span className="text-xs text-zinc-400 font-medium">Total Problems</span>
              <p className="text-2xl font-bold text-zinc-100 mt-1">{stats.Total}</p>
            </div>
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <span className="text-xs text-emerald-400 font-medium">Easy</span>
              <p className="text-2xl font-bold text-emerald-300 mt-1">{stats.Easy}</p>
            </div>
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <span className="text-xs text-amber-400 font-medium">Medium</span>
              <p className="text-2xl font-bold text-amber-300 mt-1">{stats.Medium}</p>
            </div>
            <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
              <span className="text-xs text-rose-400 font-medium">Hard</span>
              <p className="text-2xl font-bold text-rose-300 mt-1">{stats.Hard}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Problems Preview Section */}
      <section className="border-t border-zinc-900 bg-zinc-900/30 py-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                Curated Challenges
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
                Featured Problems
              </h2>
            </div>

            <Link
              href="/problems"
              className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
            >
              View all {stats.Total} problems <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featuredProblems.map((problem) => (
              <Link
                key={problem.id}
                href={`/problems/${problem.slug}`}
                className="group flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 hover:border-zinc-700 hover:bg-zinc-900 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h3 className="text-base font-semibold text-zinc-100 group-hover:text-indigo-400 transition-colors">
                      {problem.title}
                    </h3>
                    <DifficultyBadge difficulty={problem.difficulty} />
                  </div>
                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mb-3">
                    {problem.shortDescription}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-500 pt-3 border-t border-zinc-800/60">
                  <span className="font-mono">{problem.category}</span>
                  <span className="font-medium text-indigo-400 group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                    Solve <span aria-hidden="true">→</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Modular Platform Roadmap Section */}
      <section className="border-t border-zinc-900 bg-zinc-950 py-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Architecture & Roadmap
          </h2>
          <p className="text-center text-xl font-bold text-zinc-200 mb-10">
            Modular Platform Integration
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-5">
              <div className="text-xs font-semibold text-indigo-400 mb-1">My Responsibility</div>
              <h3 className="text-sm font-bold text-white mb-2">Problem Library & Editor</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Problem catalog, filtering, online editor, Judge0 CE integration for Python and C++ executions.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
              <div className="text-xs font-semibold text-zinc-400 mb-1">Teammates Modules</div>
              <h3 className="text-sm font-bold text-zinc-300 mb-2">Auth & Dashboards</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Managed by Nivedha (accounts & roles). Designed with clean interfaces ready for auth integration.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
              <div className="text-xs font-semibold text-zinc-400 mb-1">Gamification & Rankings</div>
              <h3 className="text-sm font-bold text-zinc-300 mb-2">Leaderboard & XP</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Managed by Karthika & Varun. Submission status hooks will emit XP gains and rating updates.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
