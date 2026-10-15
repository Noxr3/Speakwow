## What changes for a learner or a developer

## How I checked it

- [ ] Agent: `uv run ruff check && uv run pytest -m "not live"`
- [ ] Web: `pnpm --filter @speakwow/web lint && pnpm --filter @speakwow/web test && pnpm --filter @speakwow/web build`
- [ ] Migrations / SQL tests, if `supabase/` changed
- [ ] Looked at it in the browser (`/playground` for cards)
