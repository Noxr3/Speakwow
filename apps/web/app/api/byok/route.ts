import { NextResponse } from 'next/server';
import { byokSecret, isByokProvider, keyHint, looksLikeApiKey, sealUserKey } from '@/lib/byok';
import { getSessionUser } from '@/lib/supabase/server';

export const revalidate = 0;

/**
 * Bring your own key. A signed-in student's key is sealed (AES-256-GCM) and
 * stored on their account; only its last four characters ever come back.
 * Guests keep their key in their own browser and send it with each call.
 */

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET() {
  const { supabase, user } = await getSessionUser();
  let saved = null;
  if (supabase && user) {
    const { data } = await supabase
      .from('user_api_keys')
      .select('provider, key_hint, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();
    saved = data;
  }
  return json({
    enabled: Boolean(byokSecret()),
    required: process.env.REQUIRE_BYOK === 'true',
    signedIn: Boolean(user),
    saved,
  });
}

export async function PUT(req: Request) {
  const secret = byokSecret();
  if (!secret) {
    return json(
      { error: 'byok_disabled', message: 'This server has no BYOK_ENCRYPTION_KEY.' },
      501
    );
  }
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) {
    return json({ error: 'sign_in_required', message: 'Sign in to save a key.' }, 401);
  }
  const body = await req.json().catch(() => null);
  const provider = body?.provider;
  const key = typeof body?.key === 'string' ? body.key.trim() : body?.key;
  if (!isByokProvider(provider) || !looksLikeApiKey(key)) {
    return json(
      { error: 'invalid_key', message: 'Choose a provider and paste a valid API key.' },
      400
    );
  }
  const row = {
    user_id: user.id,
    provider,
    sealed_key: sealUserKey({ provider, key }, secret),
    key_hint: keyHint(key),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('user_api_keys').upsert(row);
  if (error) return json({ error: 'save_failed', message: error.message }, 500);
  return json({ saved: { provider, key_hint: row.key_hint, updated_at: row.updated_at } });
}

export async function DELETE() {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) {
    return json({ error: 'sign_in_required', message: 'Sign in first.' }, 401);
  }
  const { error } = await supabase.from('user_api_keys').delete().eq('user_id', user.id);
  if (error) return json({ error: 'delete_failed', message: error.message }, 500);
  return json({ saved: null });
}
