import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getDb, users, sessions, eq, type DatabaseInstance } from '@code-arena/db';
import { protectedProcedure, publicProcedure, router } from '../trpc';

// ─── Input Schemas ────────────────────────────────────────────────────────────

const accountSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const registerSchema = accountSchema;
const registerMentorSchema = accountSchema.extend({
  inviteCode: z.string(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ─── Session helpers ──────────────────────────────────────────────────────────

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const secureCookieAttribute = process.env.NODE_ENV === 'production' ? '; Secure' : '';

function makeSessionCookie(sessionId: string): string {
  return `session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${secureCookieAttribute}`;
}

function clearSessionCookie(): string {
  return `session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureCookieAttribute}`;
}

function verifyMentorInviteCode(inviteCode: string): void {
  const configuredCode = process.env.MENTOR_INVITE_CODE;
  if (!configuredCode || configuredCode.length < 16) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Mentor signup is not enabled' });
  }

  const providedDigest = createHash('sha256').update(inviteCode).digest();
  const configuredDigest = createHash('sha256').update(configuredCode).digest();
  if (!timingSafeEqual(providedDigest, configuredDigest)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Invalid invite code' });
  }
}

async function createAccountAndSession(
  db: DatabaseInstance,
  ctx: { resHeaders: Headers },
  input: z.infer<typeof accountSchema>,
  role: 'learner' | 'mentor'
) {
  const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (existing.length > 0) {
    throw new TRPCError({ code: 'CONFLICT', message: 'An account with this email already exists.' });
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const userId = `usr_${randomUUID()}`;
  const [user] = await db
    .insert(users)
    .values({
      id: userId,
      name: input.name,
      email: input.email,
      passwordHash,
      role,
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    });

  const sessionId = `ses_${randomBytes(32).toString('base64url')}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: sessionId, userId: user.id, expiresAt });
  ctx.resHeaders.set('Set-Cookie', makeSessionCookie(sessionId));

  return { user };
}

// ─── Auth Router ──────────────────────────────────────────────────────────────

export function createAuthRouter(dbProvider: () => DatabaseInstance = getDb) {
  return router({
    /**
     * POST /trpc/auth.register
     * Create a new learner account.
     */
    register: publicProcedure.input(registerSchema).mutation(async ({ input, ctx }) =>
      createAccountAndSession(dbProvider(), ctx, input, 'learner')
    ),

    /**
     * POST /trpc/auth.registerMentor
     * Create a mentor account after validating its invite code.
     */
    registerMentor: publicProcedure.input(registerMentorSchema).mutation(async ({ input, ctx }) => {
      verifyMentorInviteCode(input.inviteCode);
      const { inviteCode: _inviteCode, ...accountInput } = input;
      return createAccountAndSession(dbProvider(), ctx, accountInput, 'mentor');
    }),

    /**
     * POST /trpc/auth.login
     * Verify credentials and issue a session cookie.
     */
    login: publicProcedure.input(loginSchema).mutation(async ({ input, ctx }) => {
      const db = dbProvider();

      const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);

      if (!user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password.' });
      }

      const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
      if (!passwordMatch) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password.' });
      }

      // Create new session
      const sessionId = `ses_${randomBytes(32).toString('base64url')}`;
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await db.insert(sessions).values({ id: sessionId, userId: user.id, expiresAt });

      ctx.resHeaders.set('Set-Cookie', makeSessionCookie(sessionId));

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      };
    }),

    /**
     * POST /trpc/auth.logout
     * Delete the current session and clear the cookie.
     */
    logout: protectedProcedure.mutation(async ({ ctx }) => {
      const db = dbProvider();
      const sessionId = ctx.sessionId;
      if (sessionId) {
        await db.delete(sessions).where(eq(sessions.id, sessionId));
      }
      ctx.resHeaders.set('Set-Cookie', clearSessionCookie());
      return { success: true };
    }),

    /**
     * GET /trpc/auth.me
     * Return the currently logged-in user's profile, or null if not logged in.
     */
    me: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.userId) return null;
      const db = dbProvider();
      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          avatarUrl: users.avatarUrl,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, ctx.userId))
        .limit(1);

      return user ?? null;
    }),
  });
}

export const authRouter = createAuthRouter();
