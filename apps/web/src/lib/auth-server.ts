import { cookies } from 'next/headers';
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
