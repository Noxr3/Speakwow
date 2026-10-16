import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogHref, catalogPages, catalogParams, catalogPattern } from './course-catalog.ts';

test('catalogue bounds pagination and handles malformed URL state', () => {
  assert.deepEqual(catalogParams({ q: '  英语  ', page: '2' }), {
    q: '英语',
    page: 2,
    from: 6,
    to: 11,
  });
  for (const page of ['-1', '0', '1.5', 'NaN', '1000000', ['2']]) {
    assert.equal(catalogParams({ page }).page, 1);
  }
  assert.equal(catalogParams({ q: 'x'.repeat(200) }).q.length, 120);
});

test('search stays literal and page links preserve Unicode and reserved characters', () => {
  assert.equal(catalogPattern('50%_\\'), '%50\\%\\_\\\\%');
  const link = catalogHref('英语 & science', 2);
  const url = new URL(link, 'http://localhost');
  assert.equal(url.searchParams.get('q'), '英语 & science');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(catalogHref('', 1), '/profile#courses');
});

test('large catalogues show a bounded page window with both ends reachable', () => {
  assert.deepEqual(catalogPages(50, 100), [1, 'gap', 49, 50, 51, 'gap', 100]);
  assert.deepEqual(catalogPages(1, 1), [1]);
  assert.deepEqual(catalogPages(2, 3), [1, 2, 3]);
});
