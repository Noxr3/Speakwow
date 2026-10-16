-- Courses are written only by the server.
--
-- Courses now live in the repository (courses/) and are imported with the
-- service role (scripts/course-import.mjs). The per-author write policies
-- from 0001 let any signed-in account create a course that every student
-- sees in their list (its goals and content then reach the teacher's
-- prompt), or create a row with an official course's slug before it is
-- imported and so own that course. Nothing in the app writes these tables,
-- so the write policies go; reading is unchanged.

drop policy if exists content_write on public.courses;
drop policy if exists units_write on public.course_units;
drop policy if exists lessons_write on public.lessons;
drop policy if exists content_write on public.exercises;
