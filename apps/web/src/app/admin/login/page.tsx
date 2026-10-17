import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '../../../components/auth-form';
import { getCurrentUser } from '../../../lib/auth-server';

export default async function MentorLoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'mentor' ? '/admin' : '/dashboard');

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl shadow-black/20 sm:p-8">
        <Link href="/" className="text-sm font-medium text-indigo-300 hover:text-indigo-200">
          ← CodeArena
        </Link>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-white">Mentor log in</h1>
        <p className="mt-2 mb-6 text-sm text-zinc-400">Sign in to your mentor account.</p>
        <AuthForm mode="login" audience="mentor" />
      </section>
    </main>
  );
}
