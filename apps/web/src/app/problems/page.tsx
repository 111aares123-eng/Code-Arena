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
    <div className="flex flex-col gap-6 sm:gap-7 animate-pulse">
      {/* Stats Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-[#E8E2D6] border border-[#252D25]/10" />
        ))}
      </div>
      {/* Filter Bar Skeleton */}
      <div className="h-24 rounded-xl bg-[#E8E2D6] border border-[#252D25]/10" />
      {/* Single-Column List Skeleton */}
      <div className="rounded-xl border border-[#252D25]/10 bg-[#E8E2D6] overflow-hidden divide-y divide-[#252D25]/10">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-14 px-5 py-3 bg-[#E8E2D6]" />
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-800/10 text-emerald-800 border border-emerald-700/25 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-700" />
            PostgreSQL Live Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#E8E2D6] text-[#526052] border border-[#252D25]/15 font-mono">
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
    <div className="flex-1 py-10 px-4 sm:px-6 lg:px-8 animate-fade-in">
      <main className="mx-auto max-w-7xl">
        {/* Header Section */}
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E8E2D6] text-[#344E41] border border-[#252D25]/15 mb-3 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[#344E41]" />
            Problem Library
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#252D25]">
            Algorithmic Challenges
          </h1>
          <p className="mt-2 text-base text-[#526052] max-w-2xl leading-relaxed">
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
