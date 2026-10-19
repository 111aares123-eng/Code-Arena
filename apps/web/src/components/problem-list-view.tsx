'use client';

import { useState, useMemo } from 'react';
import type { Problem, ProblemDifficulty } from '../types/problem';
import { ProblemCard } from './problem-card';
import { ProblemFilters } from './problem-filters';
import { EmptyState } from './empty-state';

interface ProblemListViewProps {
  initialProblems: Problem[];
  availableTags: string[];
  stats: Record<ProblemDifficulty | 'Total', number>;
}

export function ProblemListView({
  initialProblems,
  availableTags,
  stats,
}: ProblemListViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'ALL' | ProblemDifficulty>('ALL');
  const [selectedTag, setSelectedTag] = useState('');

  // Filter problems based on search, difficulty, and tag
  const filteredProblems = useMemo(() => {
    return initialProblems.filter((problem) => {
      // Difficulty match
      if (selectedDifficulty !== 'ALL' && problem.difficulty !== selectedDifficulty) {
        return false;
      }

      // Tag match
      if (selectedTag && !problem.tags.includes(selectedTag)) {
        return false;
      }

      // Search match (title, shortDescription, or tags)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = problem.title.toLowerCase().includes(query);
        const matchesDesc = problem.shortDescription.toLowerCase().includes(query);
        const matchesTags = problem.tags.some((tag) => tag.toLowerCase().includes(query));
        return matchesTitle || matchesDesc || matchesTags;
      }

      return true;
    });
  }, [initialProblems, selectedDifficulty, selectedTag, searchQuery]);

  const handleReset = () => {
    setSearchQuery('');
    setSelectedDifficulty('ALL');
    setSelectedTag('');
  };

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
        onSearchChange={setSearchQuery}
        selectedDifficulty={selectedDifficulty}
        onDifficultyChange={setSelectedDifficulty}
        selectedTag={selectedTag}
        onTagChange={setSelectedTag}
        availableTags={availableTags}
        totalResults={filteredProblems.length}
        totalProblems={initialProblems.length}
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
    </div>
  );
}
