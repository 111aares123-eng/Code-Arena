interface EmptyStateProps {
  title?: string;
  description?: string;
  onReset?: () => void;
}

export function EmptyState({
  title = 'No problems found',
  description = 'Try adjusting your search query or difficulty filters to find matching problems.',
  onReset,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-400 mb-4 ring-1 ring-zinc-700/50">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-7 h-7"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
      </div>

      <h3 className="text-lg font-semibold text-zinc-200">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-zinc-400">{description}</p>

      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors cursor-pointer"
        >
          Reset Filters
        </button>
      )}
    </div>
  );
}
