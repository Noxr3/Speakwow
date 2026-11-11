# Speakwow web

The learner-facing Next.js app. It uses LiveKit for realtime media and Supabase
for optional identity, memories and course progress. See the [root setup guide](../../README.md#run-locally).

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Current course, unit carousel, teacher selection and free conversation |
| `/courses` | Categories, difficulty filters, search and course syllabuses |
| `/profile` | Memories, course progress and lesson history |
| `/settings` | Personal API key and optional phone settings |
| `/login` | Authentication |
| `/playground` | Interactive component gallery for development |
| `/api/connection-details` | Server-side participant token and signed agent metadata |

## Development

Run from `apps/web` after installing workspace dependencies at the root:

```bash
cp .env.example .env.local
pnpm dev
pnpm lint
pnpm test
pnpm build
```

A guest call works without Supabase. Accounts and persistent enrolled-course
progress require it. Keep LiveKit secrets and `BYOK_ENCRYPTION_KEY` on the server;
only the public Supabase URL/anon key and site origin use `NEXT_PUBLIC_` variables.
The connection route validates enrollment and signs teacher, student, mode and
sealed-key metadata before dispatching a voice agent.

## Branding and metadata

Navigation uses `/brand/mark-white.svg` against the dark App surface. The ink
variant is available for light surfaces. The README and sharing use the colored
tile. Assets derive from one vector master; see [brand usage](../../docs/BRAND.md).

Next.js serves `app/favicon.ico`, `app/icon.svg`, `app/apple-icon.png` and the
web manifest. The share card at `/opengraph-image` reads a bundled local PNG.
Set `NEXT_PUBLIC_SITE_URL` to your own origin when self-hosting. The manifest
supplies install metadata; it does not add offline functionality.

Regenerate assets with `pnpm brand:generate` from the repository root. Keep the
exported files committed and inspect icons at actual display sizes.

## Learner memory

`/profile` reads and edits `user_memories`, a flat list of declarative facts with
stable keys, source session IDs and versions, shared across calls and text conversations.
The page presents a short paragraph drawn from the newest complete memories;
the full editor sits under “Manage memory”. The brief is derived on read, so
corrections and forgetting immediately change it. There are no fixed name,
grade, level or goal form fields. After a voice lesson,
the agent reviews a bounded snapshot and writes validated create/update/delete
operations. The next voice call or text conversation reads the same memories.
Course progress, lesson summaries and practice evidence remain separate.

Migration `0006_user_memories.sql` copies the previous profile fields and
`student_facts` (including their source sessions), then removes those legacy
stores. Existing installations upgrading from that older schema must coordinate web
and agent migration; new installations should apply all migrations in order.

User edits are protected from background extraction. Updates compare the
version originally reviewed. Forget clears the content and source while
retaining an empty key/version tombstone, preventing delayed writes from
recreating that key. Deleting a memory does not delete lesson transcripts or
summaries; already-running calls may still have the earlier context.

The App began with LiveKit's MIT-licensed React starter; see [LICENSE](LICENSE).
