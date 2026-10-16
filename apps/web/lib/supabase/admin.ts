import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, isSupabaseConfigured } from './config';

/**
 * A client that bypasses row-level security, for the few writes only the
 * server may make (a phone number, once its code checked out). Server code
 * only: the key has no NEXT_PUBLIC_ prefix, so it never reaches a browser
 * bundle. null when the service role key is missing.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isSupabaseConfigured() || !key) return null;
  return createClient(SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
