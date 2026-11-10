import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMaterial } from './study-material.ts';
import { completedSessions, coursePosition, studySessions } from './study-plan.ts';

test('old units get stable sessions, and previously mastered work stays complete', () => {
  const sessions = studySessions({}, [{ id: 'u1-g1' }]);
  assert.deepEqual(
    sessions.map((s) => s.id),
    ['learn', 'practice', 'check']
  );
  assert.equal(completedSessions(sessions, { status: 'mastered' }), 3);
  assert.equal(
    completedSessions(sessions, {
      session_progress: { learn: { status: 'mastered', mastery: 1 } },
    }),
    1
  );
});
test('each course keeps its own place and session progress', () => {
  const sessions = studySessions({});
  const course = {
    id: 'c',
    title: 'Course',
    description: '',
    started: true,
    currentUnitId: 'u2',
    units: [
      { id: 'u1', title: 'First', position: 1, sessions, progress: { status: 'mastered' } },
      {
        id: 'u2',
        title: 'Next',
        position: 2,
        sessions,
        progress: { session_progress: { learn: { status: 'mastered', mastery: 1 } } },
      },
    ],
  };
  const position = coursePosition(course);
  assert.equal(position.completed, 4);
  assert.equal(position.total, 6);
  assert.equal(position.unit?.id, 'u2');
  assert.equal(position.session?.id, 'practice');
});
test('dictation hides answers and pictures only use bundled scenes', () => {
  const encode = (value: object) => new TextEncoder().encode(JSON.stringify(value));
  assert.equal(
    parseMaterial(encode({ type: 'material', kind: 'dictation', title: 'Listen', text: 'answer' }))
      ?.text,
    ''
  );
  assert.equal(
    parseMaterial(
      encode({ type: 'material', kind: 'picture', title: 'Look', scene: 'https://untrusted.test' })
    ),
    null
  );
  assert.equal(
    parseMaterial(encode({ type: 'material', kind: 'picture', title: 'Look', scene: 'park' }))
      ?.scene,
    'park'
  );
});
