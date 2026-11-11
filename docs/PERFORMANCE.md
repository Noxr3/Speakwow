# Loading and caching

Reviewed 2026-11-11 against Next.js 15 documentation. Optimize the critical path
before adding caches: the observed bottleneck was repeated network work and an
eager classroom bundle, not a large production database.

## What changed

- Home initially loads lesson browsing only. LiveKit, transcription, interactive
  classroom widgets and call setup are imported on intent (focus/hover) or click.
  Every actual call still obtains fresh credentials after guest authentication
  and course selection. No token, room connection or microphone is prewarmed.
- Home ships the selected course only. Navigation session DTOs include title,
  kind, duration, activity and goal IDs, never teaching prompts/materials.
  PostgREST selects `content->sessions` rather than the entire content document.
- Category/CEFR/grade filters use the data already loaded. Native history updates
  preserve shareable URLs, back/forward and modified clicks without RSC fetches.
- Layout/metadata read request headers only when the optional remote configuration
  endpoint is enabled. Ordinary Settings and Playground are static public shells;
  user identity, keys and phone details still load through authenticated clients.
  Home/Profile retain dynamic private reads. No account data is built into HTML.
- Route `loading.tsx` boundaries show immediate feedback and allow partial Link
  prefetching. Course saves no longer reread the full library or issue an extra
  client refresh after navigation. The save action redirects directly to Home instead
  of rerendering the catalog and then issuing a separate navigation. Selecting the
  already-active course navigates without a write. Initial home has no opacity delay.
- Public catalog and authentication/private queries start independently.
  Enrollments and progress are parallel. React `cache` deduplicates verified
  `getUser` calls only within a server render. The token route verifies `getUser`
  itself and refreshes cookies, so middleware does not repeat that same check.
- Profile course progress starts alongside the other panels and streams through
  Suspense. It reuses the catalog instead of a three-query enrollment→units→progress
  waterfall. History queries explicitly constrain the student in addition to RLS.
- Starting a lesson authenticates the guest in parallel with the classroom import.
  Requested course/unit selection is validated atomically inside the token endpoint;
  there is no preceding save action or RSC rerender. Stored key lookup runs in
  parallel with course resolution. Tokens remain fresh, private and uncached.
  Legacy clients without a unit ID still resolve their saved place. Same-origin
  JSON checks protect the endpoint's new mutation. Course selection skips an extra
  browser `getUser` request, relying on its authoritative server action; an explicit
  auth rejection triggers one guest-repair attempt. Network errors never replace
  a learner's identity.
- Aurora is a deferred chunk with a 1.5 DPR cap; hidden-tab and reduced-motion
  behavior remain. Teacher SVGs are local, versioned and dimensioned.

## Cache contract

| Data | Scope / lifetime | Invalidation |
| --- | --- | --- |
| Public course navigation DTO | Next Data Cache, 60-second revalidation; keyed by schema version and Supabase URL | `public-courses` tag; periodic revalidation after external imports |
| User, enrollments, progress, memory, history | Authenticated request only; no shared persistent cache | Existing course/profile mutations revalidate affected routes; call completion refreshes progress |
| Classroom code | Hashed JS chunks and a browser import promise | New deployment hash; failed import resets the promise for retry |
| Dylan portraits | Same-origin `/teachers/dylan-v1/`, one year immutable | Bump directory version when artwork changes |

The public cache uses a dedicated **anonymous** Supabase client. Migration 0008
explicitly makes courses and units public. No cookies, user JWT, service role key,
private enrollment or progress can enter that cache. Errors throw rather than
becoming a cached empty catalog. A 60-second revalidation interval is not a strict
freshness SLA: the first stale request may receive the previous catalog while Next
refreshes it, and provider failures can extend staleness. Course completion itself
is always read from the student's private tables, not that catalog cache.

No service worker or public CDN HTML cache is introduced for authenticated pages.
If course visibility becomes private, change this cache contract before exposing
those rows. Do not wrap `homeCourses` or profile queries in `unstable_cache`.

## Voice worker startup

Snapshot and recent-message reads run concurrently for each call. When the fresh
student snapshot exactly matches the signed course/unit and includes session
definitions, the worker reuses it instead of performing three more REST requests.
A mismatch uses the validated enrollment/unit lookup; its two independent checks
run concurrently before loading lesson material. Legacy units retain database
session normalization. No private snapshot is cached across calls or students.
The existing conversational opening pause and model behavior are unchanged.

## Deployment locality

The baseline Vercel deployment was in `iad1` (US East), while the verified
Supabase project is in `ap-northeast-1` (Tokyo). Each sequential auth/data request
therefore crossed regions. `apps/web/vercel.json` pins functions to `hnd1` (Tokyo),
near the database; static assets still use the global CDN. Confirm the deployed
region along with the revision, rather than inferring it from the configuration.

