# Continuous courses and a home tutor

The home screen centres the current unit beneath a quiet course title.
Courses and Profile live in the top navigation (and the mobile navigation menu).
Courses opens /courses for category selection, progress and syllabuses.
The unit panel uses React Bits Depth Carousel: whole cards move along a depth rail,
with one-lesson-per-flick dragging, horizontal trackpad and keyboard navigation (no autoplay or looping). Arrow buttons
sit at the screen edges, centred vertically on the card; the unit number sits above the title inside each card. A brief introduction
comes from its learning objective, with a separate summary for assessment units.
It opens at the saved unit, and starting a lesson saves the displayed unit before
requesting the call token. The Speakwow logo and wordmark appear only at top left.
Student progress, history and memories live under Profile. Small talk
is part of the tutor conversation, without a separate home-screen mode toggle.

CommitMono typography, LiquidGlass panels and the DotGrid call background are
preserved. Home and inner pages use the requested React Bits Aurora
background, dimmed on inner pages for headings and form readability,
with its reduced-motion handling and original license. Text
panels use an 88% dark tint. Refraction is a separate, paint-contained layer
beneath the content and rim, with bounded displacement and a neutral centre.
Only one resize observer updates each map. Buttons inside the panels do not
apply a nested backdrop filter; Safari/Firefox retain the frosted fallback.
Each Carousel slide is a complete liquid-glass card: unit number, title,
introduction and start button move together. The teacher selector sits below
the carousel and its menu shows each teacher's existing English tagline. The active card has no filter or opacity compositing hints that
would isolate its glass from the page backdrop. Navigation locks
while starting a lesson, and inactive slides are excluded from keyboard focus.
Both React Bits components retain their source attribution and license in
`apps/web/licenses/react-bits.md`; Depth Carousel uses the existing GSAP dependency.

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

## Course navigation and CEFR difficulty

The course directory starts with Adult English, IELTS & TOEFL, and School English.
Stable slugs map the eight existing general series to Adult English; textbook grade
metadata maps the four Yilin volumes to School English. IELTS/TOEFL currently has
no courses and says so. Unknown courses remain discoverable under More English.
Category and CEFR level links are URL state, with breadcrumbs, browser back/reload,
category-scoped search, school-grade filters and global search across categories. No enrollment changes
until the student chooses a course or lesson.

Difficulty uses the [Council of Europe CEFR global scale](https://www.coe.int/en/web/common-European-framework-reference-languages/table-1-cefr-3.3-common-reference-levels-global-scale).
The current editorial alignment is provisional while these outlines remain draft:

| Series | CEFR scope | Alignment rationale |
| --- | --- | --- |
| Listen & write; Pronunciation & rhythm | A1–A2 | Familiar words, short messages, intelligible everyday phrases. |
| Everyday conversations | A2–B1 | Routine transactions progressing to explaining problems and negotiating solutions. |
| Picture conversations; Words in use | A2–B1 | Simple descriptions progressing to connected narratives and paraphrasing. |
| Read & discover; Writing workshop | A2–B1 | Short everyday texts progressing to connected paragraphs, inferences and reasons. |
| Storytelling | B1 | Independently tell a connected story with a beginning, middle and end. |

The A1–C2 filters include both ends of a course range. B2–C2 have no matching
courses yet. School grade is not automatically equated to CEFR; textbooks show
Grade 7/8 with grade filters; they make no CEFR equivalence claim. These are course skill
scopes, not official certification or a measurement of the student's proficiency.
Update `lib/course-categories.ts`, the relevant course `level` and its log together
when the curriculum scope changes. No schema migration is required for catalog
navigation; existing slugs and grades supply membership metadata.

## Verification (2026-11-10)

- Web: production build and typecheck passed; lint passed with existing warnings
  in unchanged components. 32 web tests and 10 script tests passed.
- Agent: 148 offline tests and Ruff passed. The two existing live model tests
  could not run: this checkout has no voice/model provider credentials.
- Database: the full migration chain was applied to an isolated local Supabase;
  all SQL regression files passed with empty course fixtures inside rolled-back
  transactions. Selection, foreign-unit rejection, RLS, failed exam, retry,
  idempotency and review preservation were exercised.
- Browser: UI checked at desktop and phone sizes, including the separate course
  page, returning home after selection, and the Profile navigation. Selected a course,
  changed its unit, changed courses and reloaded; both places survived. A local
  agent-style score write advanced the visible session from Learn together to
  Make it your own and displayed 1/13. Course search and the plan dialog worked.
- Carousel: checked desktop dragging, horizontal scrolling, keyboard navigation,
  first/last boundaries, phone layout, connection locking and saved-unit reload.
  Home and course-page Aurora rendered with readable dark panels. Category links,
  A1 filtering, empty B2 results, grade filtering, browser back and global search
  were checked; choosing an existing course preserved its saved unit.
- Token route: a separate local guest requested its selected course after another
  course became active; the signed course/unit still matched that request.

Deployment and real speech-to-speech teaching acceptance are separate from these
checks. The curriculum outlines remain draft pending pedagogical review.
