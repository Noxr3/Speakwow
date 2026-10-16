-- Regression test for 0002_lifelong_teacher.sql. Runs inside one transaction
-- and rolls back. CI: .github/workflows/supabase.yml, after `supabase db reset`.
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/lifelong_teacher.sql
begin;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'ada@test.local'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bo@test.local');

insert into public.user_memories (user_id, key, content) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'exam', 'has an exam in December'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'private', 'Bo''s private fact');

insert into public.courses (id, title, slug) values
  ('cccccccc-0000-4000-8000-000000000003', 'Test 7A', 'test-7a');
insert into public.course_units (id, course_id, position, title, goals) values
  ('dddddddd-0000-4000-8000-000000000004', 'cccccccc-0000-4000-8000-000000000003', 1, 'Unit 1',
   '[{"id": "u1-g1", "kind": "speaking", "text": "introduce yourself"}]'),
  ('dddddddd-0000-4000-8000-000000000005', 'cccccccc-0000-4000-8000-000000000003', 2, 'Unit 2', '[]');
insert into public.enrollments (student_id, course_id, current_unit_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000003',
   'dddddddd-0000-4000-8000-000000000004');
insert into public.unit_progress (student_id, unit_id, status, mastery) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000005', 'mastered', 1);

-- one assignment for Ada (she has a pending submission), one for an org she is not in
insert into public.assignments (id, org_id) values
  ('eeeeeeee-0000-4000-8000-000000000006', null),
  ('eeeeeeee-0000-4000-8000-000000000007', 'ffffffff-0000-4000-8000-000000000008');
insert into public.submissions (assignment_id, student_id) values
  ('eeeeeeee-0000-4000-8000-000000000006', 'aaaaaaaa-0000-4000-8000-000000000001');

-- ---------- as Ada ----------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);

do $$
declare s jsonb;
begin
  s := public.get_student_snapshot('aaaaaaaa-0000-4000-8000-000000000001');
  assert not (s ? 'profile'), 'no fixed profile in context';
  assert jsonb_array_length(s->'memories') = 1, 'own facts only';
  assert s->'current_course'->'current_unit'->>'title' = 'Unit 1', 'current unit';
  assert s->'current_course'->'current_unit'->'goals'->0->>'id' = 'u1-g1', 'unit goals';
  assert (s->'current_course'->>'units_total')::int = 2, 'units total';
  assert (s->'current_course'->>'units_mastered')::int = 1, 'units mastered';
  assert jsonb_array_length(s->'open_assignments') = 1, 'only Ada''s assignment';
  assert s->'open_assignments'->0->>'id' = 'eeeeeeee-0000-4000-8000-000000000006', 'which assignment';

  begin
    perform public.get_student_snapshot('bbbbbbbb-0000-4000-8000-000000000002');
    raise exception 'Ada read Bo''s snapshot';
  exception when insufficient_privilege then
    null;  -- expected
  end;

  assert (select count(*) from public.user_memories) = 1, 'RLS hides Bo''s facts';
  update public.user_memories set deleted_at = now();  -- content is erased, key guards stale writes
  assert (select count(*) from public.user_memories where content <> '') = 0, 'own facts deletable';
end $$;

-- ---------- as an anonymous visitor ----------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
do $$
begin
  begin
    perform public.get_student_snapshot('aaaaaaaa-0000-4000-8000-000000000001');
    raise exception 'anon read a snapshot';
  exception when insufficient_privilege then
    null;  -- expected: execute was revoked from anon
  end;
end $$;

-- ---------- as the agent ----------
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
do $$
declare s jsonb;
begin
  s := public.get_student_snapshot('bbbbbbbb-0000-4000-8000-000000000002');
  assert jsonb_array_length(s->'memories') = 1, 'agent reads any student';
  assert s->'current_course' = 'null'::jsonb or s->'current_course' is null, 'Bo has no course';
end $$;

reset role;
rollback;
