/**
 * Health check endpoint.
 *
 *   GET /api/health
 *
 * Verifies that the DEPLOYED application can reach the database. This is a
 * different question from whether a migration ran from a developer's laptop:
 * it exercises the environment variables configured in the hosting platform,
 * the pooled connection, and the generated Prisma client, all from inside a
 * serverless function.
 *
 * Deliberately does not leak anything sensitive. It reports whether variables
 * are *present*, never their values, and returns raw error text only outside
 * production.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Prisma needs the Node.js runtime; it cannot run on the Edge runtime.
export const runtime = 'nodejs';

// Never prerender or cache this. A cached health check is worse than none —
// it reports the state of the world at build time and calls it "now".
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Describes the SHAPE of a connection string without revealing it.
 *
 * A connection failure that happens in ~1ms never reached the network, which
 * means the string itself was rejected. The usual cause is a value that was
 * correct in .env but pasted into a hosting dashboard with its surrounding
 * double quotes still attached, or with stray whitespace or a newline. None of
 * the fields below expose the password.
 */
function describeConnectionString(raw: string | undefined) {
  if (!raw) return { present: false };

  return {
    present: true,
    length: raw.length,
    // The high-signal checks for a paste that went wrong.
    wrappedInQuotes: /^["']|["']$/.test(raw),
    hasWhitespace: /\s/.test(raw),
    validScheme: /^postgres(ql)?:\/\//.test(raw),
    port: raw.match(/:(\d{4,5})\//)?.[1] ?? 'none detected',
    hasPgbouncerParam: raw.includes('pgbouncer=true'),
    // A password left as a literal placeholder.
    looksUnsubstituted: /\[YOUR-PASSWORD\]|PROJECT_REF|:PASSWORD@/.test(raw),
  };
}

export async function GET(): Promise<NextResponse> {
  const startedAt = Date.now();

  // Presence only. Never the values.
  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    DIRECT_URL: Boolean(process.env.DIRECT_URL),
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  };

  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local';

  if (!env.DATABASE_URL) {
    return NextResponse.json(
      {
        status: 'error',
        database: 'unconfigured',
        message:
          'DATABASE_URL is not set in this environment. Add it in the hosting ' +
          'platform settings, then redeploy — new variables do not apply to an ' +
          'existing deployment.',
        env,
      },
      { status: 503 },
    );
  }

  try {
    const saveCount = await prisma.saveGame.count();

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      saveGames: saveCount,
      latencyMs: Date.now() - startedAt,
      env,
      // Set by Vercel. Lets us confirm which commit is answering.
      commit,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        database: 'unreachable',
        latencyMs: Date.now() - startedAt,
        env,
        commit,
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
        // Shape diagnostics. Safe to expose: no values, only structure.
        databaseUrlShape: describeConnectionString(process.env.DATABASE_URL),
        directUrlShape: describeConnectionString(process.env.DIRECT_URL),
        // Error text can echo connection details, so it is withheld in
        // production and available locally where it is actually useful.
        message:
          process.env.NODE_ENV === 'production'
            ? 'Database query failed. Check the deployment logs.'
            : error instanceof Error
              ? error.message
              : String(error),
      },
      { status: 503 },
    );
  }
}
