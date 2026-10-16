import assert from 'node:assert/strict';
import { test } from 'node:test';
import { READY_SUBJECTS, gradeLabel, safeNext, subjectLabel } from './courses.ts';

test('sign-in only returns to a page on this site', () => {
  assert.equal(safeNext('/courses'), '/courses');
  assert.equal(safeNext('//evil.example'), '/');
  assert.equal(safeNext('/\\evil.example'), '/');
  assert.equal(safeNext('https://evil.example'), '/');
  assert.equal(safeNext(null), '/');
});

test('subjects and grades read like words', () => {
  assert.equal(subjectLabel('english'), 'English');
  assert.equal(subjectLabel('venture-fundraising'), 'Fundraising');
  assert.equal(subjectLabel('music-theory'), 'music theory');
  assert.equal(gradeLabel('7'), 'Grade 7');
  assert.equal(gradeLabel(null), null);
});

test('only language courses are offered for now', () => {
  assert.ok(READY_SUBJECTS.has('english'));
  assert.ok(!READY_SUBJECTS.has('venture-fundraising'));
});
