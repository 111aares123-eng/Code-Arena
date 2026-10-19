import { LogoutButton } from './logout-button';

type DashboardUser = {
  username: string;
  displayName: string | null;
  email: string;
  role: 'STUDENT' | 'ADMIN' | 'INSTRUCTOR';
};

type DashboardShellProps = {
  user: DashboardUser;
  kicker: string;
  heading: string;
  redirectTo: string;
  sections: { title: string; description: string }[];
  tone: 'learner' | 'mentor';
};

const toneStyles = {
  learner: {
    kicker: 'border-indigo-400/20 bg-indigo-400/10 text-indigo-200',
    dot: 'bg-indigo-300',
    avatar: 'border-indigo-300/20 bg-gradient-to-br from-indigo-500/25 to-violet-500/20 text-indigo-100',
    badge: 'border-indigo-400/20 bg-indigo-400/10 text-indigo-200',
    icon: 'border-indigo-400/20 bg-indigo-400/10 text-indigo-200',
    glow: 'from-indigo-500/[0.08]',
  },
  mentor: {
    kicker: 'border-violet-400/20 bg-violet-400/10 text-violet-200',
    dot: 'bg-violet-300',
    avatar: 'border-violet-300/20 bg-gradient-to-br from-violet-500/25 to-fuchsia-500/20 text-violet-100',
    badge: 'border-violet-400/20 bg-violet-400/10 text-violet-200',
    icon: 'border-violet-400/20 bg-violet-400/10 text-violet-200',
    glow: 'from-violet-500/[0.08]',
  },
} as const;

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

export function DashboardShell({
  user,
  kicker,
  heading,
  redirectTo,
  sections,
  tone,
}: DashboardShellProps) {
  const styles = toneStyles[tone];
  const displayName = user.displayName ?? user.username;

  return (
    <main className="relative flex-1 overflow-hidden px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b ${styles.glow} to-transparent`} aria-hidden="true" />
      <div className="relative mx-auto max-w-5xl">
        <header className="relative isolate mb-7 sm:mb-9">
          <div className="pointer-events-none absolute inset-x-0 -top-10 -z-10 h-48 overflow-hidden" aria-hidden="true">
            <div className={`ca-aurora absolute -left-12 -top-8 h-44 w-44 rounded-full blur-3xl ${tone === 'mentor' ? 'bg-violet-500/10' : 'bg-indigo-500/10'}`} />
            <div className={`ca-aurora absolute right-1/4 top-0 h-40 w-40 rounded-full blur-3xl ${tone === 'mentor' ? 'bg-fuchsia-500/5' : 'bg-violet-500/10'}`} />
            {tone === 'learner' && (
              <div className="ca-aurora absolute -right-8 top-4 h-36 w-36 rounded-full bg-pink-400/5 blur-3xl" />
            )}
          </div>
          <div className="relative">
          <div className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${styles.kicker}`}>
            <span className={`ca-status-ping h-1.5 w-1.5 rounded-full ${styles.dot}`} aria-hidden="true" />
            {kicker}
          </div>
          <h1 className="break-words text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
            {heading}, <span className="text-zinc-300">{displayName}</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
            Your CodeArena profile and workspace.
          </p>
          </div>
        </header>

        <section className="flex min-w-0 flex-col gap-5 rounded-3xl border border-white/[0.09] bg-gradient-to-br from-[#111827] via-zinc-900 to-zinc-950 p-5 shadow-xl shadow-black/20 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex min-w-0 items-center gap-4">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-lg font-bold ${styles.avatar}`} aria-hidden="true">
              {getInitials(displayName)}
            </div>
            <div className="min-w-0">
              <p className="break-words text-base font-semibold text-white">{displayName}</p>
              <p className="mt-0.5 text-xs font-medium text-indigo-200">@{user.username}</p>
              <p className="mt-1 break-all text-sm text-zinc-400">{user.email}</p>
              <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${styles.badge}`}>
                {user.role}
              </span>
            </div>
          </div>
          <LogoutButton
            redirectTo={redirectTo}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-zinc-700/80 bg-zinc-950/40 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </section>

        <section className={`mt-6 grid min-w-0 gap-4 ${sections.length === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'}`} aria-label="Coming soon dashboard sections">
          {sections.map((section) => (
            <article key={section.title} className={`ca-tile-sweep group relative min-w-0 overflow-hidden rounded-3xl border border-dashed border-zinc-700/90 bg-[#111827]/75 p-5 sm:p-6 ${tone === 'mentor' ? 'ca-tile-sweep-mentor' : ''}`}>
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${styles.glow} to-transparent opacity-60`} aria-hidden="true" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Workspace</p>
                    <h2 className="mt-2 break-words text-lg font-semibold text-white">{section.title}</h2>
                  </div>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${styles.icon}`} aria-hidden="true">
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <rect x="4.5" y="8.5" width="11" height="8" rx="1.8" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 8.5V6a3 3 0 0 1 6 0v2.5M10 11.5v2" />
                    </svg>
                  </span>
                </div>
                <p className="mt-5 text-sm font-semibold text-zinc-200">Coming soon</p>
                <p className="mt-1.5 text-sm leading-6 text-zinc-400">{section.description}</p>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
