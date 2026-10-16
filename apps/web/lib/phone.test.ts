import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkCode, normalizePhone, phoneConfig, sendCode } from './phone.ts';

test('numbers become E.164, the same as the agent (apps/agent/tests/test_phone_and_sms.py)', () => {
  assert.equal(normalizePhone('+1 (555) 010-9999'), '+15550109999');
  assert.equal(normalizePhone('sip:+447700900001@trunk.example'), '+447700900001');
  assert.equal(normalizePhone('tel:+8613800000000'), '+8613800000000');
  assert.equal(normalizePhone('0044 7700 900001'), '+447700900001');
  assert.equal(normalizePhone('5550109999'), null);
  for (const bad of [null, undefined, '', '+0123456', '+1234', '+1234567890123456', 42]) {
    assert.equal(normalizePhone(bad), null);
  }
});

test('phone features are off until Twilio is configured', () => {
  assert.equal(phoneConfig({}), null);
  const config = phoneConfig({
    TWILIO_ACCOUNT_SID: 'AC1',
    TWILIO_AUTH_TOKEN: 'secret',
    TWILIO_VERIFY_SERVICE_SID: 'VA1',
    SPEAKWOW_PHONE_NUMBER: '+1 555 010 0000',
  });
  assert.equal(config?.line, '+15550100000');
});

const CONFIG = { accountSid: 'AC1', authToken: 'secret', verifySid: 'VA1', line: null };

function fakeFetch(status: number, body: unknown, seen: { url?: string; init?: RequestInit }) {
  return (async (url: string, init: RequestInit) => {
    seen.url = url;
    seen.init = init;
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
}

test('a code is sent through Twilio Verify with basic auth', async () => {
  const seen: { url?: string; init?: RequestInit } = {};
  const res = await sendCode(CONFIG, '+447700900001', fakeFetch(201, { status: 'pending' }, seen));
  assert.deepEqual(res, { ok: true });
  assert.equal(seen.url, 'https://verify.twilio.com/v2/Services/VA1/Verifications');
  const headers = seen.init?.headers as Record<string, string>;
  assert.equal(headers.Authorization, `Basic ${Buffer.from('AC1:secret').toString('base64')}`);
  assert.equal(String(seen.init?.body), 'To=%2B447700900001&Channel=sms');
  const limited = await sendCode(CONFIG, '+447700900001', fakeFetch(429, { code: 60203 }, {}));
  assert.deepEqual(limited, { ok: false, reason: 'too_many' });
});

test('only an approved check counts', async () => {
  assert.equal(
    await checkCode(CONFIG, '+447700900001', '123456', fakeFetch(200, { status: 'approved' }, {})),
    true
  );
  assert.equal(
    await checkCode(CONFIG, '+447700900001', '123456', fakeFetch(200, { status: 'pending' }, {})),
    false
  );
  // a malformed code never reaches Twilio
  const seen: { url?: string } = {};
  assert.equal(await checkCode(CONFIG, '+447700900001', '12ab', fakeFetch(200, {}, seen)), false);
  assert.equal(seen.url, undefined);
});
