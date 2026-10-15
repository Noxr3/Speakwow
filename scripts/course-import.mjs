#!/usr/bin/env node
// Imports a course into Supabase: courses + course_units, upserted by slug and
// unit position, so running it again updates in place and keeps every
// student's progress.
//
//   pnpm course:import packages/shared/courses/yilin-2024-7a.json
//   pnpm course:import packages/shared/courses/yilin-2024-7a.json --from-dokki <tableResourceId>
//   pnpm course:import <file> --dry-run          # print what would be written
//
// Env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY.
// With --from-dokki the units come from a table in Dokki (https://dokki.one),
// so teachers can maintain the textbook as a shared, AI-searchable knowledge
// base: DOKKI_API_KEY (scope content:read), DOKKI_BASE_URL (default
// https://dokki.one). The course file still supplies the course's own fields.
//
// The Dokki table needs one row per unit with these column headers (any order,
// extra columns ignored). List cells take one item per line or comma-separated:
//   Unit | Title | Title (中文) | Theme | Topic | Goals | Vocabulary | Grammar |
//   Functions | Speaking tasks
// A goal line may start with a kind in brackets: "[grammar] Use be correctly".
import { readFileSync } from 'node:fs';

const GOAL_KINDS = new Set(['speaking', 'grammar', 'vocabulary', 'function', 'listening', 'reading']);

export function splitList(cell) {
  if (cell == null) return [];
  return String(cell)
    .split(/\r?\n|(?<!\d),(?!\d)|[；;，、]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseGoal(text, unit, index) {
  const match = /^\[(\w+)\]\s*(.+)$/.exec(text);
  const kind = match && GOAL_KINDS.has(match[1].toLowerCase()) ? match[1].toLowerCase() : 'speaking';
  return { id: `u${unit}-g${index + 1}`, kind, text: match ? match[2] : text };
}

/** Dokki table rows -> course units, by column header. */
export function unitsFromDokkiTable(table) {
  const columns = table.json_content?.columns ?? [];
  const idByHeader = new Map(columns.map((c) => [String(c.headerName).trim().toLowerCase(), c.id]));
  const cell = (row, header) => {
    const id = idByHeader.get(header.toLowerCase());
    return id === undefined ? undefined : row[id];
  };
  return (table.json_content?.rows ?? [])
    .map((row) => {
      const position = Number.parseInt(cell(row, 'Unit'), 10);
      const title = String(cell(row, 'Title') ?? '').trim();
      if (!Number.isInteger(position) || !title) return null;
      return {
        position,
        title,
        title_zh: String(cell(row, 'Title (中文)') ?? '').trim() || undefined,
        theme: String(cell(row, 'Theme') ?? '').trim() || null,
        topic: String(cell(row, 'Topic') ?? '').trim() || null,
        goals: splitList(cell(row, 'Goals')).map((g, i) => parseGoal(g, position, i)),
        content: {
          vocabulary: splitList(cell(row, 'Vocabulary')),
          grammar: splitList(cell(row, 'Grammar')),
          functions: splitList(cell(row, 'Functions')),
          speaking_tasks: splitList(cell(row, 'Speaking tasks')),
        },
        source_ref: row.id ? `dokki:${table.id ?? ''}#${row.id}` : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.position - b.position);
}

async function readDokkiTable(resourceId) {
  const base = (process.env.DOKKI_BASE_URL || 'https://dokki.one').replace(/\/$/, '');
  const key = process.env.DOKKI_API_KEY;
  if (!key) throw new Error('DOKKI_API_KEY is required with --from-dokki');
  const res = await fetch(`${base}/api/v1/resources/${resourceId}/content`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Dokki ${res.status}: ${body.error?.message ?? body.error ?? 'request failed'}`);
  if (body.content?.type !== 'table') throw new Error('That Dokki resource is not a table');
  return body.content.table;
}

async function rest(path, init) {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
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

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--from-dokki');
  const dryRun = args.includes('--dry-run');
  const dokkiTable = args.includes('--from-dokki') ? args[args.indexOf('--from-dokki') + 1] : null;
  if (!file) {
    console.error('usage: course-import <course.json> [--from-dokki <tableResourceId>] [--dry-run]');
    process.exit(2);
  }
  const course = JSON.parse(readFileSync(file, 'utf8'));
  let units = course.units ?? [];
  let source = 'repo';
  let sourceRef = null;
  if (dokkiTable) {
    const table = await readDokkiTable(dokkiTable);
    units = unitsFromDokkiTable({ ...table, id: dokkiTable });
    source = 'dokki';
    sourceRef = dokkiTable;
  }
  if (!units.length) throw new Error('No units found');

  const courseRow = {
    slug: course.slug,
    title: course.title,
    description: course.description ?? null,
    subject: course.subject ?? 'english',
    grade: course.grade ?? null,
    term: course.term ?? null,
    region: course.region ?? null,
    publisher: course.publisher ?? null,
    edition: course.edition ?? null,
    standard: course.standard ?? null,
    source,
    source_ref: sourceRef,
    updated_at: new Date().toISOString(),
  };

  if (dryRun) {
    console.log(JSON.stringify({ course: courseRow, units }, null, 2));
    return;
  }

  const [saved] = await rest('/courses?on_conflict=slug', {
    method: 'POST',
    body: JSON.stringify(courseRow),
  });
  await rest('/course_units?on_conflict=course_id,position', {
    method: 'POST',
    body: JSON.stringify(
      units.map((u) => ({
        course_id: saved.id,
        position: u.position,
        title: u.title,
        theme: u.theme ?? null,
        topic: u.topic ?? null,
        goals: u.goals ?? [],
        content: u.content ?? {},
        source_ref: u.source_ref ?? null,
      }))
    ),
  });
  console.log(`Imported "${saved.title}" (${units.length} units) from ${source}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
