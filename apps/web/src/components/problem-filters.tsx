'use client';

import type { ProblemDifficulty } from '../types/problem';

interface ProblemFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedDifficulty: 'ALL' | ProblemDifficulty;
  onDifficultyChange: (difficulty: 'ALL' | ProblemDifficulty) => void;
  selectedTag: string;
  onTagChange: (tag: string) => void;
  availableTags: string[];
  totalResults: number;
  totalProblems: number;
  onReset: () => void;
}

export function ProblemFilters({
  searchQuery,
  onSearchChange,
  selectedDifficulty,
  onDifficultyChange,
  selectedTag,
  onTagChange,
  availableTags,
  totalResults,
  totalProblems,
  onReset,
}: ProblemFiltersProps) {
  const difficulties: Array<'ALL' | ProblemDifficulty> = ['ALL', 'Easy', 'Medium', 'Hard'];

  const hasActiveFilters = searchQuery !== '' || selectedDifficulty !== 'ALL' || selectedTag !== '';

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5">
      {/* Top row: Search input + Tag filter dropdown */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.75}
              stroke="currentColor"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
          </div>
          <input
            id="problem-search"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search problems by title, keywords, or tags..."
            className="w-full rounded-lg border border-zinc-700/80 bg-zinc-950/80 pl-10 pr-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-300"
              aria-label="Clear search"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Tag Filter Dropdown */}
        <div className="w-full sm:w-56">
          <label htmlFor="tag-filter" className="sr-only">
            Filter by topic
          </label>
          <select
            id="tag-filter"
            value={selectedTag}
            onChange={(e) => onTagChange(e.target.value)}
            className="w-full rounded-lg border border-zinc-700/80 bg-zinc-950/80 px-3.5 py-2 text-sm text-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors"
          >
            <option value="">All Topics ({availableTags.length})</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bottom row: Difficulty tabs + Results count */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/80">
        <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Difficulty Filter">
          <span className="text-xs text-zinc-400 font-medium mr-1 hidden sm:inline">Difficulty:</span>
          {difficulties.map((diff) => {
            const isSelected = selectedDifficulty === diff;
            let activeColor = 'bg-zinc-800 text-zinc-100 border-zinc-600';

            if (isSelected) {
              if (diff === 'Easy') activeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50';
              else if (diff === 'Medium') activeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/50';
              else if (diff === 'Hard') activeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/50';
              else activeColor = 'bg-indigo-600 text-white border-indigo-500';
            }

            return (
              <button
                key={diff}
                type="button"
                onClick={() => onDifficultyChange(diff)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? activeColor
                    : 'bg-zinc-950/50 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                {diff}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span>
            Showing <strong className="text-zinc-200">{totalResults}</strong> of{' '}
            <strong className="text-zinc-200">{totalProblems}</strong> problems
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
