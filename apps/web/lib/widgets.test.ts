import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  type Widget,
  cardEvent,
  gradeCard,
  normAnswer,
  parseCardUpdate,
  parseWidget,
  rightAnswer,
} from './widgets.ts';

const CASES = JSON.parse(
  readFileSync(new URL('../../agent/tests/card_cases.json', import.meta.url), 'utf8')
) as { cards: Record<string, Partial<Widget>>; cases: [string, string, boolean | null][] };

test('parses a valid card and drops unknown fields and kinds', () => {
  const w = parseWidget(
    JSON.stringify({
      type: 'widget',
      id: 'w1',
      kind: 'choice',
      question: 'Q?',
      options: ['a', 2, 'b'],
      answer: [1],
      max_attempts: 2,
      evil: '<script>',
    })
  );
  assert.deepEqual(w?.options, ['a', 'b']);
  assert.deepEqual(w?.answer, [1]);
  assert.equal(w?.maxAttempts, 2);
  assert.equal((w as unknown as Record<string, unknown>).evil, undefined);
  assert.equal(parseWidget(JSON.stringify({ type: 'widget', kind: 'iframe' })), null);
  assert.equal(parseWidget('not json'), null);
  const quiz = parseWidget(
    JSON.stringify({
      type: 'widget',
      id: 'q',
      kind: 'quiz',
      questions: [
        { question: '1+1?', options: ['2', '3'], answer: [0] },
        { question: 'bad', options: ['x'], answer: [0] },
      ],
    })
  );
  assert.equal(quiz?.questions?.length, 1);
});

test('the phone grades exactly as the agent does (shared cases)', () => {
  for (const [name, given, expected] of CASES.cases) {
    const card = { id: name, maxAttempts: 2, ...CASES.cards[name] } as Widget;
    assert.equal(gradeCard(card, given), expected, `${name}: ${given}`);
  }
  assert.equal(normAnswer('“Went！”'), 'went');
});

test('a spoken mark arrives as an update, and taps go out as events', () => {
  const update = parseCardUpdate(
    JSON.stringify({
      type: 'card_update',
      card_id: 'c1',
      given: 'B',
      correct: true,
      attempt: 1,
      final: true,
    })
  );
  assert.deepEqual(update, { cardId: 'c1', given: 'B', correct: true, attempt: 1, final: true });
  const card = {
    id: 'c1',
    kind: 'choice',
    options: ['go', 'went'],
    answer: [1],
    maxAttempts: 1,
  } as Widget;
  assert.equal(rightAnswer(card), 'went');
  assert.deepEqual(JSON.parse(cardEvent(card, { action: 'answer', given: 'go' })), {
    type: 'card_event',
    card_id: 'c1',
    action: 'answer',
    given: 'go',
  });
});
