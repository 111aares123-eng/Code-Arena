import Link from 'next/link';

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#252D25]/10 bg-[#F5F1E8]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#344E41] rounded-lg p-0.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#344E41] text-[#F5F1E8] font-bold shadow-xs">
              <span className="font-mono text-sm">&lt;/&gt;</span>
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-[#252D25] group-hover:text-[#344E41] transition-colors duration-150">
                CodeArena <span className="text-[#344E41] font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#DDE5D5] border border-[#879B7A]/30 ml-1.5">2.0</span>
              </span>
              <span className="text-[10px] text-[#526052] tracking-wide font-medium">Competitive Programming</span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
            <Link
              href="/problems"
              className="px-3 py-1.5 rounded-md text-sm font-medium text-[#526052] hover:text-[#252D25] hover:bg-[#E8E2D6] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#344E41] transition-colors duration-150"
            >
              Problems
            </Link>
            <Link
              href="/arena"
              className="px-3 py-1.5 rounded-md text-sm font-medium text-[#526052] hover:text-[#252D25] hover:bg-[#E8E2D6] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#344E41] transition-colors duration-150"
            >
              Arena
            </Link>
          </nav>
        </div>

        {/* Right Action & Status */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full border border-[#252D25]/10 bg-[#E8E2D6] text-xs text-[#252D25]">
            <span className="flex h-2 w-2 rounded-full bg-emerald-600" />
            <span>Python & C++ Ready</span>
          </div>

          <Link
            href="/arena"
            className="inline-flex items-center justify-center rounded-lg bg-[#344E41] hover:bg-[#25382E] px-4 py-2 text-sm font-semibold text-[#F5F1E8] shadow-xs transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#344E41]"
          >
            Enter Arena
          </Link>
        </div>
      </div>
    </header>
  );
}
