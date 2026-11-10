begin;
alter table public.unit_progress add column session_progress jsonb not null default '{}';

-- One successful transaction selects the course and preserves every other place.
create function public.select_student_course(p_student uuid, p_course uuid, p_unit uuid default null)
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
revoke all on function public.select_student_course(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.select_student_course(uuid, uuid, uuid) to service_role;

create function public.select_course(p_course uuid, p_unit uuid default null)
returns void language sql security definer set search_path = public as $$
  select public.select_student_course(auth.uid(), p_course, p_unit);
$$;
revoke all on function public.select_course(uuid, uuid) from public, anon;
grant execute on function public.select_course(uuid, uuid) to authenticated;

-- A definition is data, never a call. Legacy units receive stable default sessions.
create function public.course_sessions(p_unit public.course_units)
returns jsonb language sql stable set search_path = public as $$
  select case when jsonb_typeof(p_unit.content->'sessions') = 'array' and jsonb_array_length(p_unit.content->'sessions') > 0
    then p_unit.content->'sessions'
    else (select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'kind', s.kind,
      'activity', 'mixed', 'goal_ids', (select coalesce(jsonb_agg(g->>'id'), '[]') from jsonb_array_elements(p_unit.goals) g)))
      from (values ('learn','Learn together','lesson'), ('practice','Make it your own','practice'), ('check','Independent check','exam')) s(id,title,kind)) end;
$$;

-- Attempts belong to the call, so guest-account merges transfer them with sessions.
create table public.lesson_attempts (
  id uuid primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  unit_id uuid not null references public.course_units(id) on delete cascade,
  step_id text not null,
  scores jsonb not null,
  passed boolean not null,
  summary text not null default '',
  created_at timestamptz not null default now()
);
alter table public.lesson_attempts enable row level security;
create policy lesson_attempts_read on public.lesson_attempts for select using (
  exists(select 1 from public.sessions s where s.id = session_id and s.student_id = auth.uid())
);
grant select on public.lesson_attempts to authenticated;
grant all on public.lesson_attempts to service_role;

create function public.study_unit(p_student uuid, p_unit uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', u.id, 'position', u.position, 'title', u.title,
    'theme', u.theme, 'topic', u.topic, 'goals', u.goals,
    'content', u.content || jsonb_build_object('sessions', public.course_sessions(u)),
    'status', coalesce(p.status, 'learning'), 'mastery', coalesce(p.mastery, 0),
    'goal_scores', coalesce(p.goal_scores, '{}'), 'sessions', coalesce(p.sessions, 0),
    'session_progress', coalesce(p.session_progress, '{}'))
  from public.course_units u left join public.unit_progress p on p.unit_id = u.id and p.student_id = p_student
  where u.id = p_unit;
$$;
revoke all on function public.study_unit(uuid, uuid) from public, anon, authenticated;
grant execute on function public.study_unit(uuid, uuid) to service_role;

