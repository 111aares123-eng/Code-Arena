import type { ReactNode } from 'react';

type AuthPageLayoutProps = {
  kicker: string;
  heading: string;
  accent: string;
  description: string;
  benefits: string[];
  tone?: 'learner' | 'mentor';
  children: ReactNode;
};

const toneStyles = {
  learner: {
    pill: 'border-indigo-400/20 bg-indigo-400/10 text-indigo-200',
    dot: 'bg-indigo-300',
    accent: 'from-indigo-400 via-purple-300 to-pink-400',
    icon: 'border-indigo-300/20 bg-indigo-300/10 text-indigo-200',
    buttonGlow: 'shadow-indigo-600/25',
    focus: 'focus:border-indigo-400 focus:ring-indigo-500/30',
    link: 'text-indigo-300 hover:text-indigo-200',
  },
  mentor: {
    pill: 'border-violet-400/20 bg-violet-400/10 text-violet-200',
    dot: 'bg-violet-300',
    accent: 'from-violet-300 via-fuchsia-300 to-indigo-300',
    icon: 'border-violet-300/20 bg-violet-300/10 text-violet-200',
    buttonGlow: 'shadow-violet-600/25',
    focus: 'focus:border-violet-400 focus:ring-violet-500/30',
    link: 'text-violet-300 hover:text-violet-200',
  },
} as const;

export function AuthPageLayout({
  kicker,
  heading,
  accent,
  description,
  benefits,
  tone = 'learner',
  children,
}: AuthPageLayoutProps) {
  const styles = toneStyles[tone];

  return (
    <main className="relative flex flex-1 items-center overflow-hidden px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.14),transparent_42%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.1),transparent_40%)]" aria-hidden="true" />
      <div className="relative mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 items-center gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <section className="min-w-0 py-2 sm:py-6">
          <div className={`mb-5 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${styles.pill}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} aria-hidden="true" />
            {kicker}
          </div>
          <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl xl:text-6xl">
            {heading}{' '}
            <span className={`bg-gradient-to-r ${styles.accent} bg-clip-text text-transparent`}>
              {accent}
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-300 sm:text-base">{description}</p>

          <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex min-w-0 items-center gap-3 text-sm text-zinc-300">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${styles.icon}`} aria-hidden="true">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m5 10 3.2 3.2L15 6.5" />
                  </svg>
                </span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="relative min-w-0 overflow-hidden rounded-3xl border border-white/[0.1] bg-gradient-to-br from-[#111827] via-zinc-900 to-zinc-950 p-5 shadow-2xl shadow-black/30 sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden="true">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-violet-500/10 blur-3xl" />
          </div>
          <div className="relative min-w-0">{children}</div>
        </section>
      </div>
    </main>
  );
}
