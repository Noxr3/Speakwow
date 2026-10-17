import { NextResponse } from 'next/server';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/supabase/config';
import { getSessionUser } from '@/lib/supabase/server';

export const revalidate = 0;

const ACTIONS = ['peek', 'merge', 'discard'] as const;
type Action = (typeof ACTIONS)[number];

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

/**
 * A guest's practice, after they sign in (lib/guest.ts).
 *
 *   POST { refresh_token, action }
 *   peek     how many calls the guest and the account each have
 *   merge    move the guest's practice into the account, then remove the guest
 *   discard  remove the guest
 *
 * The caller must be signed in to a real account. The guest is proven by its
 * refresh token, kept in this browser just before sign-in: only GoTrue can
 * exchange it, and the user it returns must still be anonymous. Every answer
 * that used the token carries the next one (tokens are used once).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) ?? {};
  const action = body.action as Action;
  const refreshToken = body.refresh_token;
  if (!ACTIONS.includes(action) || typeof refreshToken !== 'string' || !refreshToken) {
    return json({ error: 'bad_request' }, 400);
  }

  const { user } = await getSessionUser();
  if (!user || user.is_anonymous) return json({ error: 'sign_in_required' }, 401);
  const admin = createAdminClient();
  if (!admin || !isSupabaseConfigured()) return json({ error: 'not_configured' }, 503);

  const exchange = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await exchange.auth.refreshSession({ refresh_token: refreshToken });
  const guest = data?.user;
  if (error || !guest?.is_anonymous || guest.id === user.id) {
    // already merged, removed, or not a guest at all: nothing left to do
    return json({ error: 'guest_gone' }, 410);
  }

  if (action === 'peek') {
    const [guestLessons, accountLessons] = await Promise.all([
      lessons(admin, guest.id),
      lessons(admin, user.id),
    ]);
    return json({
      guestLessons,
      accountLessons,
      refresh_token: data.session?.refresh_token,
    });
  }

  let moved = null;
  if (action === 'merge') {
    const result = await admin.rpc('merge_guest_into', {
      p_guest: guest.id,
      p_account: user.id,
    });
    if (result.error) {
      console.error('guest merge failed', result.error.message);
      return json({ error: 'merge_failed', refresh_token: data.session?.refresh_token }, 500);
    }
    moved = result.data;
  }
  // Merged or not wanted: the guest is done. What the merge left behind (the
  // account's duplicates) goes with it; every table cascades from it.
  const removed = await admin.auth.admin.deleteUser(guest.id);
  if (removed.error) console.error('could not remove the guest', removed.error.message);
  return json({ moved });
}

/** Calls in which something was said. */
async function lessons(admin: SupabaseClient, studentId: string): Promise<number> {
  const { count } = await admin
    .from('sessions')
    .select('id, messages!inner(id)', { count: 'exact', head: true })
    .eq('student_id', studentId);
  return count ?? 0;
}
