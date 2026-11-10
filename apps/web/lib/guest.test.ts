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

test('a stale guest session is replaced after the server rejects its user', async () => {
  const { ensureGuestSession } = await import('./guest.ts');
  const calls: string[] = [];
  const client = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'gone' } } } }),
      getUser: async () => ({ data: { user: null }, error: { status: 403 } }),
      signOut: async () => {
        calls.push('clear');
        return { error: null };
      },
      signInAnonymously: async () => {
        calls.push('guest');
        return { error: null };
      },
    },
  };
  await ensureGuestSession(client as never);
  assert.deepEqual(calls, ['clear', 'guest']);
});

test('a temporary auth outage never replaces the saved identity', async () => {
  const { ensureGuestSession } = await import('./guest.ts');
  const outage = { status: 503 };
  const client = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'existing' } } } }),
      getUser: async () => ({ data: { user: null }, error: outage }),
      signOut: async () => assert.fail('must keep the session'),
      signInAnonymously: async () => assert.fail('must not create another identity'),
    },
  };
  await assert.rejects(ensureGuestSession(client as never), (error) => error === outage);
});
