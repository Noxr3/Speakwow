# Continuous courses and a home tutor

The home screen separates the course and unit into two compact glass panels.
A plain swap icon opens /courses for course selection, progress and syllabuses.
The unit panel supports touch/trackpad swiping and keyboard/arrow navigation;
it opens at the saved unit, and starting a lesson saves the displayed unit before
requesting the call token. The Speakwow logo and wordmark appear only at top left.
Student progress, history and memories live under Learning profile. Small talk
is part of the tutor conversation, without a separate home-screen mode toggle.

The original CommitMono typography, moving green/blue ColorBends background,
LiquidGlass panels, DotGrid call background and palette are preserved. Text
panels use an 88% dark tint. Refraction is a separate, paint-contained layer
beneath the content and rim, with bounded displacement and a neutral centre.
Only one resize observer updates each map. Buttons inside the panels do not
apply a nested backdrop filter; Safari/Firefox retain the frosted fallback.

A course contains ordered units (lessons). Each unit contains stable, ordered
sessions: learn, practise, review or exam. A LiveKit call is a conversation;
it may cover several teaching sessions, or only a chat. These are different
concepts. Existing unit and goal IDs remain unchanged.

The tutor opens with a brief catch-up, agrees on a goal, models it, gives the
student room to practise, and checks independent understanding. A student can
start immediately, take a silent break, or explore a tangent. After a few
exchanges the tutor offers a natural bridge back. It never treats silence,
attendance or small talk as completion. Exams require fresh independent
answers; earlier practice scores do not count as passing an exam.

Each completed attempt is scored from that session's transcript and committed
atomically, with an idempotency key. Unfinished work resumes at the same session.
Switching courses preserves all other progress. A failed write never advances
in-memory progress. Multiple calls cannot overwrite each other's scores or
move the selected course backwards.

## wow3 coverage

Source: https://github.com/Speakwow/wow3 (`lib/db/db.ts`, `app/create/`,
`lib/constant.ts`). The seven catalog types plus the legacy story creator are
redefined as eight original course series. `vocab` is the older word-course
creator, not a ninth skill. School/textbook study remains supported by the
existing Yilin courses.

| wow3 | New series | Teaching interaction |
|---|---|---|
| scenario | Everyday conversations | Role play, switch roles, transfer task |
| talkabout | Picture conversations | Shared scene, details, inference, narrative |
| repeat | Pronunciation & rhythm | Listen, shadow, compare, speak independently |
| word / vocab | Words in use | Meaning, retrieval, collocations, transfer |
| dictation | Listen & write | Unrevealed audio prompt, typed response, correction |
| write | Writing workshop | Plan, draft in text, revise, independent writing |
| reading | Read & discover | Original passage, evidence, inference, retelling |
| story | Storytelling | Sequence, characters, co-create, independent story |

Course outlines are original drafts, not copies of wow3's stored content or
textbooks. Each series has four topic units and a final assessment unit.

## Delivery

Apply migration 0011, deploy web and agent together, then run
`pnpm course:import --all`. Importing preserves course/goal IDs and progress.
Run course checks, script tests, web type/build/lint checks, Python tests and
SQL tests before deployment. Real microphone/model teaching quality still
requires an authenticated end-to-end voice session.

## Verification (2026-11-10)

- Web: production build and typecheck passed; lint passed with existing warnings
  in vendored/unchanged components. 28 web tests and 10 script tests passed.
- Agent: 148 offline tests and Ruff passed. The two existing live model tests
  could not run: this checkout has no voice/model provider credentials.
- Database: the full migration chain was applied to an isolated local Supabase;
  all SQL regression files passed with empty course fixtures inside rolled-back
  transactions. Selection, foreign-unit rejection, RLS, failed exam, retry,
  idempotency and review preservation were exercised.
- Browser: UI checked at desktop and phone sizes, including the separate course
  page, returning home after selection, and the Learning profile navigation. Selected a course,
  changed its unit, changed courses and reloaded; both places survived. A local
  agent-style score write advanced the visible session from Learn together to
  Make it your own and displayed 1/13. Course search and the plan dialog worked.
- Token route: a separate local guest requested its selected course after another
  course became active; the signed course/unit still matched that request.

Deployment and real speech-to-speech teaching acceptance are separate from these
checks. The curriculum outlines remain draft pending pedagogical review.
