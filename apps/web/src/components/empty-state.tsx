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
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-[#252D25]/15 rounded-2xl bg-[#E8E2D6]">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DDE5D5] text-[#526052] mb-4 ring-1 ring-[#252D25]/10">
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

      <h3 className="text-lg font-semibold text-[#252D25]">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-[#526052] leading-relaxed">{description}</p>

      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#F5F1E8] bg-[#344E41] hover:bg-[#25382E] border border-[#344E41] rounded-lg transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#344E41] active:scale-[0.98] cursor-pointer"
        >
          Reset Filters
        </button>
      )}
    </div>
  );
}
