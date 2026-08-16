'use client';

/**
 * SUPABASE BROWSER CLIENT
 *
 * Returns null rather than throwing when the project is not configured, so
 * callers fall back to local storage instead of crashing the page. See
 * docs/ENV-SETUP.md.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';

let cached: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient | null {
  if (cached) return cached;

  const config = getSupabaseConfig();
  if (!config) return null;

  cached = createBrowserClient(config.url, config.anonKey);
  return cached;
}
