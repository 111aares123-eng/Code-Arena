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
    <div className="flex flex-col gap-8">
      {/* Overview Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="flex flex-col p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <span className="text-xs font-medium text-zinc-400">Total Problems</span>
          <span className="text-2xl font-bold text-zinc-100 mt-1">{stats.Total}</span>
        </div>

        <div className="flex flex-col p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <span className="text-xs font-medium text-emerald-400">Easy Problems</span>
          <span className="text-2xl font-bold text-emerald-300 mt-1">{stats.Easy}</span>
        </div>

        <div className="flex flex-col p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <span className="text-xs font-medium text-amber-400">Medium Problems</span>
          <span className="text-2xl font-bold text-amber-300 mt-1">{stats.Medium}</span>
        </div>

        <div className="flex flex-col p-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
          <span className="text-xs font-medium text-rose-400">Hard Problems</span>
          <span className="text-2xl font-bold text-rose-300 mt-1">{stats.Hard}</span>
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

      {/* Problem Cards or Empty State */}
      {filteredProblems.length > 0 ? (
        <section aria-label="Problems List" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProblems.map((problem) => (
            <ProblemCard key={problem.id} problem={problem} />
          ))}
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
