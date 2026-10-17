import { requireUserRole } from '../../lib/auth-server';

export default async function AdminDashboardPage() {
  const user = await requireUserRole('mentor');

  return (
    <main className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8">
          <p className="text-sm font-medium text-indigo-300">Mentor dashboard</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Welcome, {user.name}</h1>
          <p className="mt-2 text-sm text-zinc-400">{user.email}</p>
          <p className="mt-1 text-xs capitalize text-zinc-500">Role: {user.role}</p>
        </section>
      </div>
    </main>
  );
}
