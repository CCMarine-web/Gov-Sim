/**
 * SAVE GAMES API
 *
 *   GET  /api/saves          list the caller's saves (metadata only)
 *   PUT  /api/saves          write a save to a slot
 *
 * Every handler scopes its query to the authenticated user id. Prisma connects
 * as the database owner and bypasses Row Level Security, so this check is the
 * only thing standing between one player's saves and another's. See
 * src/lib/supabase/server.ts.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getUserId } from '@/lib/supabase/server';
import { SCHEMA_VERSION } from '@/sim/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SLOT = 3;
/** A GameState after a full Phase 1 run is well under this. */
const MAX_STATE_BYTES = 4_000_000;

function notConfigured() {
  return NextResponse.json(
    {
      error: 'cloud_not_configured',
      message:
        'Cloud saves are not configured for this deployment. See docs/ENV-SETUP.md.',
    },
    { status: 501 },
  );
}

function unauthorised() {
  return NextResponse.json(
    { error: 'unauthenticated', message: 'Sign in to use cloud saves.' },
    { status: 401 },
  );
}

export async function GET() {
  if (!isSupabaseConfigured()) return notConfigured();

  const userId = await getUserId();
  if (!userId) return unauthorised();

  try {
    const saves = await prisma.saveGame.findMany({
      where: { userId },
      orderBy: { slot: 'asc' },
      // Deliberately excludes `state`: the load screen renders a list from
      // metadata alone and must not download several megabytes to do it.
      select: {
        slot: true,
        name: true,
        schemaVersion: true,
        contentVersion: true,
        rulerName: true,
        governmentType: true,
        inGameDay: true,
        inGameDate: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ saves });
  } catch {
    return NextResponse.json(
      { error: 'database_error', message: 'Could not read your saves.' },
      { status: 503 },
    );
  }
}

export async function PUT(request: NextRequest) {
  if (!isSupabaseConfigured()) return notConfigured();

  const userId = await getUserId();
  if (!userId) return unauthorised();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'bad_request', message: 'Body was not valid JSON.' },
      { status: 400 },
    );
  }

  const payload = body as {
    slot?: number;
    name?: string;
    inGameDate?: string;
    state?: Record<string, unknown>;
  };

  const slot = payload.slot;
  if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 0 || slot > MAX_SLOT) {
    return NextResponse.json(
      { error: 'bad_request', message: `slot must be an integer 0..${MAX_SLOT}.` },
      { status: 400 },
    );
  }

  const state = payload.state;
  if (!state || typeof state !== 'object') {
    return NextResponse.json(
      { error: 'bad_request', message: 'state is required.' },
      { status: 400 },
    );
  }

  const serialised = JSON.stringify(state);
  if (serialised.length > MAX_STATE_BYTES) {
    return NextResponse.json(
      { error: 'too_large', message: 'That save is unexpectedly large and was rejected.' },
      { status: 413 },
    );
  }

  // Record the version the save was written under. Refusing a FUTURE version
  // here would be wrong — the client is the authority on its own format — but
  // a missing version means we could never migrate it later.
  const schemaVersion =
    typeof state.schemaVersion === 'number' ? state.schemaVersion : SCHEMA_VERSION;

  const meta = {
    name:
      typeof payload.name === 'string' && payload.name.trim()
        ? payload.name.trim()
        : `Slot ${slot}`,
    schemaVersion,
    contentVersion:
      typeof state.contentVersion === 'string' ? state.contentVersion : 'unknown',
    rulerName: readRuler(state, 'name') ?? 'Unnamed',
    governmentType:
      typeof state.governmentType === 'string' ? state.governmentType : 'republic',
    inGameDay: typeof state.day === 'number' ? state.day : 0,
    // Supplied by the client, which owns the calendar. Stored purely so the
    // load screen can show a date without deserialising the whole state.
    inGameDate: typeof payload.inGameDate === 'string' ? payload.inGameDate : '',
  };

  try {
    await prisma.saveGame.upsert({
      where: { userId_slot: { userId, slot } },
      create: { userId, slot, ...meta, state: state as never },
      update: { ...meta, state: state as never },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: 'database_error', message: 'Could not write your save.' },
      { status: 503 },
    );
  }
}

function readRuler(state: Record<string, unknown>, key: string): string | null {
  const ruler = state.ruler;
  if (!ruler || typeof ruler !== 'object') return null;
  const value = (ruler as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

