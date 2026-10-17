import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isGuest, mergeChoice, parseGuestStash } from './guest.ts';

const NOW = Date.UTC(2026, 9, 17);
const DAY = 24 * 60 * 60 * 1000;

test('a kept guest is read back only when it is whole and recent', () => {
  const kept = JSON.stringify({ id: 'g1', refreshToken: 'rt', savedAt: NOW - DAY });
  assert.deepEqual(parseGuestStash(kept, NOW), {
    id: 'g1',
    refreshToken: 'rt',
    savedAt: NOW - DAY,
  });
  // an email confirmation opened weeks later is too late
  assert.equal(
    parseGuestStash(JSON.stringify({ id: 'g1', refreshToken: 'rt', savedAt: NOW - 31 * DAY }), NOW),
    null
  );
  assert.equal(parseGuestStash(JSON.stringify({ id: 'g1', savedAt: NOW }), NOW), null);
  assert.equal(parseGuestStash('{not json', NOW), null);
  assert.equal(parseGuestStash(null, NOW), null);
});

test('only an anonymous user is a guest', () => {
  assert.equal(isGuest({ is_anonymous: true }), true);
  assert.equal(isGuest({ is_anonymous: false }), false);
  assert.equal(isGuest(null), false);
});

test('a guest who practised is asked about only when the account has its own record', () => {
  assert.equal(mergeChoice({ guestLessons: 0, accountLessons: 4 }), 'discard');
  assert.equal(mergeChoice({ guestLessons: 2, accountLessons: 0 }), 'merge');
  assert.equal(mergeChoice({ guestLessons: 2, accountLessons: 4 }), 'ask');
});
