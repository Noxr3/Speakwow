import { NextResponse } from 'next/server';
import {
  MAX_PHONES_PER_STUDENT,
  checkCode,
  normalizePhone,
  phoneConfig,
  sendCode,
} from '@/lib/phone';
import { clientIp, underLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/supabase/server';

// Codes cost money and can be sent to any number: per account and per
// address, on top of Twilio Verify's own per-number limit.
const CODES_PER_USER_PER_HOUR = 5;
const CODES_PER_IP_PER_DAY = 20;

export const revalidate = 0;

/**
 * Link a phone so the student can call and text their teacher. POST sends a
 * code to the number, PUT checks it and links the number; only then do calls
 * and texts from it share this student's memory. DELETE unlinks.
 *
 * POST never says whether a number belongs to someone else (that would let
 * anyone test which numbers are students). Holding the phone, proven by the
 * code, is what counts: a number that changed hands moves to the account
 * that verified it last.
 */

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function signedIn() {
  const { supabase, user } = await getSessionUser();
  return supabase && user ? { supabase, user } : null;
}

export async function GET() {
  const config = phoneConfig();
  const session = await signedIn();
  let phones: { phone: string; sms_opted_out: boolean }[] = [];
  if (session) {
    const { data } = await session.supabase
      .from('student_phones')
      .select('phone, sms_opted_out')
      .order('created_at');
    phones = data ?? [];
  }
  return json({
    enabled: Boolean(config && createAdminClient()),
    line: config?.line ?? null,
    signedIn: Boolean(session),
    phones,
  });
}

export async function POST(req: Request) {
  const config = phoneConfig();
  const admin = createAdminClient();
  if (!config || !admin) {
    return json({ error: 'phone_disabled', message: 'Phone is not set up on this server.' }, 501);
  }
  const session = await signedIn();
  if (!session) return json({ error: 'sign_in_required', message: 'Sign in first.' }, 401);
  const body = await req.json().catch(() => null);
  const phone = normalizePhone(body?.phone);
  if (!phone) {
    return json(
      {
        error: 'invalid_phone',
        message: 'Enter the number with its country code, like +44 7700 900123.',
      },
      400
    );
  }
  const { data: mine } = await admin
    .from('student_phones')
    .select('phone')
    .eq('student_id', session.user.id);
  if (mine?.some((row) => row.phone === phone)) return json({ linked: true, phone });
  if ((mine?.length ?? 0) >= MAX_PHONES_PER_STUDENT) {
    return json(
      {
        error: 'too_many_phones',
        message: `You can link up to ${MAX_PHONES_PER_STUDENT} numbers.`,
      },
      400
    );
  }
  const allowed =
    (await underLimit(`phone-code:user:${session.user.id}`, CODES_PER_USER_PER_HOUR, 3600)) &&
    (await underLimit(`phone-code:ip:${clientIp(req.headers)}`, CODES_PER_IP_PER_DAY, 86400));
  if (!allowed) {
    return json(
      { error: 'too_many_codes', message: 'Too many codes. Try again a bit later.' },
      429
    );
  }
  const sent = await sendCode(config, phone);
  if (!sent.ok) {
    return json(
      sent.reason === 'too_many'
        ? { error: 'too_many_codes', message: 'Too many codes for this number. Try again later.' }
        : { error: 'send_failed', message: 'Could not text a code to this number.' },
      sent.reason === 'too_many' ? 429 : 502
    );
  }
  return json({ sent: true, phone });
}

export async function PUT(req: Request) {
  const config = phoneConfig();
  const admin = createAdminClient();
  if (!config || !admin) {
    return json({ error: 'phone_disabled', message: 'Phone is not set up on this server.' }, 501);
  }
  const session = await signedIn();
  if (!session) return json({ error: 'sign_in_required', message: 'Sign in first.' }, 401);
  const body = await req.json().catch(() => null);
  const phone = normalizePhone(body?.phone);
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  if (!phone || !(await checkCode(config, phone, code))) {
    return json({ error: 'wrong_code', message: 'That code is not right. Try again.' }, 400);
  }
  // the cap again: codes for several numbers could have been sent at once
  const { data: mine } = await admin
    .from('student_phones')
    .select('phone')
    .eq('student_id', session.user.id);
  const others = (mine ?? []).filter((row) => row.phone !== phone);
  if (others.length >= MAX_PHONES_PER_STUDENT) {
    return json(
      {
        error: 'too_many_phones',
        message: `You can link up to ${MAX_PHONES_PER_STUDENT} numbers.`,
      },
      400
    );
  }
  // Whoever just proved they hold the phone owns the link now; a number that
  // changed hands moves to its new owner, opted back in.
  const { error } = await admin.from('student_phones').upsert(
    {
      phone,
      student_id: session.user.id,
      verified_at: new Date().toISOString(),
      sms_opted_out: false,
    },
    { onConflict: 'phone' }
  );
  if (error) return json({ error: 'save_failed', message: 'Could not link the number.' }, 500);
  return json({ linked: true, phone });
}

export async function DELETE(req: Request) {
  const session = await signedIn();
  if (!session) return json({ error: 'sign_in_required', message: 'Sign in first.' }, 401);
  const body = await req.json().catch(() => null);
  const phone = normalizePhone(body?.phone);
  if (!phone) return json({ error: 'invalid_phone', message: 'Which number?' }, 400);
  // row-level security lets a student remove only their own numbers
  const { error } = await session.supabase.from('student_phones').delete().eq('phone', phone);
  if (error) return json({ error: 'delete_failed', message: 'Could not unlink the number.' }, 500);
  return json({ unlinked: true, phone });
}
