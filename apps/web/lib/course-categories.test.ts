import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COURSE_CATEGORIES,
  categoryHref,
  courseCategory,
  findCourseCategory,
} from './course-categories.ts';

test('classifies existing series by stable slug and textbook grade', () => {
  for (const slug of [
    'everyday-conversations',
    'picture-conversations',
    'pronunciation-rhythm',
    'listen-and-write',
    'words-in-use',
    'read-and-discover',
    'writing-workshop',
    'storytelling',
  ]) {
    assert.equal(courseCategory({ slug }), 'adult-english');
  }
  for (const grade of ['7', '8']) {
    assert.equal(courseCategory({ slug: 'a-renamed-title', grade }), 'school-english');
  }
  assert.equal(courseCategory({ slug: 'ielts-speaking', grade: '12' }), 'ielts-toefl');
  assert.equal(courseCategory({ slug: 'toefl' }), 'ielts-toefl');
});

test('uncategorized courses stay discoverable without being labelled adult or exam courses', () => {
  assert.equal(courseCategory({ slug: 'children-stories' }), 'more-english');
  assert.equal(courseCategory({ grade: '  ' }), 'more-english');
  assert.equal(courseCategory({ slug: 'toeflish' }), 'more-english');
});

test('category URLs round-trip and malformed categories fall back to the category directory', () => {
  for (const category of COURSE_CATEGORIES) {
    const url = new URL(categoryHref(category.id), 'https://example.test');
    assert.equal(
      findCourseCategory(url.searchParams.get('category') ?? undefined)?.id,
      category.id
    );
  }
  for (const value of [undefined, '', 'unknown', ['adult-english']]) {
    assert.equal(findCourseCategory(value), null);
  }
});

test('CEFR filters include range endpoints and never infer CEFR from school grade', async () => {
  const { matchesCourseLevel, courseLevelLabel, courseLevelHref, findCefrLevel } = await import(
    './course-categories.ts'
  );
  assert.equal(matchesCourseLevel({ slug: 'listen-and-write' }, 'A1'), true);
  assert.equal(matchesCourseLevel({ slug: 'listen-and-write' }, 'A2'), true);
  assert.equal(matchesCourseLevel({ slug: 'listen-and-write' }, 'B1'), false);
  assert.equal(matchesCourseLevel({ slug: 'storytelling' }, 'B1'), true);
  assert.equal(matchesCourseLevel({ slug: 'storytelling' }, 'A2'), false);
  assert.equal(matchesCourseLevel({ slug: 'yilin-2024-7a' }, 'A1'), false);
  assert.equal(courseLevelLabel({ slug: 'yilin-2024-7a', grade: '7' }), 'Grade 7');
  assert.equal(courseLevelLabel({ slug: 'unknown' }), 'Level not yet mapped');
  assert.equal(matchesCourseLevel({ slug: 'unknown' }, null), true);
  assert.equal(findCefrLevel('B3'), null);
  assert.equal(courseLevelHref('adult-english', 'A2'), '/courses?category=adult-english&level=A2');
  assert.equal(courseLevelHref(null, null), '/courses');
});
