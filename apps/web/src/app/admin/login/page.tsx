import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '../../../components/auth-form';
import { AuthPageLayout } from '../../../components/auth-page-layout';
import { getCurrentUser } from '../../../lib/auth-server';

async function MentorLoginPageContent() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'mentor' ? '/admin' : '/dashboard');

  return (
    <AuthPageLayout
      kicker="MENTOR CONSOLE"
      heading="Guide the"
      accent="next move"
      description="Sign in to your mentor account. Mentor accounts are created by invitation from the institution."
      benefits={['A dedicated mentor sign-in', 'Use your institution-created account', 'Student and contest tools are coming soon']}
      tone="mentor"
    >
      <Link href="/" className="text-sm font-semibold text-violet-300 transition-colors hover:text-violet-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300 motion-reduce:transition-none">
        ← CodeArena home
      </Link>
      <p className="mt-7 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/80">Mentor access</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">Mentor log in</h2>
      <p className="mb-6 mt-2 text-sm leading-6 text-zinc-400">Sign in with the credentials provided by your institution.</p>
        <AuthForm mode="login" audience="mentor" />
    </AuthPageLayout>
  );
}

export default function MentorLoginPage() {
  return (
    <Suspense fallback={<main className="flex flex-1 items-center justify-center px-4 py-12" />}>
      <MentorLoginPageContent />
    </Suspense>
  );
}