## Database

Production inspection showed about 79 course units, 14 sessions and two lesson
attempts (Postgres estimates). Adding broad indexes would not fix the observed
seconds of latency. Existing student-leading primary keys cover enrollments and
unit progress; existing indexes cover sessions, weaknesses and memory.

Migration 0012 adds the missing `(session_id, created_at DESC)` index to lesson
attempts, used by the explicitly student-filtered session join and FK deletion.
It changes no policy or table data. Short lock/statement timeouts make it fail
rather than wait indefinitely. At substantially larger scale, deploy such indexes
concurrently through a separately reviewed migration procedure.

A rollback-only synthetic benchmark is in
[`scripts/benchmarks/learning-history.sql`](../scripts/benchmarks/learning-history.sql).
Run it against an empty local schema with migration 0012 applied, never production.
With 100,002 attempts and 10,002 sessions, one local run changed the join from a
100,002-row sequential scan (10.600 ms, 1,239 shared buffer hits) to a session-index
lookup (0.046 ms, 6 hits + 1 read). These are **synthetic query-plan measurements**,
not a production speedup claim. SQL regressions separately verify own-history
visibility and rejection of another student's history, including an unfiltered read.

## Measurements

Production baseline: commit `136c292`, three public HTTP requests per route from
the same workstation, up to three concurrent requests. No authentication cookies.

| Route | Baseline TTFB, seconds | Baseline total, seconds |
| --- | --- | --- |
| `/` | 2.892 / 1.450 / 1.385 | 3.049 / 1.555 / 1.552 |
| `/courses` | 1.856 / 1.220 / 1.400 | 1.993 / 1.366 / 1.498 |
| `/courses?category=adult-english` | 2.716 / 1.454 / 1.337 | 2.884 / 1.644 / 1.453 |
| `/settings` | 0.232 / 0.283 / 0.152 | 0.254 / 0.296 / 0.166 |

Next production build reports home initial JS **695 kB → 189 kB (−72.8%)**.
Courses **197 kB → 195 kB**. These are Next's initial JS estimates, not total
session downloads: starting a call downloads the deferred classroom code.

Browser network inspection confirmed category and B1 filter clicks emitted **zero
network requests**, changed the course results and URL, and worked with Back.
Skeletons appeared immediately on route navigation. A direct deep link still loads
its data normally. This is functional/per-network evidence, not a field INP score.
Measure cold and warm complete responses separately: streamed TTFB measures the
shell, so do not substitute it for time until all course content has arrived.


Production follow-up at merge `050ef09`, same workstation, public cookie-free
requests (three sequential samples, complete body consumed):

| Route | New TTFB, seconds | New total, seconds |
| --- | --- | --- |
| `/` | 0.983 / 0.357 / 0.389 | 1.137 / 0.481 / 0.535 |
| `/courses` | 0.468 / 0.520 / 0.476 | 0.668 / 0.769 / 0.520 |
| `/courses?category=adult-english` | 0.471 / 0.466 / 0.465 | 0.523 / 0.512 / 0.520 |
| `/settings` | 0.459 / 0.261 / 0.515 | 0.460 / 0.275 / 0.541 |

These samples entered through `sfo1` and executed in `hnd1`; this is not a global
latency guarantee. Home/course medians improved; the lightweight Settings route
regressed in this sample. That finding prompted the static-shell follow-up above,
removing its unnecessary function trip. Voice first-audio latency is not part of
these HTTP measurements. Run `node scripts/benchmarks/http-loading.mjs` to repeat.

## Sources and decisions

- [Next.js navigation](https://nextjs.org/docs/app/getting-started/linking-and-navigating): loading boundaries, partial prefetch and native History API.
- [Next.js 15 lazy loading](https://nextjs.org/docs/15/app/guides/lazy-loading): defer code not needed for the initial task.
- [Next.js 15 unstable_cache](https://nextjs.org/docs/15/app/api-reference/functions/unstable_cache): explicit keys, tags and revalidation; keep request cookies outside cache functions.
- [web.dev INP](https://web.dev/articles/optimize-inp): give immediate interaction feedback and distinguish rendering/long tasks from network completion.
- [Supabase query optimization](https://supabase.com/docs/guides/database/query-optimization): use EXPLAIN evidence and indexes matching filters/joins.
- [Supabase server-side clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client): preserve trusted server authentication while optimizing data access.

- [Vercel function regions](https://vercel.com/docs/functions/configuring-functions/region): place functions near their data source.

- [LiveKit initial context](https://docs.livekit.io/agents/logic/external-data/): minimize blocking entrypoint data loads while keeping the agent ready before joining.
