import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '../../components/auth-form';
import { AuthPageLayout } from '../../components/auth-page-layout';
import { getCurrentUser } from '../../lib/auth-server';

async function LoginPageContent() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'STUDENT' ? '/dashboard' : '/admin');

  return (
    <AuthPageLayout
      kicker="LEARNER LOGIN"
      heading="Step back into"
      accent="the arena"
      description="Sign in to your learner account and continue exploring the CodeArena problem library."
      benefits={['One account for learner access', 'Practice at your own pace', 'Your dashboard is ready to grow']}
    >
      <Link href="/" className="text-sm font-semibold text-indigo-300 transition-colors hover:text-indigo-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-300 motion-reduce:transition-none">
        ← CodeArena home
      </Link>
      <p className="mt-7 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200/80">Welcome back</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">Log in to your account</h2>
      <p className="mb-6 mt-2 text-sm leading-6 text-zinc-400">Use your learner account credentials to continue.</p>
        <AuthForm mode="login" audience="learner" />
    </AuthPageLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex flex-1 items-center justify-center px-4 py-12" />}>
      <LoginPageContent />
    </Suspense>
  );
}
