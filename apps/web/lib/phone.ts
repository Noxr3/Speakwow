/**
 * Phone numbers, and the code that proves a student holds one. Server-only.
 *
 * Numbers are stored as E.164 ("+" and up to 15 digits), the same shape the
 * voice and text servers look a caller up by (apps/agent/src/phone.py; the
 * test vectors in phone.test.ts match its tests). The code goes out by SMS
 * through Twilio Verify, which also limits how often a number can be sent one.
 *
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID
 *   SPEAKWOW_PHONE_NUMBER   the teacher line students call and text
 */

const E164 = /^\+[1-9]\d{6,14}$/;

export const MAX_PHONES_PER_STUDENT = 3;

export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let text = raw.trim().replace(/^(sip|tel):/i, '');
  text = text.split('@', 1)[0];
  let digits = text.replace(/\D/g, '');
  if (!digits) return null;
  if (text.startsWith('00')) digits = digits.slice(2);
  else if (!text.trimStart().startsWith('+')) return null; // no country code
  const phone = `+${digits}`;
  return E164.test(phone) ? phone : null;
}

export interface PhoneConfig {
  accountSid: string;
  authToken: string;
  verifySid: string;
  /** the teacher line, shown to students; may be missing while it is set up */
  line: string | null;
}

export function phoneConfig(env: NodeJS.ProcessEnv = process.env): PhoneConfig | null {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID } = env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) return null;
  return {
    accountSid: TWILIO_ACCOUNT_SID,
    authToken: TWILIO_AUTH_TOKEN,
    verifySid: TWILIO_VERIFY_SERVICE_SID,
    line: normalizePhone(env.SPEAKWOW_PHONE_NUMBER) ?? null,
  };
}

type Fetch = typeof fetch;

async function verifyPost(
  config: PhoneConfig,
  path: string,
  form: Record<string, string>,
  fetchImpl: Fetch
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
  const res = await fetchImpl(`https://verify.twilio.com/v2/Services/${config.verifySid}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(form).toString(),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, body };
}

/** Text a code to the number. */
export async function sendCode(
  config: PhoneConfig,
  phone: string,
  fetchImpl: Fetch = fetch
): Promise<{ ok: true } | { ok: false; reason: 'too_many' | 'failed' }> {
  const res = await verifyPost(config, 'Verifications', { To: phone, Channel: 'sms' }, fetchImpl);
  if (res.ok) return { ok: true };
  // Twilio Verify answers 429 (and code 60203) when a number asked too often
  return {
    ok: false,
    reason: res.status === 429 || res.body.code === 60203 ? 'too_many' : 'failed',
  };
}

/** True when the code is the one Twilio sent to this number. */
export async function checkCode(
  config: PhoneConfig,
  phone: string,
  code: string,
  fetchImpl: Fetch = fetch
): Promise<boolean> {
  if (!/^\d{4,10}$/.test(code)) return false;
  const res = await verifyPost(config, 'VerificationCheck', { To: phone, Code: code }, fetchImpl);
  return res.ok && res.body.status === 'approved';
}
