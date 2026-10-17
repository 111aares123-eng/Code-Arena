import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { eq, getDb, users } from '@code-arena/db';

const BCRYPT_COST = 12;

const mentorInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8),
});

async function createMentor() {
  const input = mentorInputSchema.safeParse({
    name: process.env.MENTOR_NAME,
    email: process.env.MENTOR_EMAIL,
    password: process.env.MENTOR_PASSWORD,
  });

  if (!input.success) {
    throw new Error('Set valid MENTOR_NAME, MENTOR_EMAIL, and MENTOR_PASSWORD values in the root .env file.');
  }

  const db = getDb();
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.data.email))
    .limit(1);

  if (existingUser) {
    throw new Error(`A user with email "${input.data.email}" already exists; no account was changed.`);
  }

  const passwordHash = await bcrypt.hash(input.data.password, BCRYPT_COST);
  const userId = `usr_${randomUUID()}`;

  await db.insert(users).values({
    id: userId,
    name: input.data.name,
    email: input.data.email,
    passwordHash,
    role: 'mentor',
  });

  console.log(`Mentor account created for ${input.data.email}.`);
}

createMentor().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
