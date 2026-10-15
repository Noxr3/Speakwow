/**
 * Supabase is optional. Without it the app still runs: guests talk to the
 * teacher, nothing is remembered, and account pages explain how to turn
 * accounts on. That keeps `pnpm dev` working for a first-time contributor.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('placeholder'));
}
