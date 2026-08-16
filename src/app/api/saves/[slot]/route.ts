/**
 * A SINGLE SAVE SLOT
 *
 *   GET    /api/saves/:slot   load the full state
 *   DELETE /api/saves/:slot   clear the slot
 *
 * As with the collection route, every query is scoped to the authenticated
 * user id, because Prisma bypasses Row Level Security.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getUserId } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseSlot(raw: string): number | null {
  const slot = Number(raw);
  if (!Number.isInteger(slot) || slot < 0 || slot > 3) return null;
  return slot;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slot: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'cloud_not_configured', message: 'Cloud saves are not configured.' },
      { status: 501 },
    );
  }

  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json(
      { error: 'unauthenticated', message: 'Sign in to use cloud saves.' },
      { status: 401 },
    );
  }

  const { slot: rawSlot } = await context.params;
  const slot = parseSlot(rawSlot);
  if (slot === null) {
    return NextResponse.json(
      { error: 'bad_request', message: 'Slot must be 0, 1, 2 or 3.' },
      { status: 400 },
    );
  }

  try {
    const save = await prisma.saveGame.findUnique({
      where: { userId_slot: { userId, slot } },
    });

    if (!save) {
      return NextResponse.json(
        { error: 'not_found', message: 'That save slot is empty.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ state: save.state, schemaVersion: save.schemaVersion });
  } catch {
    return NextResponse.json(
      { error: 'database_error', message: 'Could not read that save.' },
      { status: 503 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ slot: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'cloud_not_configured', message: 'Cloud saves are not configured.' },
      { status: 501 },
    );
  }

  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json(
      { error: 'unauthenticated', message: 'Sign in to use cloud saves.' },
      { status: 401 },
    );
  }

  const { slot: rawSlot } = await context.params;
  const slot = parseSlot(rawSlot);
  if (slot === null) {
    return NextResponse.json(
      { error: 'bad_request', message: 'Slot must be 0, 1, 2 or 3.' },
      { status: 400 },
    );
  }

  try {
    // deleteMany rather than delete: deleting a slot that is already empty is
    // not an error worth surfacing to the player.
    await prisma.saveGame.deleteMany({ where: { userId, slot } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: 'database_error', message: 'Could not delete that save.' },
      { status: 503 },
    );
  }
}
