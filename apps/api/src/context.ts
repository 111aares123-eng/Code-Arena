import { getDb, sessions, eq } from '@code-arena/db';

/**
 * tRPC context — populated per-request.
 * Contains the session ID and user ID parsed from the incoming cookie,
 * plus the response headers object so auth routes can set Set-Cookie.
 */
export type Context = {
  sessionId: string | null;
  userId: string | null;
  resHeaders: Headers;
};

/**
 * Build the tRPC context from the raw Hono request.
 * Reads the `session` cookie, validates it against the DB, and
 * attaches the userId if the session is valid and not expired.
 */
export async function createContext(req: Request): Promise<Context> {
  const resHeaders = new Headers();
  const cookieHeader = req.headers.get('cookie') ?? '';

  // Parse the session cookie
  const sessionId =
    cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('session='))
      ?.split('=')[1]
      ?.trim() ?? null;

  if (!sessionId) {
    return { sessionId: null, userId: null, resHeaders };
  }

  // Validate session in the DB
  const db = getDb();
  const [session] = await db
    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session || session.expiresAt < new Date()) {
    return { sessionId, userId: null, resHeaders };
  }

  return { sessionId, userId: session.userId, resHeaders };
}
