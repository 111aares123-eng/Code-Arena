import { Suspense } from 'react';
import { requireUserRole } from '../../lib/auth-server';
import { DashboardShell } from '../../components/dashboard-shell';

async function DashboardContent() {
  const user = await requireUserRole('learner');

  return (
    <DashboardShell
      user={user}
      kicker="LEARNER HUB"
      heading="Welcome back"
      redirectTo="/login"
      tone="learner"
      sections={[
        { title: 'Problems solved', description: 'A record of the problems you complete will appear here.' },
        { title: 'Contests joined', description: 'Your contest participation will be collected here.' },
        { title: 'My mentor', description: 'Details about your mentor connection will appear here.' },
      ]}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="flex-1 px-4 py-10 sm:px-6 lg:px-8" />}>
      <DashboardContent />
    </Suspense>
  );
}
