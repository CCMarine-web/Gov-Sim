/**
 * SUPABASE SERVER CLIENT
 *
 * SERVER ONLY. Reads the session from cookies so route handlers can identify
 * the caller.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AUTHORIZATION IS ENFORCED HERE, NOT BY ROW LEVEL SECURITY
 *
 * Save data is read and written through Prisma, which connects as the database
 * owner and therefore BYPASSES RLS entirely (DESIGN.md §4.1). RLS is a second
 * layer, not the first one. Every route that touches a save must call
 * `requireUserId()` and scope its query to that id. A route that forgets is a
 * data leak, not a bug.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';

export async function getServerSupabase(): Promise<SupabaseClient | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  const cookieStore = await cookies();

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled in middleware instead; ignoring this is
          // the documented Supabase pattern, not a swallowed error.
        }
      },
    },
  });
}

/**
 * The authenticated user's id, or null.
 *
 * Uses `getUser()`, which validates the token against Supabase, rather than
 * `getSession()`, which trusts whatever the cookie says. For an authorization
 * decision the difference matters.
 */
export async function getUserId(): Promise<string | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}
