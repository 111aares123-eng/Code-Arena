import type { TestCaseStore } from './services/test-case-store';
import { getDb, sessions, users, eq } from '@code-arena/db';
import type { UserSelect } from '@code-arena/db';

export interface ApiContext {
  [key: string]: unknown;
  authorization?: string | null;
  testCaseStore?: TestCaseStore;
  sessionId?: string | null;
  userId?: string | null;
  role?: UserSelect['role'] | null;
  resHeaders?: Headers;
}

export type Context = ApiContext;

export async function createApiContext(req: Request, resHeaders: Headers = new Headers()): Promise<ApiContext> {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const sessionId =
    cookieHeader
      .split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith('session='))
      ?.slice('session='.length)
      .trim() || null;

  if (!sessionId) {
    return { authorization: req.headers.get('authorization'), sessionId: null, userId: null, role: null, resHeaders };
  }

  const db = getDb();
  const [session] = await db
    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session || session.expiresAt < new Date()) {
    return { authorization: req.headers.get('authorization'), sessionId, userId: null, role: null, resHeaders };
  }

  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) {
    return { authorization: req.headers.get('authorization'), sessionId, userId: null, role: null, resHeaders };
  }

  return {
    authorization: req.headers.get('authorization'),
    sessionId,
    userId: session.userId,
    role: user.role,
    resHeaders,
  };
}
