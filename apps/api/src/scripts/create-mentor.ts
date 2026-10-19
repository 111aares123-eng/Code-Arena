import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb, users } from '@code-arena/db';

const BCRYPT_COST = 12;

const mentorInputSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(30).regex(/^[a-z0-9_]+$/),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8),
});

async function createMentor() {
  const input = mentorInputSchema.safeParse({
    username: process.env.MENTOR_USERNAME,
    name: process.env.MENTOR_NAME,
    email: process.env.MENTOR_EMAIL,
    password: process.env.MENTOR_PASSWORD,
  });

  if (!input.success) {
    throw new Error('Set valid MENTOR_USERNAME, MENTOR_NAME, MENTOR_EMAIL, and MENTOR_PASSWORD values in the root .env file.');
  }

  const passwordHash = await bcrypt.hash(input.data.password, BCRYPT_COST);
  const userId = `usr_${randomUUID()}`;

  try {
    await getDb().insert(users).values({
      id: userId,
      username: input.data.username,
      displayName: input.data.name,
      email: input.data.email,
      passwordHash,
      role: 'INSTRUCTOR',
    });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === '23505') {
      throw new Error('A user with this username or email already exists; no account was changed.');
    }
    throw error;
  }

  console.log(`Mentor account created for ${input.data.email}.`);
}

createMentor().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
