import assert from 'node:assert/strict';
import test from 'node:test';
import { personalizeCourses, publicCourse } from './course-library.ts';

const raw = {
  id: 'c1',
  slug: 'english',
  grade: null,
  title: 'English',
  description: null,
  units: [
    {
      id: 'u1',
      title: 'Hello',
      position: 1,
      goals: [{ id: 'g1', text: 'Greet someone' }],
      sessions: [
        {
          id: 's1',
          title: 'Greeting',
          kind: 'lesson',
          activity: 'talk',
          goal_ids: ['g1'],
          minutes: 10,
          teacher_prompt: 'very long teacher instructions',
          materials: { answer: 'secret exercise answer' },
        },
      ],
    },
  ],
};

test('navigation summaries omit teaching payload and preserve stable session IDs', () => {
  const course = publicCourse(raw);
  assert.equal(course.units[0].sessions[0].id, 's1');
  assert.equal(course.units[0].description, 'Greet someone');
  assert.equal(JSON.stringify(course).includes('teacher_prompt'), false);
  assert.equal(JSON.stringify(course).includes('secret exercise answer'), false);
});
test('two students cannot contaminate each other through the cached public catalog', () => {
  const catalog = [publicCourse(raw)];
  Object.freeze(catalog[0]);
  Object.freeze(catalog[0].units[0]);
  const a = personalizeCourses(
    catalog,
    [{ course_id: 'c1', current_unit_id: 'u1', status: 'active' }],
    [{ unit_id: 'u1', status: 'mastered' }]
  );
  const b = personalizeCourses(catalog, [], []);
  assert.equal(a.courses[0].units[0].progress?.status, 'mastered');
  assert.equal(b.courses[0].units[0].progress, undefined);
  assert.equal(b.selectedId, null);
  assert.equal(b.courses[0].started, false);
  assert.equal(catalog[0].units[0].progress, undefined);
});
test('home only receives the selected course; new users get an empty selection', () => {
  const catalog = [publicCourse(raw), publicCourse({ ...raw, id: 'c2' })];
  assert.deepEqual(
    personalizeCourses(
      catalog,
      [{ course_id: 'c2', current_unit_id: 'u1', status: 'active' }],
      [],
      true
    ).courses.map((c) => c.id),
    ['c2']
  );
  assert.deepEqual(personalizeCourses(catalog, [], [], true).courses, []);
});
