import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { me, type AuthUser } from './auth';

export async function getCurrentUser(): Promise<AuthUser | null> {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie) return null;

  try {
    return await me(`session=${sessionCookie.value}`);
  } catch {
    return null;
  }
}

export async function requireUserRole(role: 'STUDENT' | 'INSTRUCTOR'): Promise<AuthUser> {
  const user = await getCurrentUser();
  const userIsMentor = user?.role === 'INSTRUCTOR' || user?.role === 'ADMIN';
  if (!user) redirect(role === 'INSTRUCTOR' ? '/admin/login' : '/login');
  if (role === 'STUDENT' ? user.role !== 'STUDENT' : !userIsMentor) {
    redirect(userIsMentor ? '/admin' : '/dashboard');
  }
  return user;
}
