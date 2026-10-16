-- Regression test for 0004_phone_and_sms.sql. Runs inside one transaction
-- and rolls back. CI: .github/workflows/supabase.yml, after `supabase db reset`.
begin;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-0000000000a1', 'ada-phone@test.local'),
  ('bbbbbbbb-0000-4000-8000-0000000000b2', 'bo-phone@test.local');

-- the server (service role) links numbers after a code checks out
insert into public.student_phones (phone, student_id) values
  ('+447700900001', 'aaaaaaaa-0000-4000-8000-0000000000a1'),
  ('+447700900002', 'bbbbbbbb-0000-4000-8000-0000000000b2');

do $$
begin
  begin
    insert into public.student_phones (phone, student_id)
      values ('07700 900003', 'aaaaaaaa-0000-4000-8000-0000000000a1');
    raise exception 'a number that is not E.164 was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.student_phones (phone, student_id)
      values ('+447700900001', 'bbbbbbbb-0000-4000-8000-0000000000b2');
    raise exception 'one number was linked to two students';
  exception when unique_violation then null;
  end;
end $$;

-- sessions say which channel they came through, web by default
insert into public.sessions (id, student_id, persona_id, started_at)
  values ('cccccccc-0000-4000-8000-0000000000c3', 'aaaaaaaa-0000-4000-8000-0000000000a1', 'frank', now());
insert into public.sessions (student_id, persona_id, started_at, channel)
  values ('aaaaaaaa-0000-4000-8000-0000000000a1', 'frank', now(), 'sms');
do $$
begin
  if (select channel from public.sessions where id = 'cccccccc-0000-4000-8000-0000000000c3') <> 'web' then
    raise exception 'a session without a channel should be web';
  end if;
  begin
    insert into public.sessions (student_id, persona_id, channel)
      values ('aaaaaaaa-0000-4000-8000-0000000000a1', 'frank', 'carrier-pigeon');
    raise exception 'an unknown channel was accepted';
  exception when check_violation then null;
  end;
end $$;

-- ---------- as Ada ----------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "aaaaaaaa-0000-4000-8000-0000000000a1", "role": "authenticated"}', true);

do $$
begin
  if (select count(*) from public.student_phones) <> 1 then
    raise exception 'Ada should see exactly her own number';
  end if;
  if exists (select 1 from public.student_phones where phone = '+447700900002') then
    raise exception 'Ada can see Bo''s number';
  end if;
  begin
    insert into public.student_phones (phone, student_id)
      values ('+447700900009', 'aaaaaaaa-0000-4000-8000-0000000000a1');
    raise exception 'a student linked a number without the server checking a code';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Ada can unlink her number but not Bo's
delete from public.student_phones where phone = '+447700900002';
delete from public.student_phones where phone = '+447700900001';
reset role;
do $$
begin
  if not exists (select 1 from public.student_phones where phone = '+447700900002') then
    raise exception 'Ada removed Bo''s number';
  end if;
  if exists (select 1 from public.student_phones where phone = '+447700900001') then
    raise exception 'Ada could not remove her own number';
  end if;
end $$;

rollback;
