import { neon } from '@neondatabase/serverless';

let cachedSql = null;

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Add it in your environment variables.');
  }
  if (!cachedSql) {
    cachedSql = neon(process.env.DATABASE_URL);
  }
  return cachedSql;
}
