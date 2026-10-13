import type { ProblemDifficulty } from '../types/problem';

interface DifficultyBadgeProps {
  difficulty: ProblemDifficulty;
  className?: string;
}

export function DifficultyBadge({ difficulty, className = '' }: DifficultyBadgeProps) {
  const styles: Record<ProblemDifficulty, string> = {
    Easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 ring-1 ring-emerald-500/20',
    Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30 ring-1 ring-amber-500/20',
    Hard: 'bg-rose-500/10 text-rose-400 border-rose-500/30 ring-1 ring-rose-500/20',
  };

  const dots: Record<ProblemDifficulty, string> = {
    Easy: 'bg-emerald-400',
    Medium: 'bg-amber-400',
    Hard: 'bg-rose-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[difficulty]} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dots[difficulty]}`} aria-hidden="true" />
      {difficulty}
    </span>
  );
}
