import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkCourse, courseDirs, loadCourse, parsePage, toRows, unitTable } from './courses.mjs';

test('every course in courses/ passes the checks', () => {
  const dirs = courseDirs();
  assert.ok(dirs.length >= 4);
  for (const dir of dirs) {
    assert.deepEqual(checkCourse(loadCourse(dir)), [], dir);
  }
});

const INDEX = `---
slug: plants
title: How plants live
description: A tiny course used by the tests.
subject: biology
teaching_language: en
---

# How plants live

<!-- units:start -->
<!-- units:end -->
`;

const UNIT = `---
position: 1
title: Light into food
goals:
  - id: u1-g1
    kind: concept
    text: Explain how a leaf makes food from light
terms: [photosynthesis, chlorophyll]
points: [plants turn light into sugar]
activities: [explain why leaves are green]
pitfalls: [thinking plants eat soil]
sources:
  - title: Photosynthesis
    url: https://en.wikipedia.org/wiki/Photosynthesis
review:
  status: draft
---

# Unit 1 · Light into food
`;

/** A valid one-unit course in a temp folder, and helpers to break it. */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'courses-'));
  const dir = join(root, 'plants');
  mkdirSync(join(dir, 'units'), { recursive: true });
  writeFileSync(join(dir, 'units', '01-light-into-food.md'), UNIT);
  writeFileSync(join(dir, 'log.md'), '# Change log\n');
  const course = loadCourse(dir);
  writeFileSync(
    join(dir, 'index.md'),
    INDEX.replace(/<!-- units:start -->\n<!-- units:end -->/, unitTable(course.units))
  );
  const unitPath = join(dir, 'units', '01-light-into-food.md');
  return {
    dir,
    problems: () => checkCourse(loadCourse(dir)),
    editUnit: (from, to) =>
      writeFileSync(unitPath, readFileSync(unitPath, 'utf8').replace(from, to)),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

test('a course of any subject is valid with subject-neutral fields', () => {
  const f = fixture();
  try {
    assert.deepEqual(f.problems(), []);
    const rows = toRows(loadCourse(f.dir));
    assert.equal(rows.course.subject, 'biology');
    assert.deepEqual(rows.units[0].content, {
      terms: ['photosynthesis', 'chlorophyll'],
      points: ['plants turn light into sugar'],
      activities: ['explain why leaves are green'],
      pitfalls: ['thinking plants eat soil'],
      sources: [
        {
          title: 'Photosynthesis',
          url: 'https://en.wikipedia.org/wiki/Photosynthesis',
        },
      ],
    });
  } finally {
    f.cleanup();
  }
});

test('each rule catches the mistake it is for', () => {
  const cases = [
    [
      'a goal id from another unit',
      (f) => f.editUnit('id: u1-g1', 'id: u2-g1'),
      /must start with u1-/,
    ],
    [
      'a position that does not match the file',
      (f) => f.editUnit('position: 1', 'position: 2'),
      /does not match the file number/,
    ],
    [
      'a repeated term',
      (f) => f.editUnit('chlorophyll]', 'chlorophyll, Photosynthesis]'),
      /appears twice in terms/,
    ],
    [
      'an unknown field',
      (f) => f.editUnit('review:', 'vocab: [x]\nreview:'),
      /must NOT have additional properties/,
    ],
    [
      'a missing review',
      (f) => f.editUnit(/review:\n {2}status: draft\n/, ''),
      /must have required property 'review'/,
    ],
    [
      'a source without a web address',
      (f) => f.editUnit('url: https://', 'url: ftp://'),
      /must match pattern/,
    ],
    [
      'a pasted passage',
      (f) =>
        f.editUnit(
          '# Unit 1 · Light into food',
          `# Unit 1\n\n${'Once upon a time a leaf. '.repeat(30)}`
        ),
      /never textbook text/,
    ],
    [
      'a stale unit list',
      (f) => f.editUnit('title: Light into food', 'title: Light into sugar'),
      /out of date; run pnpm courses:index/,
    ],
    ['a missing log', (f) => rmSync(join(f.dir, 'log.md')), /every course keeps a change log/],
    [
      'a badly named page',
      (f) =>
        renameSync(
          join(f.dir, 'units', '01-light-into-food.md'),
          join(f.dir, 'units', '1 Light.md')
        ),
      /name it NN-short-title.md/,
    ],
  ];
  for (const [what, breakIt, expected] of cases) {
    const f = fixture();
    try {
      breakIt(f);
      const problems = f.problems().join('\n');
      assert.match(problems, expected, what);
    } finally {
      f.cleanup();
    }
  }
});

test('positions run without gaps', () => {
  const f = fixture();
  try {
    writeFileSync(
      join(f.dir, 'units', '03-later.md'),
      UNIT.replace('position: 1', 'position: 3').replace('u1-g1', 'u3-g1')
    );
    assert.match(f.problems().join('\n'), /without gaps or repeats \(found 1, 3\)/);
  } finally {
    f.cleanup();
  }
});

test('front matter is read and the body kept apart', () => {
  const { data, body } = parsePage(UNIT);
  assert.equal(data.goals[0].id, 'u1-g1');
  assert.match(body, /^\n# Unit 1/);
  assert.equal(parsePage('no front matter').data, null);
});
