import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveCallCourse } from './call-course.ts';
import { isSameOriginJson } from './request-origin.ts';

const course = 'cc120000-0000-4000-8000-000000000001';
const unit = 'dd120000-0000-4000-8000-000000000001';

test('starting a requested unit requires a successful atomic course selection', async () => {
  const calls: unknown[] = [];
  const client = {
    rpc: async (...args: unknown[]) => {
      calls.push(args);
      return { error: null };
    },
  } as unknown as SupabaseClient;
  assert.deepEqual(
    await resolveCallCourse(client, 'student', { course_id: course, unit_id: unit }),
    { courseId: course, unitId: unit }
  );
  assert.deepEqual(calls, [['select_course', { p_course: course, p_unit: unit }]]);
  const denied = {
    rpc: async () => ({ error: { message: 'Unit belongs to another course' } }),
  } as unknown as SupabaseClient;
  assert.equal(
    await resolveCallCourse(denied, 'student', { course_id: course, unit_id: unit }),
    null
  );
});
test('invalid course or unit cannot be copied into signed dispatch metadata', async () => {
  const client = {
    rpc: () => {
      throw new Error('must not query');
    },
  } as unknown as SupabaseClient;
  for (const choice of [
    { course_id: 'invalid', unit_id: unit },
    { course_id: course, unit_id: null },
    { course_id: course, unit_id: 2 },
  ])
    assert.equal(await resolveCallCourse(client, 'student', choice), null);
});
test('legacy calls read only the authenticated student and requested course', async () => {
  const filters: unknown[] = [];
  const builder = {
    select: () => builder,
    eq: (...args: unknown[]) => {
      filters.push(args);
      return builder;
    },
    maybeSingle: async () => ({ data: { course_id: course, current_unit_id: unit }, error: null }),
  };
  const client = {
    from: (table: string) => {
      assert.equal(table, 'enrollments');
      return builder;
    },
  } as unknown as SupabaseClient;
  assert.deepEqual(await resolveCallCourse(client, 'student', { course_id: course }), {
    courseId: course,
    unitId: unit,
  });
  assert.deepEqual(filters, [
    ['student_id', 'student'],
    ['course_id', course],
  ]);
});
test('JSON mutation endpoints reject cross-origin and form submissions', () => {
  const req = (origin: string, type: string) =>
    new Request('https://speakwow.ai/api/connection-details', {
      method: 'POST',
      headers: { origin, 'Content-Type': type },
    });
  assert.equal(isSameOriginJson(req('https://evil.example', 'application/json')), false);
  assert.equal(isSameOriginJson(req('https://speakwow.ai', 'text/plain')), false);
  assert.equal(
    isSameOriginJson(req('https://speakwow.ai', 'application/json; charset=utf-8')),
    true
  );
});