-- Exactly-once scoring, serialized with course selection. Failed/missing goals
-- cannot pass; each exam uses only its own fresh scores, not practice mastery.
create function public.record_study_attempt(p_attempt uuid, p_session uuid, p_unit uuid,
  p_step text, p_scores jsonb, p_summary text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_student uuid; v_unit public.course_units; v_step jsonb; v_steps jsonb;
  v_progress public.unit_progress; v_pass boolean; v_all boolean; v_mastery numeric;
  v_goal text; v_scores jsonb := '{}'; v_fresh_scores jsonb; v_session_progress jsonb; v_next uuid;
  v_place uuid; v_expected text; v_attempt public.lesson_attempts; v_review boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Agent only' using errcode = '42501'; end if;
  select student_id into v_student from public.sessions where id = p_session and mode = 'course';
  if v_student is null then raise exception 'Unknown lesson call'; end if;
  perform 1 from public.profiles where id = v_student for update;
  select * into v_unit from public.course_units where id = p_unit;
  if v_unit.id is null or not exists(select 1 from public.enrollments where student_id = v_student and course_id = v_unit.course_id)
    then raise exception 'Not enrolled'; end if;
  select current_unit_id into v_place from public.enrollments where student_id = v_student and course_id = v_unit.course_id;
  select * into v_attempt from public.lesson_attempts where id = p_attempt;
  if found then
    if v_attempt.session_id <> p_session or v_attempt.unit_id <> p_unit or v_attempt.step_id <> p_step then
      raise exception 'Attempt identity mismatch'; end if;
    return public.study_unit(v_student, coalesce(v_place, p_unit));
  end if;
  v_steps := public.course_sessions(v_unit);
  select * into v_progress from public.unit_progress where student_id = v_student and unit_id = p_unit for update;
  v_session_progress := coalesce(v_progress.session_progress, '{}');
  select s->>'id' into v_expected from jsonb_array_elements(v_steps) s
    where coalesce(v_session_progress->(s->>'id')->>'status', '') <> 'mastered' limit 1;
  v_review := coalesce(v_progress.status = 'mastered', false) and (v_expected is null or v_session_progress = '{}');
  if p_step is distinct from v_expected and not v_review then
    if v_session_progress->p_step->>'status' = 'mastered' then
      return public.study_unit(v_student, coalesce(v_place, p_unit));
    end if;
    raise exception 'Session out of order';
  end if;
  select s into v_step from jsonb_array_elements(v_steps) s where s->>'id' = p_step;
  if v_step is null then raise exception 'Unknown session'; end if;
  if jsonb_typeof(p_scores) <> 'object' or jsonb_array_length(v_step->'goal_ids') = 0 then raise exception 'Invalid scores'; end if;
  for v_goal in select jsonb_array_elements_text(v_step->'goal_ids') loop
    if not exists(select 1 from jsonb_array_elements(v_unit.goals) g where g->>'id' = v_goal) then raise exception 'Unknown goal'; end if;
    if p_scores ? v_goal then
      if jsonb_typeof(p_scores->v_goal) <> 'number' or (p_scores->>v_goal)::numeric not between 0 and 1 then raise exception 'Invalid score'; end if;
      v_scores := v_scores || jsonb_build_object(v_goal, p_scores->v_goal);
    end if;
  end loop;
  if v_scores = '{}' then raise exception 'No learning evidence'; end if;
  v_fresh_scores := v_scores;
  if v_step->>'kind' <> 'exam' then
    v_scores := coalesce(v_session_progress->p_step->'scores', '{}') || v_scores;
  end if;
  select bool_and(coalesce((v_scores->>g)::numeric, 0) >= 0.8), avg(coalesce((v_scores->>g)::numeric, 0))
    into v_pass, v_mastery from jsonb_array_elements_text(v_step->'goal_ids') g;
  v_session_progress := v_session_progress || jsonb_build_object(p_step, jsonb_build_object(
    'status', case when v_pass then 'mastered' else 'reviewing' end,
    'mastery', v_mastery, 'scores', v_scores, 'summary', left(coalesce(p_summary, ''), 2000), 'updated_at', now(),
    'attempts', coalesce((v_session_progress->p_step->>'attempts')::int, 0) + 1));
  select bool_and(coalesce(v_session_progress->(s->>'id')->>'status', '') = 'mastered'),
    avg(coalesce((v_session_progress->(s->>'id')->>'mastery')::numeric, 0))
    into v_all, v_mastery from jsonb_array_elements(v_steps) s;
  insert into public.lesson_attempts(id, session_id, unit_id, step_id, scores, passed, summary)
    values(p_attempt, p_session, p_unit, p_step, v_fresh_scores, v_pass, left(coalesce(p_summary, ''), 2000));
  if v_review then return public.study_unit(v_student, p_unit); end if;
  insert into public.unit_progress(student_id, unit_id, goal_scores, mastery, status, sessions, last_studied_at, session_progress)
    values(v_student, p_unit, coalesce(v_progress.goal_scores, '{}') || v_scores, v_mastery,
      case when v_all then 'mastered' else 'learning' end, coalesce(v_progress.sessions, 0) + 1, now(), v_session_progress)
    on conflict(student_id, unit_id) do update set goal_scores = excluded.goal_scores,
      mastery = excluded.mastery, status = excluded.status, sessions = excluded.sessions,
      last_studied_at = excluded.last_studied_at, session_progress = excluded.session_progress;
  if v_all and v_place = p_unit then
    select id into v_next from public.course_units where course_id = v_unit.course_id and position > v_unit.position order by position limit 1;
    if v_next is not null then
      update public.enrollments set current_unit_id = v_next where student_id = v_student and course_id = v_unit.course_id and current_unit_id = p_unit;
    end if;
  end if;
  return public.study_unit(v_student, coalesce(v_next, p_unit));
end $$;
revoke all on function public.record_study_attempt(uuid, uuid, uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.record_study_attempt(uuid, uuid, uuid, text, jsonb, text) to service_role;

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
    'id', c.id, 'title', c.title, 'slug', c.slug,
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

revoke execute on function public.get_student_snapshot(uuid) from public, anon;
grant execute on function public.get_student_snapshot(uuid) to authenticated, service_role;


commit;
