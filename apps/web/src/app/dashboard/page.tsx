import { Suspense } from 'react';
import { requireUserRole } from '../../lib/auth-server';
import { LogoutButton } from '../../components/logout-button';

async function DashboardContent() {
  const user = await requireUserRole('learner');

  return (
    <main className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8">
          <p className="text-sm font-medium text-indigo-300">Learner dashboard</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Welcome, {user.name}</h1>
          <p className="mt-2 text-sm text-zinc-400">{user.email}</p>
          <p className="mt-1 text-xs capitalize text-zinc-500">Role: {user.role}</p>
          <LogoutButton redirectTo="/login" className="mt-5 rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-60" />
        </section>
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {['Problems solved', 'Contests joined', 'My mentor'].map((title) => (
            <article key={title} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <h2 className="text-base font-semibold text-white">{title}</h2>
              <p className="mt-3 text-sm text-zinc-400">Coming soon</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="flex-1 px-4 py-10 sm:px-6 lg:px-8" />}>
      <DashboardContent />
    </Suspense>
  );
}
