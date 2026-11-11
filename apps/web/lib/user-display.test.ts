import assert from 'node:assert/strict';
import test from 'node:test';
import { userDisplay } from './user-display.ts';

test('prefers the saved display name over provider identity', () => {
  assert.deepEqual(
    userDisplay({
      email: 'learner@example.com',
      user_metadata: {
        display_name: '  Alex Lee ',
        full_name: 'Old Name',
        avatar_url: 'https://example.com/photo.png',
      },
    }),
    { name: 'Alex Lee', initials: 'AL', avatar: 'https://example.com/photo.png' }
  );
});
test('handles malformed provider metadata and unsafe image URLs', () => {
  const result = userDisplay({
    email: 'alex@example.com',
    user_metadata: { display_name: {}, name: 42, avatar_url: 'javascript:alert(1)' },
  });
  assert.equal(result.name, 'alex');
  assert.equal(result.avatar, undefined);
});
test('falls back for guests and supports Unicode names', () => {
  assert.equal(userDisplay(null).name, 'Learner');
  assert.equal(
    userDisplay({ user_metadata: { name: '李 明' }, email: undefined }).initials,
    '李明'
  );
});
