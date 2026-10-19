import Link from 'next/link';
import { getDifficultyStats, getMockProblems } from '@code-arena/shared';
import { DifficultyBadge } from '../components/difficulty-badge';

export default function Home() {
  const stats = getDifficultyStats();
  const featuredProblems = getMockProblems().slice(0, 4);

  return (
    <div className="flex-1 flex flex-col justify-between animate-fade-in">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-16 sm:pb-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#252D25]/15 bg-[#E8E2D6] px-3.5 py-1 text-xs font-semibold text-[#344E41] mb-6 font-mono">
            <span className="flex h-2 w-2 rounded-full bg-[#344E41]" />
            Practice XP · achievement preview · live feed foundation
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#252D25] leading-tight">
            Elevate Your Coding Skills in the <span className="text-[#344E41]">Arena</span>
          </h1>

          <p className="mt-4 text-base sm:text-lg text-[#526052] max-w-2xl mx-auto leading-relaxed">
            A gamified competitive programming platform tailored for college students. Practice algorithmic challenges, prepare for technical interviews, and execute Python and C++ solutions.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/arena"
              className="inline-flex items-center gap-2 rounded-xl bg-[#344E41] px-6 py-3 text-sm font-semibold text-[#F5F1E8] hover:bg-[#25382E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#344E41] transition-all active:scale-[0.98]"
            >
              Enter the Arena
              <span aria-hidden="true">→</span>
            </Link>

            <Link
              href="/problems"
              className="inline-flex items-center gap-2 rounded-xl border border-[#252D25]/15 bg-[#E8E2D6] px-6 py-3 text-sm font-semibold text-[#252D25] hover:bg-[#DDD7CA] hover:border-[#879B7A] transition-all active:scale-[0.98]"
            >
              Browse Problem Library
              <span aria-hidden="true">→</span>
            </Link>

            <Link
              href="/problems/two-sum"
              className="inline-flex items-center gap-2 rounded-xl border border-[#252D25]/15 bg-[#E8E2D6] px-6 py-3 text-sm font-semibold text-[#252D25] hover:bg-[#DDD7CA] hover:border-[#879B7A] transition-all active:scale-[0.98]"
            >
              Try Two Sum Problem
            </Link>
          </div>

          {/* Quick Problem Library Stats */}
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-3xl mx-auto">
            <div className="p-4 rounded-xl border border-[#252D25]/10 bg-[#E8E2D6] shadow-xs">
              <span className="text-xs text-[#526052] font-medium">Total Problems</span>
              <p className="text-2xl font-bold font-mono text-[#252D25] mt-1">{stats.Total}</p>
            </div>
            <div className="p-4 rounded-xl border border-emerald-700/20 bg-emerald-800/5 shadow-xs">
              <span className="text-xs text-emerald-800 font-medium">Easy</span>
              <p className="text-2xl font-bold font-mono text-emerald-800 mt-1">{stats.Easy}</p>
            </div>
            <div className="p-4 rounded-xl border border-amber-700/25 bg-amber-800/5 shadow-xs">
              <span className="text-xs text-amber-900 font-medium">Medium</span>
              <p className="text-2xl font-bold font-mono text-amber-900 mt-1">{stats.Medium}</p>
            </div>
            <div className="p-4 rounded-xl border border-rose-700/25 bg-rose-800/5 shadow-xs">
              <span className="text-xs text-rose-900 font-medium">Hard</span>
              <p className="text-2xl font-bold font-mono text-rose-900 mt-1">{stats.Hard}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Problems Preview Section */}
      <section className="border-t border-[#252D25]/10 bg-[#E8E2D6]/40 py-14 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#344E41] font-mono">
                Curated Challenges
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#252D25] mt-1 tracking-tight">
                Featured Problems
              </h2>
            </div>

            <Link
              href="/problems"
              className="text-sm font-semibold text-[#344E41] hover:text-[#25382E] hover:underline inline-flex items-center gap-1 transition-colors"
            >
              View all {stats.Total} problems <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featuredProblems.map((problem) => (
              <Link
                key={problem.id}
                href={`/problems/${problem.slug}`}
                className="group flex flex-col justify-between rounded-xl border border-[#252D25]/10 bg-[#E8E2D6] p-5 hover:border-[#879B7A] transition-all duration-150 shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <h3 className="text-base font-semibold text-[#252D25] group-hover:text-[#344E41] transition-colors">
                      {problem.title}
                    </h3>
                    <DifficultyBadge difficulty={problem.difficulty} />
                  </div>
                  <p className="text-xs text-[#526052] line-clamp-2 leading-relaxed mb-4">
                    {problem.shortDescription}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs text-[#526052] pt-3 border-t border-[#252D25]/10">
                  <span className="font-mono text-[11px] text-[#526052] bg-[#F5F1E8] px-2 py-0.5 rounded border border-[#252D25]/10">
                    {problem.category}
                  </span>
                  <span className="font-semibold text-[#344E41] group-hover:text-[#25382E] group-hover:translate-x-0.5 transition-all inline-flex items-center gap-1">
                    Solve <span aria-hidden="true">→</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Modular Platform Roadmap Section */}
      <section className="border-t border-[#252D25]/10 bg-[#E8E2D6] py-14 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-xs font-semibold uppercase tracking-wider text-[#526052] font-mono mb-2">
            Architecture & Roadmap
          </h2>
          <p className="text-center text-xl font-bold text-[#252D25] mb-8 tracking-tight">
            Modular Platform Integration
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="rounded-xl border border-[#344E41]/30 bg-[#DDE5D5]/60 p-5 shadow-xs">
              <div className="text-xs font-semibold text-[#344E41] font-mono uppercase tracking-wider mb-1">My Responsibility</div>
              <h3 className="text-sm font-bold text-[#252D25] mb-2">Problem Library & Editor</h3>
              <p className="text-xs text-[#526052] leading-relaxed">
                Problem catalog, filtering, online editor, Judge0 CE integration for Python and C++ executions.
              </p>
            </div>

            <div className="rounded-xl border border-[#252D25]/10 bg-[#F5F1E8] p-5 shadow-xs">
              <div className="text-xs font-semibold text-[#526052] font-mono uppercase tracking-wider mb-1">Teammates Modules</div>
              <h3 className="text-sm font-bold text-[#252D25] mb-2">Auth & Dashboards</h3>
              <p className="text-xs text-[#526052] leading-relaxed">
                Managed by Nivedha (accounts & roles). Designed with clean interfaces ready for auth integration.
              </p>
            </div>

            <div className="rounded-xl border border-[#252D25]/10 bg-[#F5F1E8] p-5 shadow-xs">
              <div className="text-xs font-semibold text-[#526052] font-mono uppercase tracking-wider mb-1">Gamification & Rankings</div>
              <h3 className="text-sm font-bold text-[#252D25] mb-2">Leaderboard & XP</h3>
              <p className="text-xs text-[#526052] leading-relaxed">
                Managed by Karthika & Varun. Submission status hooks will emit XP gains and rating updates.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
