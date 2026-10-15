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
