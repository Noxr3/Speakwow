-- User understanding is a flat list of declarative memories, as in Dokki.
-- Profiles remains the account identity/billing FK anchor, not a second memory store.
begin;
create table public.user_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  content text not null check (length(content) <= 800),
  source_session_id uuid references public.sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  unique (user_id, key),
  check (deleted_at is not null or length(trim(content)) > 0)
);
create index user_memories_recent on public.user_memories(user_id, updated_at desc);
alter table public.user_memories enable row level security;
create policy user_memories_own on public.user_memories for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update on public.user_memories to authenticated;
revoke delete on public.user_memories from authenticated, anon;
grant all on public.user_memories to service_role;

-- A forgotten memory retains only its key/version, so a delayed reflection cannot
-- recreate it. Explicit user edits become protected, user-authored memories.
create function public.stamp_user_memory() returns trigger
language plpgsql set search_path = public as $$
begin
  if TG_OP = 'UPDATE' then
    new.id := old.id;
    new.user_id := old.user_id;
    new.key := old.key;
    new.created_at := old.created_at;
  end if;
  if coalesce(auth.role(), '') = 'authenticated' then
    new.source_session_id := null;
  end if;
  if new.deleted_at is not null then
    new.content := '';
    new.source_session_id := null;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create trigger stamp_user_memory before insert or update on public.user_memories
  for each row execute function public.stamp_user_memory();

-- Preserve existing information before retiring the fixed fields.
insert into public.user_memories(user_id, key, content)
select p.id, case when length(v.content) > 800 then v.key || '-part-' || chunk.n else v.key end,
  substring(v.content from (chunk.n - 1) * 800 + 1 for 800)
from public.profiles p
cross join lateral (values
  ('preferred-name', case when nullif(trim(p.display_name), '') is not null then 'The student prefers to be called ' || p.display_name || '.' end),
  ('english-level', case when nullif(trim(p.level), '') is not null then 'The student''s previously recorded English level is CEFR ' || p.level || '.' end),
  ('school-context', case when nullif(trim(p.grade), '') is not null then 'The student previously reported school grade ' || p.grade || '.' end),
  ('learning-intention', case when nullif(trim(p.learning_goal), '') is not null then 'The student previously described their learning intention: ' || p.learning_goal end),
  ('interests', case when cardinality(p.preferred_topics) > 0 then 'The student enjoys talking about: ' || array_to_string(p.preferred_topics, ', ') end)
) v(key, content)
cross join lateral generate_series(1, (length(v.content) + 799) / 800) chunk(n)
where v.content is not null;
insert into public.user_memories(user_id, key, content, source_session_id, created_at)
select student_id, 'fact-' || replace(id::text, '-', ''), fact, session_id, created_at
from public.student_facts;

-- Service-only, exact student/session binding plus compare-and-set. Creates
-- never overwrite an existing key; stale updates/deletes return false.
create function public.apply_user_memory(
  p_student uuid, p_session uuid, p_key text, p_action text,
  p_content text, p_expected_updated_at timestamptz
) returns boolean language plpgsql security definer set search_path = public as $$
declare changed integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' or not exists (
    select 1 from public.sessions where id = p_session and student_id = p_student
  ) then
    raise exception 'memory session scope unavailable' using errcode = '42501';
  end if;
  if p_action = 'create' and p_expected_updated_at is null then
    insert into public.user_memories(user_id, key, content, source_session_id)
    values(p_student, p_key, p_content, p_session)
    on conflict(user_id, key) do nothing;
  elsif p_action in ('update', 'delete') and p_expected_updated_at is not null then
    update public.user_memories set
      content = case when p_action = 'delete' then '' else p_content end,
      deleted_at = case when p_action = 'delete' then clock_timestamp() else null end,
      source_session_id = p_session
    where user_id = p_student and key = p_key
      and updated_at = p_expected_updated_at and deleted_at is null
      and source_session_id is not null;
  else
    return false;
  end if;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;
revoke all on function public.apply_user_memory(uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_user_memory(uuid, uuid, text, text, text, timestamptz) to service_role;

-- Signup identity is separate from the learner's conversational identity.
-- Do not guess a preferred name from an email or re-import it after deletion.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id) values(new.id);
  return new;
end;
$$;

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
      'sessions', coalesce(up.sessions, 0)
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

alter table public.profiles
  drop column display_name, drop column level, drop column grade,
  drop column learning_goal, drop column preferred_topics;
drop table public.student_facts;
commit;
