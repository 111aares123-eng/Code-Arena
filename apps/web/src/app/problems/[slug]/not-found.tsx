import Link from 'next/link';

export default function ProblemNotFound() {
  return (
    <div className="flex-1 bg-zinc-950 flex items-center justify-center py-24 px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-rose-400 mb-6 ring-1 ring-rose-500/20">
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

        <h1 className="text-2xl font-bold tracking-tight text-white">Problem Not Found</h1>
        <p className="mt-2 text-sm text-zinc-400">
          The algorithmic problem you are looking for does not exist in the CodeArena 2.0 problem library or may have been moved.
        </p>

        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/problems"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
          >
            View Problem Library
          </Link>
          <Link
            href="/"
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-700 border border-zinc-700 transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
