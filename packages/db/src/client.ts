import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';

// Ensure environment variables are loaded
if (!process.env.DATABASE_URL) {
  dotenv.config();
  if (!process.env.DATABASE_URL) {
    dotenv.config({ path: resolve(process.cwd(), 'packages/db/.env') });
    if (!process.env.DATABASE_URL) {
      dotenv.config({ path: resolve(process.cwd(), '../../packages/db/.env') });
    }
  }
}

export type DatabaseInstance = ReturnType<typeof drizzle<typeof schema>>;

let cachedClient: postgres.Sql | null = null;
let cachedDb: DatabaseInstance | null = null;

/**
 * Creates a new Drizzle ORM client instance with the given connection string.
 */
export function createDbClient(connectionString?: string): DatabaseInstance {
  const url = connectionString || process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Please provide a connection string or configure DATABASE_URL in your environment.'
    );
  }

  const queryClient = postgres(url, {
    max: Number(process.env.DATABASE_MAX_CONNECTIONS) || 10,
    idle_timeout: Number(process.env.DATABASE_IDLE_TIMEOUT) || 20,
    connect_timeout: Number(process.env.DATABASE_CONNECT_TIMEOUT) || 10,
  });

  return drizzle(queryClient, { schema });
}

/**
 * Returns a singleton Drizzle ORM client instance.
 */
export function getDb(): DatabaseInstance {
  if (!cachedDb) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        'DATABASE_URL is not set. Please provide a connection string or configure DATABASE_URL in your environment.'
      );
    }

    cachedClient = postgres(url, {
      max: Number(process.env.DATABASE_MAX_CONNECTIONS) || 10,
      idle_timeout: Number(process.env.DATABASE_IDLE_TIMEOUT) || 20,
      connect_timeout: Number(process.env.DATABASE_CONNECT_TIMEOUT) || 10,
    });

    cachedDb = drizzle(cachedClient, { schema });
  }

  return cachedDb;
}
