begin;
insert into public.courses(title, subject, publisher, description, access)
values ('Everyday English', 'english', 'Test Press', 'Speaking & listening', 'public'),
       ('日常英语', 'english', '译林出版社', '对话练习', 'public'),
       ('50%_complete', 'science', null, null, 'public');
insert into public.courses(title, access)
select 'Catalog test ' || lpad(i::text, 2, '0'), 'public' from generate_series(1, 14) i;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
do $$
declare first_ids uuid[]; second_ids uuid[];
begin
  assert (select count(*) from public.courses where search_text ilike '%译林%') = 1, 'Chinese publisher search';
  assert (select count(*) from public.courses where search_text ilike '%listening%') = 1, 'description search';
  assert (select count(*) from public.courses where search_text ilike '%50\%\_complete%') = 1, 'literal wildcard search';
  assert (select count(*) from public.courses where search_text ilike '%nonexistent-course-xyz%') = 0, 'empty search';
  select array_agg(id) into first_ids from (select id from public.courses where title like 'Catalog test %' order by title, id limit 6) p;
  select array_agg(id) into second_ids from (select id from public.courses where title like 'Catalog test %' order by title, id limit 6 offset 6) p;
  assert cardinality(first_ids) = 6 and cardinality(second_ids) = 6, 'bounded pages';
  assert not first_ids && second_ids, 'no overlapping page results';
  assert (select count(*) from (select id from public.courses where title like 'Catalog test %' order by title, id limit 6 offset 12) p) = 2, 'last page';
end $$;
reset role;
rollback;
