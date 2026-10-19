import Link from 'next/link';
import type { Problem } from '../types/problem';
import { DifficultyBadge } from './difficulty-badge';

interface ProblemCardProps {
  problem: Problem;
}

export function ProblemCard({ problem }: ProblemCardProps) {
  return (
    <Link
      href={`/problems/${problem.slug}`}
      className="group flex items-center justify-between gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-3.5 hover:bg-[#E2DBD0]/60 focus-visible:bg-[#E2DBD0]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#344E41] active:bg-[#DDD6C8] transition-colors duration-150 ease-out"
    >
      {/* Left: Problem Title & Tags */}
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-2">
          <span className="text-sm sm:text-base font-semibold text-[#252D25] group-hover:text-[#344E41] transition-colors duration-150 ease-out truncate">
            {problem.title}
          </span>
        </div>

        {/* Secondary topic metadata */}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className="inline-flex items-center text-[10px] font-mono text-[#526052] bg-[#F5F1E8] px-1.5 py-0.2 rounded border border-[#252D25]/10">
            {problem.category}
          </span>
          {problem.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono text-[#526052] bg-[#F5F1E8] border border-[#252D25]/10"
            >
              {tag}
            </span>
          ))}
          {problem.tags.length > 3 && (
            <span className="text-[10px] font-mono text-[#526052]">
              +{problem.tags.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* Right: Acceptance, Difficulty, Navigation hint */}
      <div className="flex items-center gap-3 sm:gap-6 shrink-0">
        {/* Real acceptance statistics */}
        {problem.acceptanceRate && (
          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="text-xs font-mono font-medium text-[#252D25]">
              {problem.acceptanceRate}
            </span>
            <span className="text-[10px] font-mono text-[#526052]">
              {problem.totalSubmissions.toLocaleString()} subs
            </span>
          </div>
        )}

        {/* Difficulty Badge (compact) */}
        <DifficultyBadge difficulty={problem.difficulty} size="sm" />

        {/* Subtle navigation affordance */}
        <span
          aria-hidden="true"
          className="text-[#526052]/50 group-hover:text-[#344E41] group-hover:translate-x-1 transition-all duration-150 ease-out text-xs"
        >
          →
        </span>
      </div>
    </Link>
  );
}
