begin;
alter table public.courses add column teaching_language text,
  add column course_level text;
update public.courses set teaching_language = 'en' where subject = 'english';
update public.courses set teaching_language = 'zh' where slug = 'venture-fundraising-a16z';

create or replace function public.select_student_course(p_student uuid, p_course uuid, p_unit uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_student uuid := p_student; v_first uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' and p_student is distinct from auth.uid() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if v_student is null then raise exception 'Sign in to choose a course' using errcode = '42501'; end if;
  perform 1 from public.profiles where id = v_student for update;
  select u.id into v_first from public.course_units u join public.courses c on c.id = u.course_id
    where c.id = p_course order by u.position limit 1;
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
create or replace function public.get_student_snapshot(p_student uuid)
returns jsonb
language plpgsql security definer set search_path = public
stable
as $$
declare
  v_course jsonb;
begin
  if p_student is null
     or (p_student is distinct from auth.uid()
         and coalesce(auth.role(), '') <> 'service_role') then
    raise exception 'not allowed to read this student''s snapshot'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', c.id, 'title', c.title, 'slug', c.slug, 'subject', c.subject, 'teaching_language', c.teaching_language,
    'units_total', (select count(*) from public.course_units u2 where u2.course_id = c.id),
    'units_mastered', (
      select count(*) from public.unit_progress p
      join public.course_units u3 on u3.id = p.unit_id
      where p.student_id = p_student and u3.course_id = c.id and p.status = 'mastered'
    ),
    'current_unit', case when u.id is null then null else jsonb_build_object(
      'id', u.id, 'position', u.position, 'title', u.title,
      'theme', u.theme, 'topic', u.topic, 'goals', u.goals, 'content', u.content,
      'mastery', coalesce(up.mastery, 0),
      'goal_scores', coalesce(up.goal_scores, '{}'::jsonb),
      'sessions', coalesce(up.sessions, 0),
      'status', coalesce(up.status, 'learning'),
      'session_progress', coalesce(up.session_progress, '{}'::jsonb)
    ) end
  )
  into v_course
  from public.enrollments e
  join public.courses c on c.id = e.course_id
  left join public.course_units u on u.id = e.current_unit_id
  left join public.unit_progress up on up.unit_id = u.id and up.student_id = p_student
  where e.student_id = p_student and e.status = 'active'
  order by e.updated_at desc
  limit 1;

  return jsonb_build_object(
    'current_course', v_course,
    -- an assignment is this student's when it has a submission row for them,
    -- or when it was set for an organisation they belong to
    'open_assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'title', coalesce(e.title, 'assignment'),
        'type', e.type, 'due', a.end_at
      ) order by a.end_at nulls last)
      from public.assignments a
      left join public.exercises e on e.id = a.exercise_id
      where (a.end_at is null or a.end_at > now())
        and (
          exists (select 1 from public.submissions s
                  where s.assignment_id = a.id and s.student_id = p_student)
          or a.org_id in (select m.org_id from public.organization_members m
                          where m.user_id = p_student)
        )
        and not exists (
          select 1 from public.submissions s
          where s.assignment_id = a.id and s.student_id = p_student
            and s.status <> 'pending'
        )
    ), '[]'::jsonb),
    'top_weaknesses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item', w.item, 'source', w.source, 'last_seen', w.created_at
      ) order by w.created_at desc)
      from (select * from public.weaknesses w2 where w2.student_id = p_student
            order by w2.created_at desc limit 5) w
    ), '[]'::jsonb),
    'memories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'key', m.key, 'content', m.content,
        'source_session_id', m.source_session_id, 'updated_at', m.updated_at,
        'deleted_at', m.deleted_at
      ) order by m.updated_at desc, m.id)
      from public.user_memories m where m.user_id = p_student
    ), '[]'::jsonb),
    'last_session_summary', (
      select s.summary from public.sessions s
      where s.student_id = p_student and s.summary is not null
      order by s.started_at desc nulls last limit 1
    )
  );
end;
$$;

commit;
