# Speakwow web

The student's side: the call, login, the learning record (`/profile`), settings
with bring-your-own-key (`/settings`), and a component gallery (`/playground`).
Next.js 15 on LiveKit's React components. See the [root README](../../README.md)
for setup.

```bash
cp .env.example .env.local
pnpm dev
pnpm lint && pnpm test && pnpm build
```

Runs without Supabase (guest-only). The token route (`app/api/connection-details`)
signs the teacher, the student, the mode and the sealed key into the LiveKit
token, so the browser cannot change what the agent is told.

Started from LiveKit's MIT-licensed agent starter for React (see `LICENSE` in
this folder).

## Learner memory

`/profile` reads and edits `user_memories`, a flat list of declarative facts with
stable keys, source session IDs and versions, following Dokki's memory design.
There are no fixed name, grade, level or goal form fields. After a voice lesson,
the agent reviews a bounded snapshot and writes validated create/update/delete
operations. The next voice call or text conversation reads the same memories.
Course progress, lesson summaries and practice evidence remain separate.

Migration `0006_user_memories.sql` copies the previous profile fields and
`student_facts` (including their source sessions), then removes those legacy
stores. Apply the migration and deploy the web and agent changes together in a
maintenance window; the old agent/web code depends on the retired columns.
This is a schema change, not a frontend-only rollout.

User edits are protected from background extraction. Updates compare the
version originally reviewed. Forget clears the content and source while
retaining an empty key/version tombstone, preventing delayed writes from
recreating that key. Deleting a memory does not delete lesson transcripts or
summaries; already-running calls may still have the earlier context.
