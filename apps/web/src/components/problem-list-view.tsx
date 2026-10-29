'use client';

import { useState, useMemo, useTransition, useCallback, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Problem, ProblemDifficulty } from '../types/problem';
import { ProblemCard } from './problem-card';
import { ProblemFilters } from './problem-filters';
import { EmptyState } from './empty-state';

export interface ProblemListViewProps {
  initialProblems: Problem[];
  availableTags: string[];
  stats: Record<ProblemDifficulty | 'Total', number>;
  initialQuery?: string;
  initialDifficulty?: 'ALL' | ProblemDifficulty;
  initialTag?: string;
  totalResults?: number;
  currentPage?: number;
  totalPages?: number;
}

export function ProblemListView({
  initialProblems,
  availableTags,
  stats,
  initialQuery = '',
  initialDifficulty = 'ALL',
  initialTag = '',
  totalResults: serverTotal,
  currentPage = 1,
  totalPages = 1,
}: ProblemListViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'ALL' | ProblemDifficulty>(initialDifficulty);
  const [selectedTag, setSelectedTag] = useState(initialTag);

  // Track prop changes during render to avoid cascading effect renders
  const [prevInitialQuery, setPrevInitialQuery] = useState(initialQuery);
  const [prevInitialDiff, setPrevInitialDiff] = useState(initialDifficulty);
  const [prevInitialTag, setPrevInitialTag] = useState(initialTag);

  if (initialQuery !== prevInitialQuery) {
    setPrevInitialQuery(initialQuery);
    setSearchQuery(initialQuery);
  }
  if (initialDifficulty !== prevInitialDiff) {
    setPrevInitialDiff(initialDifficulty);
    setSelectedDifficulty(initialDifficulty);
  }
  if (initialTag !== prevInitialTag) {
    setPrevInitialTag(initialTag);
    setSelectedTag(initialTag);
  }

  // Synchronize state changes to URL query parameters
  const updateUrl = useCallback(
    (newQuery: string, newDiff: 'ALL' | ProblemDifficulty, newTag: string, newPage: number = 1) => {
      const params = new URLSearchParams(searchParams ? searchParams.toString() : '');

      if (newQuery.trim()) {
        params.set('q', newQuery.trim());
      } else {
        params.delete('q');
      }

      if (newDiff && newDiff !== 'ALL') {
        params.set('difficulty', newDiff);
      } else {
        params.delete('difficulty');
      }

      if (newTag) {
        params.set('tag', newTag);
      } else {
        params.delete('tag');
      }

      if (newPage > 1) {
        params.set('page', String(newPage));
      } else {
        params.delete('page');
      }

      const queryString = params.toString();
      const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;

      startTransition(() => {
        router.replace(targetUrl, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  // Debounced search query updates (300ms) for responsive typing
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      updateUrl(val, selectedDifficulty, selectedTag, 1);
    }, 300);
  };

  const handleDifficultyChange = (diff: 'ALL' | ProblemDifficulty) => {
    setSelectedDifficulty(diff);
    updateUrl(searchQuery, diff, selectedTag, 1);
  };

  const handleTagChange = (tag: string) => {
    setSelectedTag(tag);
    updateUrl(searchQuery, selectedDifficulty, tag, 1);
  };

  const handleReset = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setSearchQuery('');
    setSelectedDifficulty('ALL');
    setSelectedTag('');
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  };

  const handlePageChange = (newPage: number) => {
    updateUrl(searchQuery, selectedDifficulty, selectedTag, newPage);
  };

  // Instant local filtering while server request / URL navigation is in flight
  const filteredProblems = useMemo(() => {
    // If client filter matches what the server supplied, use server-filtered items directly
    const isMatchingServer =
      searchQuery.trim() === initialQuery.trim() &&
      selectedDifficulty === initialDifficulty &&
      selectedTag === initialTag;

    if (isMatchingServer) {
      return initialProblems;
    }

    return initialProblems.filter((problem) => {
      if (selectedDifficulty !== 'ALL' && problem.difficulty !== selectedDifficulty) {
        return false;
      }

      if (selectedTag && !problem.tags.includes(selectedTag)) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = problem.title.toLowerCase().includes(query);
        const matchesDesc = problem.shortDescription.toLowerCase().includes(query);
        const matchesTags = problem.tags.some((tag) => tag.toLowerCase().includes(query));
        return matchesTitle || matchesDesc || matchesTags;
      }

      return true;
    });
  }, [initialProblems, selectedDifficulty, selectedTag, searchQuery, initialQuery, initialDifficulty, initialTag]);

  const displayTotal =
    searchQuery === initialQuery && selectedDifficulty === initialDifficulty && selectedTag === initialTag
      ? serverTotal ?? filteredProblems.length
      : filteredProblems.length;

  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      {/* Overview Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="flex flex-col p-4 rounded-xl border border-[#252D25]/10 bg-[#E8E2D6] shadow-xs">
          <span className="text-xs font-medium text-[#526052]">Total Problems</span>
          <span className="text-2xl font-bold font-mono text-[#252D25] mt-1">{stats.Total}</span>
        </div>

        <div className="flex flex-col p-4 rounded-xl border border-emerald-700/20 bg-emerald-800/5 shadow-xs">
          <span className="text-xs font-medium text-emerald-800">Easy Problems</span>
          <span className="text-2xl font-bold font-mono text-emerald-800 mt-1">{stats.Easy}</span>
        </div>

        <div className="flex flex-col p-4 rounded-xl border border-amber-700/25 bg-amber-800/5 shadow-xs">
          <span className="text-xs font-medium text-amber-900">Medium Problems</span>
          <span className="text-2xl font-bold font-mono text-amber-900 mt-1">{stats.Medium}</span>
        </div>

        <div className="flex flex-col p-4 rounded-xl border border-rose-700/25 bg-rose-800/5 shadow-xs">
          <span className="text-xs font-medium text-rose-900">Hard Problems</span>
          <span className="text-2xl font-bold font-mono text-rose-900 mt-1">{stats.Hard}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <ProblemFilters
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        selectedDifficulty={selectedDifficulty}
        onDifficultyChange={handleDifficultyChange}
        selectedTag={selectedTag}
        onTagChange={handleTagChange}
        availableTags={availableTags}
        totalResults={displayTotal}
        totalProblems={stats.Total || initialProblems.length}
        onReset={handleReset}
      />

      {/* Problem List or Empty State */}
      {filteredProblems.length > 0 ? (
        <section
          aria-label="Problems List"
          className="rounded-xl border border-[#252D25]/10 bg-[#E8E2D6] overflow-hidden shadow-xs divide-y divide-[#252D25]/10"
        >
          {/* Table Header Row (Desktop) */}
          <div className="hidden sm:flex items-center justify-between px-4 sm:px-5 py-2.5 bg-[#E2DBD0] text-[11px] font-mono font-medium text-[#526052] uppercase tracking-wider">
            <span>Problem / Topics</span>
            <div className="flex items-center gap-7 sm:gap-9 pr-6">
              <span>Acceptance</span>
              <span>Difficulty</span>
            </div>
          </div>

          {/* Problem Rows */}
          <div role="list" className="divide-y divide-[#252D25]/10">
            {filteredProblems.map((problem) => (
              <ProblemCard key={problem.id} problem={problem} />
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          title="No problems found"
          description={`No problems found matching "${searchQuery || selectedDifficulty || selectedTag}".`}
          onReset={handleReset}
        />
      )}

      {/* Server Pagination Bar */}
      {totalPages > 1 && (
        <nav
          aria-label="Problem List Pagination"
          className="flex items-center justify-between px-4 py-3 bg-[#E8E2D6] rounded-xl border border-[#252D25]/10 text-xs font-medium text-[#526052]"
        >
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => handlePageChange(currentPage - 1)}
            className="px-3 py-1.5 rounded-lg border border-[#252D25]/15 bg-[#FDFBF7] text-[#252D25] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#E2DBD0] transition-colors cursor-pointer"
          >
            ← Previous
          </button>
          <span className="font-mono">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
            className="px-3 py-1.5 rounded-lg border border-[#252D25]/15 bg-[#FDFBF7] text-[#252D25] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#E2DBD0] transition-colors cursor-pointer"
          >
            Next →
          </button>
        </nav>
      )}
    </div>
  );
}
