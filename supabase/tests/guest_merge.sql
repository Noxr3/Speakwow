-- Regression test for 0010_guest_merge.sql. Runs inside one transaction and
-- rolls back. CI: .github/workflows/supabase.yml.
begin;

-- a guest (anonymous) and the account they sign in to, which has history
insert into auth.users (id, email, is_anonymous) values
  ('a0a0a0a0-0000-4000-8000-0000000000a1', null, true),
  ('b0b0b0b0-0000-4000-8000-0000000000b2', 'ming@test.local', false),
  ('c0c0c0c0-0000-4000-8000-0000000000c3', 'other@test.local', false);

insert into public.courses (id, title) values
  ('d0d0d0d0-0000-4000-8000-0000000000d1', 'Course one'),
  ('d0d0d0d0-0000-4000-8000-0000000000d2', 'Course two');
insert into public.course_units (id, course_id, position, title) values
  ('e0e0e0e0-0000-4000-8000-0000000000e1', 'd0d0d0d0-0000-4000-8000-0000000000d1', 1, 'Unit 1'),
  ('e0e0e0e0-0000-4000-8000-0000000000e2', 'd0d0d0d0-0000-4000-8000-0000000000d2', 1, 'Unit 1');

-- the guest: two calls, one with words, memories, a course and progress
insert into public.sessions (id, student_id, persona_id) values
  ('f0f0f0f0-0000-4000-8000-0000000000f1', 'a0a0a0a0-0000-4000-8000-0000000000a1', 'lily'),
  ('f0f0f0f0-0000-4000-8000-0000000000f2', 'a0a0a0a0-0000-4000-8000-0000000000a1', 'lily');
insert into public.messages (session_id, role, content) values
  ('f0f0f0f0-0000-4000-8000-0000000000f1', 'user', 'I like basketball.');
insert into public.weaknesses (student_id, item, source) values
  ('a0a0a0a0-0000-4000-8000-0000000000a1', 'past tense (goed)', 'live_session');
insert into public.user_memories (user_id, key, content, source_session_id) values
  ('a0a0a0a0-0000-4000-8000-0000000000a1', 'interests', 'Enjoys basketball.', 'f0f0f0f0-0000-4000-8000-0000000000f1'),
  ('a0a0a0a0-0000-4000-8000-0000000000a1', 'preferred-name', 'Call me Xiaoming.', 'f0f0f0f0-0000-4000-8000-0000000000f1');
insert into public.enrollments (student_id, course_id, current_unit_id, status) values
  ('a0a0a0a0-0000-4000-8000-0000000000a1', 'd0d0d0d0-0000-4000-8000-0000000000d1', 'e0e0e0e0-0000-4000-8000-0000000000e1', 'active'),
  ('a0a0a0a0-0000-4000-8000-0000000000a1', 'd0d0d0d0-0000-4000-8000-0000000000d2', 'e0e0e0e0-0000-4000-8000-0000000000e2', 'paused');
insert into public.unit_progress (student_id, unit_id, mastery) values
  ('a0a0a0a0-0000-4000-8000-0000000000a1', 'e0e0e0e0-0000-4000-8000-0000000000e1', 0.4),
  ('a0a0a0a0-0000-4000-8000-0000000000a1', 'e0e0e0e0-0000-4000-8000-0000000000e2', 0.3);

-- the account: its own name, and course two active with more progress
insert into public.user_memories (user_id, key, content) values
  ('b0b0b0b0-0000-4000-8000-0000000000b2', 'preferred-name', 'Call me Ming.');
insert into public.enrollments (student_id, course_id, current_unit_id, status) values
  ('b0b0b0b0-0000-4000-8000-0000000000b2', 'd0d0d0d0-0000-4000-8000-0000000000d2', 'e0e0e0e0-0000-4000-8000-0000000000e2', 'active');
