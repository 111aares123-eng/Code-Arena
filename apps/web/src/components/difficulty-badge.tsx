import type { ProblemDifficulty } from '../types/problem';

interface DifficultyBadgeProps {
  difficulty: ProblemDifficulty;
  size?: 'sm' | 'default';
  className?: string;
}

export function DifficultyBadge({
  difficulty,
  size = 'default',
  className = '',
}: DifficultyBadgeProps) {
  const styles: Record<ProblemDifficulty, string> = {
    Easy: 'bg-emerald-800/10 text-emerald-800 border-emerald-700/20',
    Medium: 'bg-amber-800/10 text-amber-900 border-amber-700/25',
    Hard: 'bg-rose-800/10 text-rose-900 border-rose-700/25',
  };

  const dots: Record<ProblemDifficulty, string> = {
    Easy: 'bg-emerald-700',
    Medium: 'bg-amber-700',
    Hard: 'bg-rose-700',
  };

  const sizeStyles = {
    default: 'px-2.5 py-0.5 text-[11px] tracking-wider',
    sm: 'px-2 py-0.5 text-[10px] tracking-wide',
  };

  const dotSizes = {
    default: 'w-1.5 h-1.5',
    sm: 'w-1.25 h-1.25',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-mono font-semibold uppercase border shrink-0 ${sizeStyles[size]} ${styles[difficulty]} ${className}`}
    >
      <span className={`rounded-full ${dotSizes[size]} ${dots[difficulty]}`} aria-hidden="true" />
      {difficulty}
    </span>
  );
}
