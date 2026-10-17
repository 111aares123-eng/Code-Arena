import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '../../components/auth-form';
import { AuthPageLayout } from '../../components/auth-page-layout';
import { getCurrentUser } from '../../lib/auth-server';

async function RegisterPageContent() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'mentor' ? '/admin' : '/dashboard');

  return (
    <AuthPageLayout
      kicker="JOIN THE ARENA"
      heading="Make room for"
      accent="what's next"
      description="Create a learner account to explore CodeArena. Learner and mentor workspaces are still being built."
      benefits={['A learner account, no role selection', 'Start with your own profile', 'More dashboard areas are coming soon']}
    >
      <Link href="/" className="text-sm font-semibold text-indigo-300 transition-colors hover:text-indigo-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-300 motion-reduce:transition-none">
        ← CodeArena home
      </Link>
      <p className="mt-7 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200/80">Create account</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">Join CodeArena</h2>
      <p className="mb-6 mt-2 text-sm leading-6 text-zinc-400">Set up your learner profile in a few steps.</p>
        <AuthForm mode="register" audience="learner" />
    </AuthPageLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="flex flex-1 items-center justify-center px-4 py-12" />}>
      <RegisterPageContent />
    </Suspense>
  );
}
