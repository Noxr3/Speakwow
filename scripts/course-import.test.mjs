import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseGoal, splitList, unitsFromDokkiTable } from './course-import.mjs';

test('list cells split on lines, commas and Chinese separators, not inside numbers', () => {
  assert.deepEqual(splitList('hobby, classmate\nafter school；play football、swim'), [
    'hobby',
    'classmate',
    'after school',
    'play football',
    'swim',
  ]);
  assert.deepEqual(splitList('1,000 steps'), ['1,000 steps']);
  assert.deepEqual(splitList(undefined), []);
});

test('goals get stable ids and an optional kind', () => {
  assert.deepEqual(parseGoal('[grammar] Use am / is / are', 1, 0), {
    id: 'u1-g1',
    kind: 'grammar',
    text: 'Use am / is / are',
  });
  assert.equal(parseGoal('Introduce yourself', 2, 1).kind, 'speaking');
  assert.equal(parseGoal('[unknown] x', 2, 1).kind, 'speaking');
});

test('a Dokki table becomes ordered units by column header', () => {
  const table = {
    id: 'tbl',
    json_content: {
      columns: [
        { id: 'c1', headerName: 'Unit' },
        { id: 'c2', headerName: 'Title' },
        { id: 'c3', headerName: 'Goals' },
        { id: 'c4', headerName: 'Vocabulary' },
        { id: 'c5', headerName: 'theme' },
      ],
      rows: [
        { id: 'r2', c1: '2', c2: 'Hobbies', c3: 'Talk about hobbies', c4: 'hobby' },
        { id: 'r1', c1: 1, c2: 'This is me!', c3: 'Introduce yourself\n[grammar] Use be', c5: '人与自我' },
        { id: 'r3', c1: '', c2: 'No unit number' },
      ],
    },
  };
  const units = unitsFromDokkiTable(table);
  assert.deepEqual(
    units.map((u) => [u.position, u.title]),
    [
      [1, 'This is me!'],
      [2, 'Hobbies'],
    ]
  );
  assert.equal(units[0].theme, '人与自我');
  assert.deepEqual(units[0].goals[1], { id: 'u1-g2', kind: 'grammar', text: 'Use be' });
  assert.equal(units[0].source_ref, 'dokki:tbl#r1');
});
