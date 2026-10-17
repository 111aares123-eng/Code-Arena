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

export async function requireUserRole(role: AuthUser['role']): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect(role === 'mentor' ? '/admin/login' : '/login');
  if (user.role !== role) redirect(user.role === 'mentor' ? '/admin' : '/dashboard');
  return user;
}
