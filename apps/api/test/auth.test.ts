import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { sessions, users, type DatabaseInstance } from '@code-arena/db';
import { createAuthRouter } from '../src/routers/auth';

const originalInviteCode = process.env.MENTOR_INVITE_CODE;

afterEach(() => {
  if (originalInviteCode === undefined) delete process.env.MENTOR_INVITE_CODE;
  else process.env.MENTOR_INVITE_CODE = originalInviteCode;
});

function makeContext() {
  return { sessionId: null, userId: null, role: null, resHeaders: new Headers() };
}

function makeDb(options: { insertError?: Error; loginUser?: Record<string, unknown> } = {}) {
  let insertedUser: Record<string, unknown> | undefined;
  let insertedSession: Record<string, unknown> | undefined;
  let selectCalls = 0;
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => {
            selectCalls += 1;
            if (table === users && options.loginUser) return [options.loginUser];
            return table === users && insertedUser ? [insertedUser] : [];
          },
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        if (table === users) {
          if (options.insertError) throw options.insertError;
          insertedUser = {
            ...values,
            avatarUrl: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            xp: 0,
            rating: 1200,
          };
          return { returning: async () => [insertedUser] };
        }
        if (table === sessions) insertedSession = values;
        return Promise.resolve([]);
      },
    }),
    delete: () => ({ where: async () => [] }),
  };

  return {
    db: db as unknown as DatabaseInstance,
    get insertedUser() { return insertedUser; },
    get insertedSession() { return insertedSession; },
    get selectCalls() { return selectCalls; },
  };
}

const accountInput = {
  username: '  new_mentor  ',
  displayName: 'Mentor Name',
  email: ' Mentor@Example.com ',
  password: 'secure-password',
};
const inviteCode = 'runtime-generated-test-invite-code';
const context = () => makeContext();

test('registerMentor creates an instructor profile, session cookie, and auth.me profile', async () => {
  process.env.MENTOR_INVITE_CODE = inviteCode;
  const fake = makeDb();
  const ctx = context();
  const caller = createAuthRouter(() => fake.db).createCaller(ctx);

  const registered = await caller.registerMentor({ ...accountInput, inviteCode });
  assert.equal(registered.user.role, 'INSTRUCTOR');
  assert.equal(registered.user.username, 'new_mentor');
  assert.equal(registered.user.displayName, 'Mentor Name');
  assert.equal(fake.insertedUser?.role, 'INSTRUCTOR');
  assert.equal(fake.insertedUser?.email, 'mentor@example.com');
  assert.match(ctx.resHeaders.get('set-cookie') ?? '', /^session=ses_/);
  assert.ok(fake.insertedSession);

  const me = await createAuthRouter(() => fake.db).createCaller({
    ...context(),
    userId: registered.user.id,
    role: 'INSTRUCTOR',
  }).me();
  assert.equal(me?.role, 'INSTRUCTOR');
  assert.equal(me?.username, 'new_mentor');
});

test('registerMentor rejects a wrong code before database access', async () => {
  process.env.MENTOR_INVITE_CODE = inviteCode;
  const fake = makeDb();
  let providerCalls = 0;
  const caller = createAuthRouter(() => {
    providerCalls += 1;
    return fake.db;
  }).createCaller(context());

  await assert.rejects(
    caller.registerMentor({ ...accountInput, inviteCode: 'wrong-invite-code' }),
    { code: 'FORBIDDEN', message: 'Invalid invite code' }
  );
  assert.equal(providerCalls, 0);
  assert.equal(fake.selectCalls, 0);
});

test('registerMentor is disabled when the invite code is missing or too short', async () => {
  for (const configuredCode of [undefined, 'short-code']) {
    if (configuredCode === undefined) delete process.env.MENTOR_INVITE_CODE;
    else process.env.MENTOR_INVITE_CODE = configuredCode;
    const fake = makeDb();
    let providerCalls = 0;

    await assert.rejects(
      createAuthRouter(() => {
        providerCalls += 1;
        return fake.db;
      }).createCaller(context()).registerMentor({ ...accountInput, inviteCode })
    , { code: 'FORBIDDEN', message: 'Mentor signup is not enabled' });
    assert.equal(providerCalls, 0);
    assert.equal(fake.selectCalls, 0);
  }
});

test('duplicate username is reported from the unique constraint error', async () => {
  const duplicate = Object.assign(new Error('duplicate key'), {
    code: '23505',
    constraint_name: 'users_username_unique',
  });
  const fake = makeDb({ insertError: duplicate });
  await assert.rejects(
    createAuthRouter(() => fake.db).createCaller(context()).register(accountInput),
    { code: 'CONFLICT', message: 'That username is already taken.' }
  );
  assert.equal(fake.selectCalls, 0);
});

test('duplicate email keeps the existing registration conflict message', async () => {
  const duplicate = Object.assign(new Error('duplicate key'), {
    code: '23505',
    constraint_name: 'users_email_unique',
  });
  const fake = makeDb({ insertError: duplicate });
  await assert.rejects(
    createAuthRouter(() => fake.db).createCaller(context()).register(accountInput),
    { code: 'CONFLICT', message: 'An account with this email already exists.' }
  );
  assert.equal(fake.selectCalls, 0);
});

test('registration rejects usernames outside the normalized format', async () => {
  const fake = makeDb();
  const caller = createAuthRouter(() => fake.db).createCaller(context());
  await assert.rejects(caller.register({ ...accountInput, username: 'bad-name' }));
  await assert.rejects(caller.register({ ...accountInput, username: 'ab' }));
  await assert.rejects(caller.register({ ...accountInput, username: 'a'.repeat(31) }));
  assert.equal(fake.insertedUser, undefined);
});

test('login rejects null password hashes with the generic credential error', async () => {
  const fake = makeDb({
    loginUser: {
      id: 'legacy-user',
      username: 'legacy_user',
      displayName: null,
      email: 'legacy@example.com',
      role: 'STUDENT',
      passwordHash: null,
      avatarUrl: null,
      createdAt: new Date(),
    },
  });
  await assert.rejects(
    createAuthRouter(() => fake.db).createCaller(context()).login({
      email: 'legacy@example.com',
      password: 'password',
    }),
    { code: 'UNAUTHORIZED', message: 'Invalid email or password' }
  );
});

test('learner registration ignores an extra role field', async () => {
  const fake = makeDb();
  const caller = createAuthRouter(() => fake.db).createCaller(context());
  const registered = await caller.register({
    ...accountInput,
    role: 'INSTRUCTOR',
  } as typeof accountInput);

  assert.equal(registered.user.role, 'STUDENT');
  assert.equal(fake.insertedUser?.role, 'STUDENT');
  assert.ok(fake.insertedSession);
});
