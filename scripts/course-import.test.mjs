import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { importCourse } from './course-import.mjs';
import { ROOT } from './courses.mjs';

test('a dry run returns the rows without writing anything', async () => {
  const rows = await importCourse(join(ROOT, 'yilin-2024-7a'), {
    dryRun: true,
    send: () => assert.fail('a dry run must not write'),
  });
  assert.equal(rows.course.slug, 'yilin-2024-7a');
  assert.equal(rows.course.source_ref, 'courses/yilin-2024-7a');
  assert.equal(rows.units.length, 8);
  assert.equal(rows.units[0].goals[0].id, 'u1-g1');
  assert.ok(rows.units[0].content.terms.includes('classmate'));
});

test('a course is upserted by slug, then its units by position', async () => {
  const calls = [];
  const send = async (path, init) => {
    calls.push({ path, body: JSON.parse(init.body) });
    return path.startsWith('/courses') ? [{ id: 'course-1' }] : [];
  };
  await importCourse(join(ROOT, 'yilin-2025-8b'), { send });
  assert.equal(calls[0].path, '/courses?on_conflict=slug');
  assert.equal(calls[0].body.slug, 'yilin-2025-8b');
  assert.equal(calls[1].path, '/course_units?on_conflict=course_id,position');
  assert.ok(calls[1].body.every((u) => u.course_id === 'course-1'));
  assert.deepEqual(
    calls[1].body.map((u) => u.position),
    [1, 2, 3, 4, 5, 6, 7, 8]
  );
});
