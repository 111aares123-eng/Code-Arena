import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getAllProblemTags } from '../../data/mock-problems';
import { ProblemListView } from '../../components/problem-list-view';
import { fetchProblems, fetchProblemStats } from '../../lib/api';

export const metadata: Metadata = {
  title: 'Problem Library | CodeArena 2.0',
  description: 'Browse, filter, and practice algorithmic problems in Python and C++ on CodeArena 2.0.',
};

function ProblemListSkeleton() {
  return (
    <div className="flex flex-col gap-8 animate-pulse">
      {/* Stats Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-zinc-900/60 border border-zinc-800/80" />
        ))}
      </div>
      {/* Filter Bar Skeleton */}
      <div className="h-28 rounded-xl bg-zinc-900/40 border border-zinc-800/80" />
      {/* Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-44 rounded-xl bg-zinc-900/50 border border-zinc-800/80" />
        ))}
      </div>
    </div>
  );
}

async function ProblemListSection() {
  const [problemData, stats] = await Promise.all([
    fetchProblems({ limit: 100 }),
    fetchProblemStats(),
  ]);

  const tagsSet = new Set<string>(getAllProblemTags());
  problemData.items.forEach((p) => p.tags.forEach((t) => tagsSet.add(t)));
  const tags = Array.from(tagsSet).sort();

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        {problemData.source === 'api' ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            PostgreSQL Live Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
            Fallback Dataset
          </span>
        )}
      </div>

      <ProblemListView
        initialProblems={problemData.items}
        availableTags={tags}
        stats={stats}
      />
    </div>
  );
}

export default function ProblemsPage() {
  return (
    <div className="flex-1 bg-zinc-950 py-10 px-4 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-7xl">
        {/* Header Section */}
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            Problem Library
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Algorithmic Challenges
          </h1>
          <p className="mt-2 text-base text-zinc-400 max-w-2xl">
            Master data structures and algorithms with interactive problems designed for college competitive programming.
          </p>
        </header>

        {/* Streaming Suspense Wrapper */}
        <Suspense fallback={<ProblemListSkeleton />}>
          <ProblemListSection />
        </Suspense>
      </main>
    </div>
  );
}
