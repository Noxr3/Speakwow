-- The course catalogue is public to read.
--
-- A visitor should see which courses there are before signing in (the
-- /courses page). The content is published in the repository anyway
-- (courses/). Reading only: since 0005, nobody but the server writes these
-- tables.

create policy catalog_read_anon on public.courses
  for select to anon using (true);
create policy catalog_read_anon on public.course_units
  for select to anon using (true);
