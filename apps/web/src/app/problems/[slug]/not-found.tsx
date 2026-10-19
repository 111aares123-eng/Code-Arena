import Link from 'next/link';

export default function ProblemNotFound() {
  return (
    <div className="flex-1 flex items-center justify-center py-24 px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#DDE5D5] border border-[#252D25]/10 text-rose-900 mb-6 shadow-xs">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-8 h-8"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-[#252D25]">Problem Not Found</h1>
        <p className="mt-2 text-sm text-[#526052] leading-relaxed">
          The algorithmic problem you are looking for does not exist in the CodeArena 2.0 problem library or may have been moved.
        </p>

        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/problems"
            className="rounded-lg bg-[#344E41] px-4 py-2 text-sm font-semibold text-[#F5F1E8] hover:bg-[#25382E] transition-all active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#344E41]"
          >
            View Problem Library
          </Link>
          <Link
            href="/"
            className="rounded-lg bg-[#E8E2D6] px-4 py-2 text-sm font-semibold text-[#252D25] hover:bg-[#DDD7CA] border border-[#252D25]/15 transition-all active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#344E41]"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
