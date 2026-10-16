-- Regression test for 0008_course_catalog_public.sql. Runs inside one
-- transaction and rolls back. CI: .github/workflows/supabase.yml.
begin;

insert into public.courses (id, slug, title, source)
  values ('ffffffff-0000-4000-8000-0000000000f6', 'test-catalog', 'Catalogue', 'repo');
insert into public.course_units (course_id, position, title)
  values ('ffffffff-0000-4000-8000-0000000000f6', 1, 'Unit one');

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

do $$
begin
  if (select count(*) from public.courses where slug = 'test-catalog') <> 1 then
    raise exception 'a visitor cannot see the course catalogue';
  end if;
  if (select count(*) from public.course_units
      where course_id = 'ffffffff-0000-4000-8000-0000000000f6') <> 1 then
    raise exception 'a visitor cannot see a course''s units';
  end if;
  begin
    insert into public.courses (slug, title) values ('test-anon', 'Anon');
    raise exception 'a visitor created a course';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
rollback;