insert into public.unit_progress (student_id, unit_id, mastery) values
  ('b0b0b0b0-0000-4000-8000-0000000000b2', 'e0e0e0e0-0000-4000-8000-0000000000e2', 0.9);

-- a signed-in user may not call it, not even for their own guest self
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b0b0b0b0-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
do $$
begin
  perform public.merge_guest_into('a0a0a0a0-0000-4000-8000-0000000000a1', 'b0b0b0b0-0000-4000-8000-0000000000b2');
  raise exception 'a signed-in user could merge';
exception when insufficient_privilege then null;
end $$;
reset role;

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare
  moved jsonb;
begin
  -- a real account is never merged into another one
  begin
    perform public.merge_guest_into('c0c0c0c0-0000-4000-8000-0000000000c3', 'b0b0b0b0-0000-4000-8000-0000000000b2');
    raise exception 'a signed-in account was merged into another';
  exception when insufficient_privilege then null;
  end;
  -- nor into a guest
  begin
    perform public.merge_guest_into('a0a0a0a0-0000-4000-8000-0000000000a1', 'a0a0a0a0-0000-4000-8000-0000000000a1');
    raise exception 'a guest was merged into itself';
  exception when insufficient_privilege then null;
  end;

  moved := public.merge_guest_into('a0a0a0a0-0000-4000-8000-0000000000a1', 'b0b0b0b0-0000-4000-8000-0000000000b2');
  assert (moved ->> 'sessions')::int = 2, 'both calls moved: ' || moved::text;
  assert (moved ->> 'memories')::int = 1, 'only the new memory key: ' || moved::text;
  assert (moved ->> 'enrollments')::int = 1, 'only the new course: ' || moved::text;

  -- the calls and their words are the account's now
  assert (select count(*) from public.sessions where student_id = 'b0b0b0b0-0000-4000-8000-0000000000b2') = 2;
  assert (select count(*) from public.messages m join public.sessions s on s.id = m.session_id
          where s.student_id = 'b0b0b0b0-0000-4000-8000-0000000000b2') = 1;
  assert (select count(*) from public.weaknesses where student_id = 'b0b0b0b0-0000-4000-8000-0000000000b2') = 1;
  -- the account's own name wins; the guest's interests come across, sourced
  assert (select content from public.user_memories
          where user_id = 'b0b0b0b0-0000-4000-8000-0000000000b2' and key = 'preferred-name') = 'Call me Ming.';
  assert (select source_session_id = 'f0f0f0f0-0000-4000-8000-0000000000f1' from public.user_memories
          where user_id = 'b0b0b0b0-0000-4000-8000-0000000000b2' and key = 'interests'), 'interests moved with their source';
  -- course two stays the account's active one; the guest's course one joins, paused
  assert (select status from public.enrollments
          where student_id = 'b0b0b0b0-0000-4000-8000-0000000000b2' and course_id = 'd0d0d0d0-0000-4000-8000-0000000000d2') = 'active';
  assert (select status from public.enrollments
          where student_id = 'b0b0b0b0-0000-4000-8000-0000000000b2' and course_id = 'd0d0d0d0-0000-4000-8000-0000000000d1') = 'paused';
  -- progress on the same unit stays the account's (0.9, not the guest's 0.3)
  assert (select mastery from public.unit_progress
          where student_id = 'b0b0b0b0-0000-4000-8000-0000000000b2' and unit_id = 'e0e0e0e0-0000-4000-8000-0000000000e2') = 0.9;
  assert (select mastery from public.unit_progress
          where student_id = 'b0b0b0b0-0000-4000-8000-0000000000b2' and unit_id = 'e0e0e0e0-0000-4000-8000-0000000000e1') = 0.4;
  -- the account's snapshot now carries what the guest learned
  assert (public.get_student_snapshot('b0b0b0b0-0000-4000-8000-0000000000b2') -> 'memories') @> '[{"key": "interests"}]';
end $$;
reset role;

rollback;
