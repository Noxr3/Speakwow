#!/usr/bin/env node
// Imports courses from courses/ into Supabase (courses + course_units),
// upserted by slug and unit position, so running it again updates in place and
// keeps every student's progress. A course with any problem in
// `pnpm courses:check` is refused.
//
//   pnpm course:import courses/yilin-2024-7a
//   pnpm course:import --all
//   pnpm course:import courses/yilin-2024-7a --dry-run    # print the rows
//
// Env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY.
import { checkCourse, courseDirs, loadCourse, toRows } from './courses.mjs';

async function rest(path, init) {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(
    /\/$/,
    ''
  );
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  const res = await fetch(`${url}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
      ...init?.headers,
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

export async function importCourse(dir, { dryRun = false, send = rest } = {}) {
  const course = loadCourse(dir);
  const problems = checkCourse(course);
  if (problems.length) {
    throw new Error(`${course.slug} has problems; fix them first:\n${problems.join('\n')}`);
  }
  const rows = toRows(course);
  if (dryRun) return rows;
  const [saved] = await send('/courses?on_conflict=slug', {
    method: 'POST',
    body: JSON.stringify({
      ...rows.course,
      updated_at: new Date().toISOString(),
    }),
  });
  await send('/course_units?on_conflict=course_id,position', {
    method: 'POST',
    body: JSON.stringify(rows.units.map((u) => ({ ...u, course_id: saved.id }))),
  });
  return rows;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const dirs = args.includes('--all') ? courseDirs() : args.filter((a) => !a.startsWith('--'));
  if (!dirs.length) {
    console.error('usage: course-import <courses/slug> [...] | --all  [--dry-run]');
    process.exit(2);
  }
  for (const dir of dirs) {
    const rows = await importCourse(dir, { dryRun });
    if (dryRun) console.log(JSON.stringify(rows, null, 2));
    else console.log(`Imported "${rows.course.title}" (${rows.units.length} units).`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
