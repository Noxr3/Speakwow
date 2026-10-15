# Contributing to Speakwow

Thanks for helping build a teacher who remembers people. Small, focused pull
requests are the easiest to review and merge.

## Setting up

Follow the quick start in the [README](README.md). Then:

```bash
# agent
cd apps/agent && uv run ruff check && uv run pytest -m "not live"
# web
pnpm --filter @speakwow/web lint && pnpm --filter @speakwow/web test && pnpm --filter @speakwow/web build
# scripts
pnpm test:scripts
```

`pytest -m live` runs the tests that call a real model; CI skips them.
Migrations and `supabase/tests/*.sql` run in CI against a fresh Postgres.

## Good ways to start

### Add a teacher (no Python or React needed)

1. Copy `packages/shared/personas/frank.json` to `packages/shared/personas/<id>.json`.
2. Write who they are: `personality` (how they talk), `tagline_en`,
   `specialty_en`, `voices` per provider, a few `openings`, `guidance_style`, and
   a `life` with two to five storylines. Each storyline has a `headline` (shown on
   the picker) and a list of beats; one beat plays every three days.
3. Give them a card: `look.colors` (two colours that glow well on black) and
   `look.motif`, the animated voiceprint (`bars`, `wave`, `rings`, `dots`,
   `pixels`, `radial`, `flame`, `orbit`, `strings`, `ripple`, or add a new one in
   `apps/web/lib/teacher-card.ts`). Check it on `/playground`.
4. Write a `sample_line` and generate their voice: `pnpm voices:generate --only <id>`.
5. Register the card in `packages/shared/index.ts` (`PERSONA_CARDS`).
6. Run `pnpm shared:sync` (the agent's Docker image carries a copy) and the tests.

Personas set the voice and the flavour. They cannot change the shared teacher
layer (`apps/agent/src/teacher.py`): the red lines apply to every teacher.

### Add a course

A course is `packages/shared/courses/<slug>.json`: the course's fields plus units
with `goals`, `content.vocabulary`, `content.grammar`, `content.functions` and
`content.speaking_tasks`. Write goals as things a student can *do* ("introduce
yourself and a friend"), and give each a kind in brackets when it is not
speaking (`[grammar] use am / is / are`).

**Copyright:** outlines only. Unit titles, topics, grammar points and short word
lists are fine; never copy reading passages, dialogues or exercises from a
textbook.

Teachers can also keep a course in a [Dokki](https://dokki.one) table and import
it with `pnpm course:import <course.json> --from-dokki <tableId>`; the column
names are listed at the top of `scripts/course-import.mjs`.

### Add a card type

The teacher's cards are typed components, not model-written HTML. Add the kind
to `KINDS` in `apps/agent/src/widgets.py` and `WIDGET_KINDS` in
`apps/web/lib/widgets.ts` (a test checks they match), render it in
`apps/web/components/app/widget-card.tsx`, and look at it on `/playground`.

## Pull requests

- One change per PR, with a description of what a student or developer will
  notice and how you checked it.
- Add or update tests for behaviour you change.
- Keep secrets out of commits; CI rejects key-shaped strings.
- Be kind in review. See the [Code of Conduct](CODE_OF_CONDUCT.md).
