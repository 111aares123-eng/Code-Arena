import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '../../components/auth-form';
import { getCurrentUser } from '../../lib/auth-server';

async function RegisterPageContent() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'mentor' ? '/admin' : '/dashboard');

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl shadow-black/20 sm:p-8">
        <Link href="/" className="text-sm font-medium text-indigo-300 hover:text-indigo-200">
          ← CodeArena
        </Link>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-white">Create a learner account</h1>
        <p className="mt-2 mb-6 text-sm text-zinc-400">Start practicing with CodeArena.</p>
        <AuthForm mode="register" audience="learner" />
      </section>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="flex flex-1 items-center justify-center px-4 py-12" />}>
      <RegisterPageContent />
    </Suspense>
  );
}
