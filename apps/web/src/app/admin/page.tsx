import { Suspense } from 'react';
import { requireUserRole } from '../../lib/auth-server';
import { DashboardShell } from '../../components/dashboard-shell';

async function AdminDashboardContent() {
  const user = await requireUserRole('INSTRUCTOR');

  return (
    <DashboardShell
      user={user}
      kicker="MENTOR CONSOLE"
      heading="Welcome back"
      redirectTo="/admin/login"
      tone="mentor"
      sections={[
        { title: 'My students', description: 'Your student roster and connections will appear here.' },
        { title: 'My contests', description: 'Contests you create or participate in will appear here.' },
      ]}
    />
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<main className="flex-1 px-4 py-10 sm:px-6 lg:px-8" />}>
      <AdminDashboardContent />
    </Suspense>
  );
}
