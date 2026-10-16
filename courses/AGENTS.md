# Courses: rules for people and AI agents

This folder is a small wiki the teacher teaches from. Anyone can add a course
or improve a unit with a pull request: teachers, students, and AI agents
working for them. These rules keep it trustworthy; `pnpm courses:check`
enforces the ones a machine can check, and CI runs it on every change.

## Layout

```
courses/
  AGENTS.md                 these rules
  README.md                 the list of courses
  schema/                   what the front matter may contain
  <slug>/                   one course
    index.md                the course (front matter) and its unit list
    log.md                  every change, newest first
    units/
      01-short-title.md     one unit per page
      02-…
```

A page is Markdown with YAML front matter between `---` lines. The front
matter is the part the app uses: the teacher reads it during a lesson and
scores the goals afterwards. The body is free notes for people and for the
teacher: what students find hard, ideas that worked. Field meanings are in
`schema/course.schema.json` and `schema/unit.schema.json`; editors that read
JSON Schema show them as you type.

## Any subject

A course can teach anything that can be taught by talking: a language, maths,
science, history, music theory, programming. The fields are deliberately
neutral:

| Field | In a language course | In another subject |
|---|---|---|
| `terms` | vocabulary | terminology |
| `points` | grammar points | concepts, rules, formulas |
| `activities` | speaking tasks, role plays | explain a step, argue a question, talk through a problem |
| `pitfalls` | typical mistakes | typical misconceptions |
| goal `kind` | speaking, listening, reading, writing, vocabulary, grammar, pronunciation | concept, skill, application, reasoning |

Write goals as things a student can do, starting with a verb: "Explain why
the moon has phases", not "Phases of the moon".

**Cite where the content comes from** in `sources` (on a unit, or on the
course in `index.md`): a title, and a URL, author and date when there is one.
A course built on someone's published ideas, say a firm's essays on how to
raise money, cites each essay and states its ideas in the course's own words.

## Rules

1. **Outlines and notes only.** Titles, topics, goals, short word lists and
   grammar or concept points are fine. Never copy passages, dialogues,
   worked examples, exercises or answers from a textbook or any other
   copyrighted source. Write activities yourself, and put ideas in your own
   words with the source in `sources`. A paragraph longer than 600
   characters fails the check.
2. **Ids are forever.** A course's `slug` and a goal's `id` (`u3-g2`) are
   where students' progress is stored. Never rename them or reuse a goal id
   for a different goal. To retire a goal, delete it; the next new goal gets
   the next unused number.
3. **Units keep their place.** `position` must match the file number and run
   1, 2, 3… Add new units at the end; reordering published units moves
   students' progress to the wrong unit.
4. **Say how sure you are.** Every unit has `review.status`:
   `draft` (not checked), `cross-checked` (matched against at least two
   independent sources) or `source-checked` (checked against the textbook
   itself or another primary source). Say what you checked in
   `review.notes`. Raise a status only when you did the checking.
5. **Log every change** in the course's `log.md`, newest first:
   `- 2026-10-16 · What changed and why · #PR`.
6. **Don't edit the unit list by hand.** The table between the `units:start`
   and `units:end` markers in `index.md` is generated: run
   `pnpm courses:index` after adding or retitling a unit.

## Workflows

**Fix or improve a unit.** Edit its page, update `review` if you checked
something, add a line to `log.md`, run `pnpm courses:check`, open a PR.

**Add a course.**
1. Pick a slug: lowercase words with dashes, e.g. `pep-2024-math-7a`.
2. Copy an existing course folder's `index.md` and `log.md` as a start, and
   fill in the front matter (`subject`, `teaching_language`, and the textbook
   fields if it follows a book).
3. Write one page per unit in `units/`, starting at `01-`. Mark them `draft`
   unless you checked them.
4. Run `pnpm courses:index` and `pnpm courses:check`, then open a PR.

**Agents.** When asked to draft or update a course: work from the user's own
notes, a table of contents or public curriculum documents; cite what you used
in `review.notes`; mark everything you did not verify as `draft`; never
paste source text; and run both commands before you finish.

## From the repo to the app

After a PR is merged, a maintainer imports the course into the database:
`pnpm course:import courses/<slug>` (or `--all`). It refuses a course that
fails the checks, and updates units in place, so students keep their progress.
