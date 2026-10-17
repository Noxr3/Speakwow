import type { Session, SupabaseClient } from '@supabase/supabase-js';

/**
 * A visitor who starts a call without an account becomes a guest: an
 * anonymous Supabase user, so everything the teacher learns about them is
 * saved like a student's. When they sign in to an account, the guest's
 * session is replaced; just before that, its refresh token is kept here, so
 * the server can prove the guest was theirs and move the practice across
 * (/api/guest, supabase/migrations/0010_guest_merge.sql).
 */

const STASH_KEY = 'speakwow.guest';
// long enough for an email confirmation link opened days later
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface GuestStash {
  id: string;
  refreshToken: string;
  savedAt: number;
}

export function isGuest(user: { is_anonymous?: boolean } | null | undefined): boolean {
  return Boolean(user?.is_anonymous);
}

export function parseGuestStash(raw: string | null, now = Date.now()): GuestStash | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<GuestStash>;
    if (
      typeof value.id !== 'string' ||
      typeof value.refreshToken !== 'string' ||
      !value.refreshToken ||
      typeof value.savedAt !== 'number' ||
      now - value.savedAt > MAX_AGE_MS
    ) {
      return null;
    }
    return { id: value.id, refreshToken: value.refreshToken, savedAt: value.savedAt };
  } catch {
    return null;
  }
}

export function loadGuestStash(): GuestStash | null {
  try {
    return parseGuestStash(window.localStorage.getItem(STASH_KEY));
  } catch {
    return null;
  }
}

function saveGuestStash(stash: GuestStash) {
  try {
    window.localStorage.setItem(STASH_KEY, JSON.stringify(stash));
  } catch {
    // private mode: the practice stays with the guest, nothing breaks
  }
}

/** Before signing in: keep the guest's way back, if there is a guest. */
export function stashGuest(session: Session | null) {
  if (!session?.user?.is_anonymous || !session.refresh_token) return;
  saveGuestStash({ id: session.user.id, refreshToken: session.refresh_token, savedAt: Date.now() });
}

/** The server uses the refresh token once and hands back the next one. */
export function updateGuestStash(stash: GuestStash, refreshToken: string) {
  saveGuestStash({ ...stash, refreshToken });
}

export function clearGuestStash() {
  try {
    window.localStorage.removeItem(STASH_KEY);
  } catch {
    // nothing to clear
  }
}

/**
 * Before a call: a visitor with no session at all becomes a guest, so the
 * call is remembered. If the server has anonymous sign-ins off, the call
 * goes ahead as before and simply is not kept.
 */
export async function ensureGuestSession(supabase: SupabaseClient | null) {
  if (!supabase) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) return;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) console.info('This call will not be kept:', error.message);
}

export interface GuestPeek {
  /** calls the guest had (with at least one thing said) */
  guestLessons: number;
  /** calls the account already had */
  accountLessons: number;
}

/**
 * What to do with a guest's practice after sign-in. Nothing practised:
 * drop the guest quietly. A new account with no record of its own: move
 * it across without asking, there is nothing to choose between. An account
 * that already has a record: ask.
 */
export function mergeChoice(peek: GuestPeek): 'discard' | 'merge' | 'ask' {
  if (peek.guestLessons === 0) return 'discard';
  if (peek.accountLessons === 0) return 'merge';
  return 'ask';
}
