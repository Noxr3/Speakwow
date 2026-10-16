import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogHref } from './course-catalog.ts';
import { safeNext } from './courses.ts';

test('sign-in only returns to a page on this site', () => {
  assert.equal(safeNext('/courses'), '/courses');
  assert.equal(safeNext('//evil.example'), '/');
  assert.equal(safeNext('/\\evil.example'), '/');
  assert.equal(safeNext('https://evil.example'), '/');
  assert.equal(safeNext(null), '/');
});

test('the catalog links stay on the page it sits on', () => {
  assert.equal(catalogHref('译林', 2, '/courses'), '/courses?q=%E8%AF%91%E6%9E%97&page=2#courses');
  assert.equal(catalogHref('', 1), '/profile#courses');
});
