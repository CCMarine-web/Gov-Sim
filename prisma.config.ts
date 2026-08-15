// ============================================================================
// PRISMA CLI CONFIGURATION
//
// This file configures the Prisma *command line tools* — `prisma migrate`,
// `prisma generate`, `prisma studio`. It is not used by the running app.
//
// Why this file exists at all: Prisma 7 removed `url` and `directUrl` from the
// datasource block in schema.prisma. Connection configuration moved here.
//
// WHICH URL GOES WHERE
//
//   Here (CLI)          -> DIRECT_URL,   port 5432, no pooler
//   src/lib/prisma.ts   -> DATABASE_URL, port 6543, ?pgbouncer=true
//
// Migrations must use the direct connection. They take PostgreSQL advisory
// locks and issue DDL statements, and a transaction pooler does not hold a
// session open across statements, so both silently break through the pooler.
// The symptom is usually a migration that appears to hang or reports a lock
// error that does not mention pooling at all.
//
// See DESIGN.md §4.1.
// ============================================================================

// Prisma 7 no longer loads .env automatically. Without this import, every
// CLI command fails with an "environment variable not found" error even
// though the variable is plainly sitting in .env.
import 'dotenv/config';

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',

  migrations: {
    path: 'prisma/migrations',
  },

  datasource: {
    // Deliberately DIRECT_URL, not DATABASE_URL. See above.
    //
    // Read through process.env rather than Prisma's env() helper so that
    // `prisma generate` still works without a database configured — which
    // matters because Vercel runs generate during every build, including
    // builds where we have not yet attached the database.
    url: process.env.DIRECT_URL ?? '',
  },
});
