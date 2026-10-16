-- Regression test for 0009_whatsapp_channel.sql. Runs inside one transaction
-- and rolls back. CI: .github/workflows/supabase.yml.
begin;

insert into auth.users (id, email) values
  ('ffffffff-0000-4000-8000-0000000000f6', 'wa-channel@test.local');

insert into public.sessions (student_id, persona_id, started_at, channel)
  values ('ffffffff-0000-4000-8000-0000000000f6', 'frank', now(), 'whatsapp');

do $$
begin
  begin
    insert into public.sessions (student_id, persona_id, started_at, channel)
      values ('ffffffff-0000-4000-8000-0000000000f6', 'frank', now(), 'telegram');
    raise exception 'a session took a channel that does not exist';
  exception when check_violation then null;
  end;
end $$;

rollback;
