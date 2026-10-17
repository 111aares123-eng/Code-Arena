import { Suspense } from 'react';
import Link from 'next/link';
import { getCurrentUser } from '../lib/auth-server';
import { LogoutButton } from './logout-button';

async function AuthActions() {
  const user = await getCurrentUser();
  const dashboardHref = user?.role === 'mentor' ? '/admin' : '/dashboard';

  return (
    <div className="flex items-center gap-3">
      <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/60 text-xs text-zinc-400">
        <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>Python & C++ Ready</span>
      </div>
      {user ? (
        <>
          <span className="hidden text-sm text-zinc-300 sm:inline">{user.name}</span>
          <Link
            href={dashboardHref}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Dashboard
          </Link>
          <LogoutButton
            redirectTo={user.role === 'mentor' ? '/admin/login' : '/login'}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-60"
          />
        </>
      ) : (
        <>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Sign up
          </Link>
        </>
      )}
    </div>
  );
}

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <span className="font-mono text-sm">&lt;/&gt;</span>
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-zinc-100 group-hover:text-white transition-colors">
                CodeArena <span className="text-indigo-400 font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 ml-1">2.0</span>
              </span>
              <span className="text-[10px] text-zinc-400 tracking-wide font-medium">Competitive Programming</span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
            <Link
              href="/problems"
              className="px-3 py-1.5 rounded-md text-sm font-medium text-zinc-200 hover:text-white hover:bg-zinc-850/80 transition-colors"
            >
              Problems
            </Link>
            <div className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-zinc-500 cursor-not-allowed">
              <span>Code Editor</span>
              <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-800/80 border border-zinc-700/60 px-1.5 py-0.2 rounded">
                Phase 2
              </span>
            </div>
            <Link
              href="/arena"
              className="px-3 py-1.5 rounded-md text-sm font-medium text-zinc-200 hover:text-white hover:bg-zinc-850/80 transition-colors"
            >
              Arena
            </Link>
          </nav>
        </div>
        <Suspense fallback={<div className="h-9 w-28 animate-pulse rounded-lg bg-zinc-800" aria-hidden="true" />}>
          <AuthActions />
        </Suspense>
      </div>
    </header>
  );
}
