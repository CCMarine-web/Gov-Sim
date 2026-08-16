/**
 * SUPABASE CONFIGURATION
 *
 * One place that answers "is cloud storage usable right now".
 *
 * The game must remain fully playable with these unset. Every cloud path
 * checks here first and falls back to local storage rather than throwing, so a
 * missing credential degrades to "saves are local only" instead of "saving is
 * broken". See docs/ENV-SETUP.md.
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/** Reads the public variables. Returns null when either is missing or is still a placeholder. */
export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  // The committed .env.example ships placeholders. Treat them as unset rather
  // than letting a client be constructed against a nonsense URL and failing
  // later with a confusing network error.
  if (url.includes('PROJECT_REF') || anonKey.includes('your-anon-key')) {
    return null;
  }

  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

/** Explains, for the interface, why cloud features are unavailable. */
export function cloudUnavailableReason(): string | null {
  if (isSupabaseConfigured()) return null;
  return (
    'Cloud saves are not configured for this deployment. Games are being saved ' +
    'to this browser only. See docs/ENV-SETUP.md.'
  );
}
