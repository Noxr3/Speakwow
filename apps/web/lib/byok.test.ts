import assert from 'node:assert/strict';
import { test } from 'node:test';
import { byokSecret, keyHint, looksLikeApiKey, openUserKey, sealUserKey } from './byok.ts';

const SECRET = Buffer.alloc(32, 7);

test('seal and open round-trip', () => {
  const sealed = sealUserKey({ provider: 'openai', key: 'test-openai-0123456789abcdef' }, SECRET);
  assert.match(sealed, /^v1\.[A-Za-z0-9_-]+$/);
  assert.ok(!sealed.includes('sk-test'));
  assert.deepEqual(openUserKey(sealed, SECRET), {
    provider: 'openai',
    key: 'test-openai-0123456789abcdef',
  });
});

test('a different secret or a tampered value opens nothing', () => {
  const sealed = sealUserKey({ provider: 'xai', key: 'xai-0123456789abcdefghij' }, SECRET);
  assert.equal(openUserKey(sealed, Buffer.alloc(32, 8)), null);
  const flipped = sealed.slice(0, -2) + (sealed.endsWith('A') ? 'B' : 'A') + sealed.slice(-1);
  assert.equal(openUserKey(flipped, SECRET), null);
  assert.equal(openUserKey('not-sealed', SECRET), null);
});

test('fixed vector the Python agent also opens (apps/agent/tests/test_byok.py)', () => {
  const sealed = sealUserKey(
    { provider: 'xai', key: 'xai-vector-key-000000000000' },
    SECRET,
    Buffer.alloc(12, 1)
  );
  assert.equal(sealed, VECTOR);
});

test('secret parsing accepts base64 and base64url, rejects wrong length', () => {
  assert.equal(byokSecret(SECRET.toString('base64'))?.length, 32);
  assert.equal(byokSecret(SECRET.toString('base64url'))?.length, 32);
  assert.equal(byokSecret(Buffer.alloc(16).toString('base64')), null);
  assert.equal(byokSecret(undefined), null);
});

test('key shape and hint', () => {
  assert.ok(looksLikeApiKey('test-key-abcdefghijklmnopqrstuvwxyz'));
  assert.ok(!looksLikeApiKey('short'));
  assert.ok(!looksLikeApiKey('has a space in the middle of the key'));
  assert.equal(keyHint('sk-abcdefghijklmnop1234'), '1234');
});

const VECTOR =
  'v1.AQEBAQEBAQEBAQEBDcP5xf_JhWq0pv4bUk8RWIrXNp997hkpekkiC0vCU9i23Xqd93b8rW5CeDvxTt6pvivZMn_D7my0Zr4yp8zaTCpl8PlNtA';
