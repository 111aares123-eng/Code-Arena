import Link from 'next/link';
import type { Problem } from '../types/problem';
import { DifficultyBadge } from './difficulty-badge';

interface ProblemCardProps {
  problem: Problem;
}

export function ProblemCard({ problem }: ProblemCardProps) {
  return (
    <article className="group relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-zinc-700 hover:bg-zinc-900/90 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/5">
      <div>
        {/* Header: Title & Difficulty */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <Link
            href={`/problems/${problem.slug}`}
            className="text-lg font-semibold text-zinc-100 group-hover:text-indigo-400 transition-colors"
          >
            {problem.title}
          </Link>
          <DifficultyBadge difficulty={problem.difficulty} />
        </div>

        {/* Short description preview */}
        <p className="text-sm text-zinc-400 line-clamp-2 mb-4 leading-relaxed">
          {problem.shortDescription}
        </p>

        {/* Topic Tags */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {problem.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800/80 text-zinc-300 border border-zinc-700/50"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Footer Info: Acceptance, Supported Languages, Solve Button */}
      <div className="pt-4 mt-auto border-t border-zinc-800/70 flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-3">
          <span>
            Acc: <strong className="text-zinc-300">{problem.acceptanceRate}</strong>
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">
            <strong className="text-zinc-300">{problem.totalSubmissions.toLocaleString()}</strong> submissions
          </span>
        </div>

        <Link
          href={`/problems/${problem.slug}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-colors"
        >
          Solve Problem
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
