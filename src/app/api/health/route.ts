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
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        database: 'unreachable',
        latencyMs: Date.now() - startedAt,
        env,
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
