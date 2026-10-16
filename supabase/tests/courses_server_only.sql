-- Regression test for 0005_courses_server_only.sql. Runs inside one
-- transaction and rolls back. CI: .github/workflows/supabase.yml.
begin;

insert into auth.users (id, email) values
  ('dddddddd-0000-4000-8000-0000000000d4', 'cy-course@test.local');

-- the importer (service role) writes courses
insert into public.courses (id, slug, title, source)
  values ('eeeeeeee-0000-4000-8000-0000000000e5', 'test-official', 'Official', 'repo');
insert into public.course_units (course_id, position, title)
  values ('eeeeeeee-0000-4000-8000-0000000000e5', 1, 'Unit one');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "dddddddd-0000-4000-8000-0000000000d4", "role": "authenticated"}', true);

do $$
begin
  if (select count(*) from public.courses where slug = 'test-official') <> 1 then
    raise exception 'a signed-in student can no longer read courses';
  end if;
  begin
    insert into public.courses (slug, title, created_by)
      values ('test-fake', 'Fake', 'dddddddd-0000-4000-8000-0000000000d4');
    raise exception 'a signed-in student created a course';
  exception when insufficient_privilege then null;
  end;
  update public.course_units set title = 'Rewritten'
    where course_id = 'eeeeeeee-0000-4000-8000-0000000000e5';
  if (select title from public.course_units
      where course_id = 'eeeeeeee-0000-4000-8000-0000000000e5') <> 'Unit one' then
    raise exception 'a signed-in student rewrote a unit';
  end if;
end $$;

reset role;
rollback;
