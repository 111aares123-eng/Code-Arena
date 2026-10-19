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
    <div className="flex flex-col gap-3.5 sm:gap-4 rounded-xl border border-[#252D25]/10 bg-[#E8E2D6] p-3.5 sm:p-4 shadow-xs">
      {/* Top row: Search input + Tag filter dropdown */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#526052]">
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
            className="w-full rounded-lg border border-[#252D25]/15 bg-[#FDFBF7] pl-10 pr-9 py-2 text-sm text-[#252D25] placeholder-[#526052]/70 focus:border-[#344E41] focus:ring-1 focus:ring-[#344E41] focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#526052] hover:text-[#252D25] transition-colors cursor-pointer"
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
            className="w-full rounded-lg border border-[#252D25]/15 bg-[#FDFBF7] px-3.5 py-2 text-sm text-[#252D25] focus:border-[#344E41] focus:ring-1 focus:ring-[#344E41] focus:outline-none transition-colors cursor-pointer"
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
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#252D25]/10">
        <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Difficulty Filter">
          <span className="text-xs text-[#526052] font-medium mr-1 hidden sm:inline">Difficulty:</span>
          {difficulties.map((diff) => {
            const isSelected = selectedDifficulty === diff;
            let activeColor = 'bg-[#344E41] text-[#F5F1E8] border-[#344E41]';

            if (isSelected) {
              if (diff === 'Easy') activeColor = 'bg-emerald-800/15 text-emerald-800 border-emerald-700/35';
              else if (diff === 'Medium') activeColor = 'bg-amber-800/15 text-amber-900 border-amber-700/35';
              else if (diff === 'Hard') activeColor = 'bg-rose-800/15 text-rose-900 border-rose-700/35';
              else activeColor = 'bg-[#344E41] text-[#F5F1E8] border-[#344E41]';
            }

            return (
              <button
                key={diff}
                type="button"
                onClick={() => onDifficultyChange(diff)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#344E41] ${
                  isSelected
                    ? activeColor
                    : 'bg-[#F5F1E8] text-[#526052] border-[#252D25]/10 hover:text-[#252D25] hover:bg-[#DDE5D5]/60 hover:border-[#252D25]/20'
                }`}
              >
                {diff}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-xs text-[#526052]">
          <span>
            Showing <strong className="text-[#252D25] font-mono font-semibold">{totalResults}</strong> of{' '}
            <strong className="text-[#252D25] font-mono font-semibold">{totalProblems}</strong> problems
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs font-semibold text-[#344E41] hover:text-[#25382E] hover:underline cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#344E41] rounded"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
