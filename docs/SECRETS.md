# Secrets

Speakwow's production secrets live in **1Password**, vault `Speakwow`, one item per
service. Vercel (the web app) and Railway (the voice agent) get copies, and those
copies are written only by `scripts/secrets-sync.mjs`. Never paste a value into a
dashboard: change it in 1Password and sync.

| Item / field | Vercel `wow3` | Railway `wow5` |
|---|---|---|
| `supabase/publishable_key` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — |
| `supabase/secret_key` | `SUPABASE_SERVICE_ROLE_KEY` (production, sensitive) | `SUPABASE_SERVICE_ROLE_KEY` |
| `byok/encryption_key` | `BYOK_ENCRYPTION_KEY` | `BYOK_ENCRYPTION_KEY` |
| `livekit/api_key`, `livekit/api_secret` | `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | same |
| `xai/api_key` | — | `XAI_API_KEY` |
| `ai-gateway/api_key` | — | `AI_GATEWAY_API_KEY` |
| `dokki/api_key` | — | `DOKKI_API_KEY` |
| `openai/api_key` | `OPENAI_API_KEY` | — |

The map itself is `scripts/secrets.json`. Each item's notes say where the key is
issued and how to replace it.

## Sync

```bash
pnpm secrets:sync                         # what would change; writes nothing
pnpm secrets:sync -- --apply --deploy     # write, then redeploy what changed
pnpm secrets:sync -- --only livekit       # just the refs containing "livekit"
```

- **Reading:** all values come from one `op inject` call, so a run asks 1Password for
  approval at most once.
- **Never printed:** values stay in memory. The output names variables and says what
  happened to them.
- **Comparing:**
  - Railway values are compared directly.
  - Vercel cannot read back a sensitive variable, so every variable the script writes
    carries a fingerprint of its value in its comment (`1password sha256:…`). A value
    is rewritten only when the fingerprint changes.
- **Empty fields** are skipped. That is how a key waiting to be rotated stays as it is.
- **Logins:**
  - 1Password: the `op` CLI, signed in through the desktop app.
  - Vercel: `VERCEL_TOKEN`, or the Vercel CLI login.
  - Railway: `RAILWAY_API_TOKEN`, or the Railway CLI login. The script refreshes the
    Railway login itself.

## Rotating a key

1. Create the new key at the provider. The item's notes say where.
2. Put it in the 1Password field.
3. Run `pnpm secrets:sync -- --apply --deploy`.
4. Check the agent's Railway log says `registered worker`, and the site still starts
   a call.
5. Revoke the old key at the provider.

**Two keys that need care:**
- **`byok/encryption_key`** seals users' own model keys. Vercel and Railway must hold
  the same value, and keys already stored in `user_api_keys` must be re-sealed before
  the old value is dropped.
- **`supabase/*`** are Supabase's publishable and secret API keys. The legacy
  `anon` / `service_role` keys are disabled, and the legacy JWT secret is revoked
  (2026-10-22). Rotate a secret key by creating a new one in Supabase (Settings → API
  Keys), syncing, then deleting the old one.
