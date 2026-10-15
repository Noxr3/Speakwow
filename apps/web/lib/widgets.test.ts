import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answerMessage, parseWidget, sameAnswer } from './widgets.ts';

test('parses a valid widget and drops unknown fields and kinds', () => {
  const w = parseWidget(
    JSON.stringify({
      type: 'widget',
      id: 'w1',
      kind: 'choice',
      question: 'Q?',
      options: ['a', 2, 'b'],
      evil: '<script>',
    })
  );
  assert.deepEqual(w?.options, ['a', 'b']);
  assert.equal((w as unknown as Record<string, unknown>).evil, undefined);
  assert.equal(parseWidget(JSON.stringify({ type: 'widget', kind: 'iframe' })), null);
  assert.equal(parseWidget('not json'), null);
  assert.equal(
    parseWidget(new TextEncoder().encode(JSON.stringify({ type: 'sticker', id: 'x' }))),
    null
  );
});

test('answers compare loosely and become a teacher-readable line', () => {
  assert.equal(sameAnswer(' I  went home. ', 'i went home'), true);
  assert.equal(sameAnswer('I goed home', 'I went home'), false);
  assert.equal(sameAnswer('anything', undefined), null);
  const w = { id: 'w', kind: 'fill_blank' as const };
  assert.equal(answerMessage(w, 'went', true), '[widget fill_blank] went (correct)');
  assert.equal(answerMessage(w, 'went', null), '[widget fill_blank] went');
});
