import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getMockProblems } from '../../../data/mock-problems';
import { fetchProblemBySlug } from '../../../lib/api';
import { ProblemWorkspace } from './problem-workspace';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getMockProblems().map((p) => ({
    slug: p.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { problem } = await fetchProblemBySlug(slug);

  if (!problem) {
    return {
      title: 'Problem Not Found | CodeArena 2.0',
    };
  }

  return {
    title: `${problem.title} — Online Code Editor | CodeArena 2.0`,
    description: problem.shortDescription,
  };
}

function ProblemWorkspaceSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 animate-pulse">
      {/* Header bar skeleton */}
      <div className="border-b border-zinc-800 bg-zinc-950 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-5 w-20 bg-zinc-800 rounded" />
          <div className="h-5 w-40 bg-zinc-800 rounded" />
          <div className="h-5 w-16 bg-zinc-800 rounded" />
        </div>
        <div className="h-5 w-28 bg-zinc-800 rounded" />
      </div>

      {/* Main split grid skeleton */}
      <div className="flex-1 p-5 max-w-[1720px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left column skeleton */}
        <div className="lg:col-span-5 bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-6 space-y-4">
          <div className="h-4 w-32 bg-zinc-800 rounded" />
          <div className="h-8 w-3/4 bg-zinc-800 rounded" />
          <div className="h-24 bg-zinc-800/60 rounded" />
          <div className="h-32 bg-zinc-800/60 rounded" />
        </div>

        {/* Right column skeleton */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex-1 min-h-[460px] bg-zinc-900/40 border border-zinc-800/80 rounded-xl" />
          <div className="h-[280px] bg-zinc-900/40 border border-zinc-800/80 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

async function ProblemDetailSection({ slug }: { slug: string }) {
  const { problem, source } = await fetchProblemBySlug(slug);

  if (!problem) {
    notFound();
  }

  return <ProblemWorkspace problem={problem} source={source} />;
}

export default async function ProblemDetailPage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <Suspense fallback={<ProblemWorkspaceSkeleton />}>
      <ProblemDetailSection slug={slug} />
    </Suspense>
  );
}
