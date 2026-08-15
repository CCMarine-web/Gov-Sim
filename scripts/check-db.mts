/**
 * Database connection smoke test.
 *
 *   npm run db:check
 *
 * Verifies the connection the APPLICATION uses — DATABASE_URL, the transaction
 * pooler on port 6543. This is deliberately a different code path from
 * `prisma migrate`, which uses DIRECT_URL on 5432. A working migration does
 * not prove the app can reach the database, so we check both.
 *
 * Run this whenever a deployment can build but queries fail; it isolates
 * "the connection is wrong" from "the application code is wrong".
 *
 * WHY THIS USES `pg` DIRECTLY RATHER THAN THE PRISMA CLIENT
 * Prisma 7 emits its client as TypeScript into src/generated, which plain Node
 * cannot import without extra build configuration that would only ever serve
 * this one script. Prisma's PostgreSQL adapter (PrismaPg) is a thin wrapper
 * over this same `pg` driver, so a successful connection here means the
 * adapter will connect too. The Next.js build separately proves the generated
 * client imports and typechecks.
 */

import 'dotenv/config';
import { Client } from 'pg';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('FAIL  DATABASE_URL is not set. Check that .env exists and is filled in.');
    process.exit(1);
  }

  // Report the shape without ever printing the password.
  console.log(`      using ${connectionString.replace(/:\/\/([^:]+):[^@]+@/, '://$1:****@')}`);

  if (!connectionString.includes('6543')) {
    console.warn(
      'WARN  DATABASE_URL is not on port 6543. The application should use the\n' +
        '      transaction pooler; 5432 works but exhausts connections under load.',
    );
  }
  if (!connectionString.includes('pgbouncer=true')) {
    console.warn('WARN  DATABASE_URL is missing ?pgbouncer=true');
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('OK    connected via the pooled connection');

    const { rows } = await client.query<{ n: string }>(
      'SELECT COUNT(*)::text AS n FROM save_games',
    );
    console.log(`OK    table "save_games" is reachable and holds ${rows[0].n} row(s)`);

    const { rows: cols } = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'save_games'
       ORDER BY ordinal_position`,
    );
    console.log(`OK    ${cols.length} columns: ${cols.map((c) => c.column_name).join(', ')}`);

    console.log('');
    console.log('Database is wired correctly.');
  } catch (error) {
    console.error('FAIL  could not query save_games');
    console.error('');
    console.error(error instanceof Error ? error.message : String(error));
    console.error('');
    console.error('Common causes:');
    console.error('  - Migration not applied yet            -> npm run db:migrate');
    console.error('  - Password not percent-encoded in the URL (! must be %21)');
    console.error('  - Wrong project reference in the host name');
    process.exit(1);
  } finally {
    await client.end();
  }
}

void main();
