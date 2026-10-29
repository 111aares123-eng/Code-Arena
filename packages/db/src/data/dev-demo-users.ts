import { getDb, type DatabaseInstance } from '../client';
import { users } from '../schema/users';

/**
 * Development-only demo student accounts.
 *
 * CRITICAL CONSTRAINT:
 * These accounts are NEVER seeded into production databases.
 * They are only available via an explicit development/test seed function.
 */
export const DEV_DEMO_STUDENTS = [
  {
    id: 'usr_dev_demo_1',
    username: 'bitwise.bee',
    email: 'bitwise.bee@dev.local',
    displayName: 'Bitwise Bee',
    role: 'STUDENT' as const,
    xp: 460,
    rating: 1350,
  },
  {
    id: 'usr_dev_demo_2',
    username: 'stacktrace',
    email: 'stacktrace@dev.local',
    displayName: 'Stack Trace',
    role: 'STUDENT' as const,
    xp: 410,
    rating: 1280,
  },
  {
    id: 'usr_dev_demo_3',
    username: 'nullnvoid',
    email: 'nullnvoid@dev.local',
    displayName: 'Null & Void',
    role: 'STUDENT' as const,
    xp: 340,
    rating: 1210,
  },
];

/**
 * Explicit development-only seed function.
 * Must only be called in development or hermetic test environments.
 */
export async function seedDevDemoStudents(dbInstance?: DatabaseInstance) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo users into production database.');
  }

  const db = dbInstance || getDb();
  let count = 0;

  for (const student of DEV_DEMO_STUDENTS) {
    await db
      .insert(users)
      .values({
        id: student.id,
        username: student.username,
        email: student.email,
        displayName: student.displayName,
        role: student.role,
        xp: student.xp,
        rating: student.rating,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          username: student.username,
          displayName: student.displayName,
          xp: student.xp,
          rating: student.rating,
          updatedAt: new Date(),
        },
      });

    count++;
  }

  return count;
}
