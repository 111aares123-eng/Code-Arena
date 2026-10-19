import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getDb, users, sessions, eq, type DatabaseInstance, type UserSelect } from '@code-arena/db';
import { protectedProcedure, publicProcedure, router } from '../trpc';

const BCRYPT_COST = 12;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const secureCookieAttribute = process.env.NODE_ENV === 'production' ? '; Secure' : '';
const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters.')
  .max(30, 'Username must be no more than 30 characters.')
  .regex(/^[a-z0-9_]+$/, 'Username may contain only letters, numbers, and underscores.');

const accountSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().trim().min(2).max(100).optional(),
});

const registerSchema = accountSchema;
const registerMentorSchema = accountSchema.extend({ inviteCode: z.string() });
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type AuthProfile = Pick<UserSelect, 'id' | 'username' | 'displayName' | 'email' | 'role' | 'avatarUrl' | 'createdAt'>;

function makeSessionCookie(sessionId: string): string {
  return `session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${secureCookieAttribute}`;
}

function clearSessionCookie(): string {
  return `session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureCookieAttribute}`;
}

function setCookie(ctx: { resHeaders?: Headers }, value: string) {
  if (!ctx.resHeaders) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Response headers are unavailable.' });
  }
  ctx.resHeaders.set('Set-Cookie', value);
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

function uniqueViolationDetails(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  const databaseError = error as Error & {
    code?: string;
    constraint?: string;
    constraint_name?: string;
    detail?: string;
  };
  if (databaseError.code !== '23505') return null;
  return `${databaseError.constraint ?? ''} ${databaseError.constraint_name ?? ''} ${databaseError.detail ?? ''}`;
}

function accountConflict(error: unknown): TRPCError | null {
  const details = uniqueViolationDetails(error);
  if (!details) return null;
  if (/username/i.test(details)) {
    return new TRPCError({ code: 'CONFLICT', message: 'That username is already taken.' });
  }
  if (/email/i.test(details)) {
    return new TRPCError({ code: 'CONFLICT', message: 'An account with this email already exists.' });
  }
  return new TRPCError({ code: 'CONFLICT', message: 'An account with that username or email already exists.' });
}

function profileFromRow(user: UserSelect): AuthProfile {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

async function createAccountAndSession(
  db: DatabaseInstance,
  ctx: { resHeaders?: Headers },
  input: z.infer<typeof accountSchema>,
  role: 'STUDENT' | 'INSTRUCTOR'
) {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  const userId = `usr_${randomUUID()}`;
  let user: UserSelect;

  try {
    [user] = await db
      .insert(users)
      .values({
        id: userId,
        username: input.username,
        email: input.email,
        passwordHash,
        displayName: input.displayName,
        role,
      })
      .returning();
  } catch (error) {
    const conflict = accountConflict(error);
    if (conflict) throw conflict;
    throw error;
  }

  const sessionId = `ses_${randomBytes(32).toString('base64url')}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: sessionId, userId: user.id, expiresAt });
  setCookie(ctx, makeSessionCookie(sessionId));
  return { user: profileFromRow(user) };
}

export function createAuthRouter(dbProvider: () => DatabaseInstance = getDb) {
  return router({
    register: publicProcedure.input(registerSchema).mutation(async ({ input, ctx }) =>
      createAccountAndSession(dbProvider(), ctx, input, 'STUDENT')
    ),

    registerMentor: publicProcedure.input(registerMentorSchema).mutation(async ({ input, ctx }) => {
      verifyMentorInviteCode(input.inviteCode);
      const { inviteCode: _inviteCode, ...accountInput } = input;
      return createAccountAndSession(dbProvider(), ctx, accountInput, 'INSTRUCTOR');
    }),

    login: publicProcedure.input(loginSchema).mutation(async ({ input, ctx }) => {
      const db = dbProvider();
      const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
      }

      const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
      if (!passwordMatch) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
      }

      const sessionId = `ses_${randomBytes(32).toString('base64url')}`;
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await db.insert(sessions).values({ id: sessionId, userId: user.id, expiresAt });
      setCookie(ctx, makeSessionCookie(sessionId));
      return { user: profileFromRow(user) };
    }),

    logout: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.resHeaders) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Response headers are unavailable.' });
      }
      if (ctx.sessionId) {
        await dbProvider().delete(sessions).where(eq(sessions.id, ctx.sessionId));
      }
      setCookie(ctx, clearSessionCookie());
      return { success: true };
    }),

    me: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.userId) return null;
      const [user] = await dbProvider()
        .select()
        .from(users)
        .where(eq(users.id, ctx.userId))
        .limit(1);
      return user ? profileFromRow(user) : null;
    }),
  });
}

export const authRouter = createAuthRouter();
