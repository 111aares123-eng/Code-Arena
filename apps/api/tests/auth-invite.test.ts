import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { sessions, users, type DatabaseInstance } from '@code-arena/db';
import { createAuthRouter } from '../src/routers/auth';

const originalInviteCode = process.env.MENTOR_INVITE_CODE;

afterEach(() => {
  if (originalInviteCode === undefined) {
    delete process.env.MENTOR_INVITE_CODE;
  } else {
    process.env.MENTOR_INVITE_CODE = originalInviteCode;
  }
});

function makeContext(userId: string | null = null) {
  return {
    sessionId: null,
    userId,
    role: userId ? ('mentor' as const) : null,
    resHeaders: new Headers(),
  };
}

function makeDb(selectResults: unknown[] = []) {
  let selectCalls = 0;
  let insertedUser: Record<string, unknown> | undefined;
  let insertedSession: Record<string, unknown> | undefined;
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => {
            selectCalls += 1;
            if (selectResults.length > 0) return selectResults.shift();
            return table === users && insertedUser ? [insertedUser] : [];
          },
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        if (table === users) {
          insertedUser = values;
          return {
            returning: async () => [{ ...values }],
          };
        }
        if (table === sessions) insertedSession = values;
        return Promise.resolve([]);
      },
    }),
    delete: () => ({ where: async () => [] }),
  };

  return {
    db: db as unknown as DatabaseInstance,
    get selectCalls() {
      return selectCalls;
    },
    get insertedUser() {
      return insertedUser;
    },
    get insertedSession() {
      return insertedSession;
    },
  };
}

const mentorInput = {
  name: 'Mentor Name',
  email: 'mentor@example.com',
  password: 'secure-password',
  inviteCode: 'runtime-generated-test-invite-code',
};

test('registerMentor creates mentor, sets login cookie, and auth.me returns mentor role', async () => {
  process.env.MENTOR_INVITE_CODE = mentorInput.inviteCode;
  const mentorRow = {
    id: 'usr_test',
    name: mentorInput.name,
    email: mentorInput.email,
    role: 'mentor',
    avatarUrl: null,
    createdAt: new Date(),
  };
  const fake = makeDb([[], [mentorRow]]);
  const context = makeContext();
  const caller = createAuthRouter(() => fake.db).createCaller(context);

  const registered = await caller.registerMentor(mentorInput);
  assert.equal(registered.user.role, 'mentor');
  assert.equal(fake.insertedUser?.role, 'mentor');
  assert.match(context.resHeaders.get('set-cookie') ?? '', /^session=ses_/);
  assert.ok(fake.insertedSession);

  const me = await createAuthRouter(() => fake.db)
    .createCaller(makeContext(registered.user.id))
    .me();
  assert.equal(me?.role, 'mentor');
});

test('registerMentor rejects a wrong code before database access', async () => {
  process.env.MENTOR_INVITE_CODE = mentorInput.inviteCode;
  const fake = makeDb();
  let dbProviderCalls = 0;
  const caller = createAuthRouter(() => {
    dbProviderCalls += 1;
    return fake.db;
  }).createCaller(makeContext());

  await assert.rejects(
    caller.registerMentor({ ...mentorInput, inviteCode: 'wrong-invite-code' }),
    { code: 'FORBIDDEN', message: 'Invalid invite code' }
  );
  assert.equal(dbProviderCalls, 0);
  assert.equal(fake.selectCalls, 0);
});

test('registerMentor is disabled when the invite code is unset', async () => {
  delete process.env.MENTOR_INVITE_CODE;
  const fake = makeDb();
  let dbProviderCalls = 0;

  await assert.rejects(
    createAuthRouter(() => {
      dbProviderCalls += 1;
      return fake.db;
    }).createCaller(makeContext()).registerMentor(mentorInput),
    { code: 'FORBIDDEN', message: 'Mentor signup is not enabled' }
  );
  assert.equal(dbProviderCalls, 0);
  assert.equal(fake.selectCalls, 0);
});

test('registerMentor is disabled when the invite code is shorter than 16 characters', async () => {
  process.env.MENTOR_INVITE_CODE = 'short-code';
  const fake = makeDb();
  let dbProviderCalls = 0;

  await assert.rejects(
    createAuthRouter(() => {
      dbProviderCalls += 1;
      return fake.db;
    }).createCaller(makeContext()).registerMentor(mentorInput),
    { code: 'FORBIDDEN', message: 'Mentor signup is not enabled' }
  );
  assert.equal(dbProviderCalls, 0);
  assert.equal(fake.selectCalls, 0);
});

test('registerMentor uses the learner registration duplicate-email error', async () => {
  process.env.MENTOR_INVITE_CODE = mentorInput.inviteCode;
  const fake = makeDb([[{ id: 'usr_existing' }]]);

  await assert.rejects(
    createAuthRouter(() => fake.db).createCaller(makeContext()).registerMentor(mentorInput),
    { code: 'CONFLICT', message: 'An account with this email already exists.' }
  );
  assert.equal(fake.selectCalls, 1);
  assert.equal(fake.insertedUser, undefined);
});

test('auth.register remains learner-only when the request includes role mentor', async () => {
  const fake = makeDb([[]]);
  const caller = createAuthRouter(() => fake.db).createCaller(makeContext());

  const registered = await caller.register({
    name: 'Learner Name',
    email: 'learner@example.com',
    password: 'secure-password',
    role: 'mentor',
  } as { name: string; email: string; password: string });

  assert.equal(registered.user.role, 'learner');
  assert.equal(fake.insertedUser?.role, 'learner');
  assert.ok(fake.insertedSession);
});
