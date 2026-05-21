-- Per-user agent memory: one row per fact, keyed by the Supabase auth user id.
-- The agent reads/writes this via PostgREST using the service-role key.

create table if not exists public.agent_memory (
  id bigint generated always as identity primary key,
  user_id text not null,
  fact text not null,
  created_at timestamptz not null default now(),
  unique (user_id, fact)
);

create index if not exists agent_memory_user_id_idx
  on public.agent_memory (user_id);

-- RLS on: the agent uses the service-role key, which bypasses RLS. No policy
-- is needed for the agent. Add the policy below if you later want the browser
-- (anon/auth key) to let a user read their own memory.
alter table public.agent_memory enable row level security;

-- create policy "read own memory"
--   on public.agent_memory for select
--   using (auth.uid()::text = user_id);
