/**
 * Prisma client singleton.
 *
 * SERVER ONLY. This module must never be imported into a client component —
 * it holds a database connection and the connection string. Importing it in
 * the browser bundle would be a security failure, not just a build error.
 *
 * WHY THE ADAPTER
 * Prisma 7 connects through a driver adapter rather than a bundled Rust query
 * engine. For PostgreSQL that is `PrismaPg`, backed by the `pg` driver.
 *
 * WHY DATABASE_URL AND NOT DIRECT_URL
 * The application uses the transaction pooler (port 6543, ?pgbouncer=true).
 * Serverless functions open and close connections constantly, and Postgres
 * has a hard connection limit that a pooler exists to absorb. The direct
 * connection (port 5432) is reserved for migrations — see prisma.config.ts.
 *
 * See DESIGN.md §4.1.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  // Fail loudly and specifically. The default failure here is a connection
  // error that says nothing about the missing variable, which is a genuinely
  // confusing hour to lose.
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and fill it in. ' +
        'On Vercel, set it in Project Settings -> Environment Variables. ' +
        'It must be the pooled connection on port 6543 with ?pgbouncer=true.',
    );
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });
}

/**
 * In development, Next.js hot-reloads modules on every edit. Without this
 * cache each reload would construct a new PrismaClient and open a new
 * connection pool, and within a few minutes the database refuses connections.
 * Stashing the instance on globalThis survives module reload.
 *
 * In production the module is evaluated once, so the cache is unnecessary but
 * harmless.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
