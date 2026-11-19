begin;

create or replace function public.select_student_course(p_student uuid, p_course uuid, p_unit uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_student uuid := p_student; v_first uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' and p_student is distinct from auth.uid() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if v_student is null then raise exception 'Sign in to choose a course' using errcode = '42501'; end if;
  perform 1 from public.profiles where id = v_student for update;
  select u.id into v_first from public.course_units u join public.courses c on c.id = u.course_id
    where c.id = p_course and c.subject = 'english' order by u.position limit 1;
  if v_first is null then raise exception 'Course is unavailable'; end if;
  if p_unit is not null and not exists (select 1 from public.course_units where id = p_unit and course_id = p_course)
    then raise exception 'Lesson does not belong to this course'; end if;
  update public.enrollments set status = 'paused', updated_at = now()
    where student_id = v_student and status = 'active' and course_id <> p_course;
  insert into public.enrollments(student_id, course_id, current_unit_id, status)
    values(v_student, p_course, coalesce(p_unit, v_first), 'active')
    on conflict(student_id, course_id) do update set
      current_unit_id = coalesce(p_unit, enrollments.current_unit_id, v_first),
      status = 'active', updated_at = now();
end $$;

-- Resume the most recently used English course only for affected students.
-- Keep every enrollment, unit pointer, and past attempt.
lock table public.enrollments in share row exclusive mode;
with paused as (
  update public.enrollments e set status = 'paused', updated_at = now()
  from public.courses c
  where e.course_id = c.id and e.status = 'active' and c.subject <> 'english'
  returning e.student_id
), previous as (
  select distinct on (e.student_id) e.student_id, e.course_id
  from public.enrollments e join public.courses c on c.id = e.course_id
  where e.student_id in (select student_id from paused)
    and e.status = 'paused' and c.subject = 'english'
    and not exists (
      select 1 from public.enrollments a join public.courses ac on ac.id = a.course_id
      where a.student_id = e.student_id and a.status = 'active' and ac.subject = 'english'
    )
  order by e.student_id, e.updated_at desc, e.course_id
)
update public.enrollments e set status = 'active', updated_at = now()
from previous p where (e.student_id, e.course_id) = (p.student_id, p.course_id);

commit;
