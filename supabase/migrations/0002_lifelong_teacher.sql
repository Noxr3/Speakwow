-- Lifelong teacher: what the teacher knows about a student, the student's
-- learning record (学习档案) in a course, and bring-your-own-key.
--
-- Also fixes get_student_snapshot (0001), which any signed-in user could call
-- for ANY student id and read their weaknesses and session summaries, and
-- which listed every unexpired assignment in the system for every student.

-- ============ 学生档案：补充字段 ============

alter table public.profiles
  add column grade text,               -- e.g. "7" (初一)；水平自适应与选课用
  add column learning_goal text;       -- 学生自己写的目标，如「中考英语口语满分」

-- ============ 老师记得的事（facts） ============
-- 每次课后由 agent 从对话中提炼：目标、近期大事、兴趣、提到的人和宠物。
-- 学生可以在学习档案里查看、删除任何一条（透明 + 可撤回）。

create table public.student_facts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  fact text not null check (length(fact) between 1 and 500),
  session_id uuid references public.sessions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_student_facts_student on public.student_facts (student_id, created_at desc);

alter table public.student_facts enable row level security;
create policy student_facts_read_own on public.student_facts
  for select using (auth.uid() = student_id);
create policy student_facts_delete_own on public.student_facts
  for delete using (auth.uid() = student_id);
-- inserts come from the agent (service_role)

-- ============ BYOK：学生自带的模型 key（只存密文） ============
-- sealed_key 由 web 服务端用 BYOK_ENCRYPTION_KEY 加密（AES-256-GCM），
-- 只有持有同一密钥的 web 服务端与语音 agent 能解开；本人读到也只是密文。

create table public.user_api_keys (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('xai', 'openai')),
  sealed_key text not null check (sealed_key like 'v1.%'),
  key_hint text not null check (length(key_hint) <= 8),
  updated_at timestamptz not null default now()
);

alter table public.user_api_keys enable row level security;
create policy user_api_keys_own on public.user_api_keys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ 课程体系：教材元数据 ============

alter table public.courses
  add column slug text unique,                   -- e.g. "yilin-2024-7a"
  add column subject text not null default 'english',
  add column grade text,                         -- "7" / "8" / "9"
  add column term text,                          -- "A"（上册）/ "B"（下册）
  add column region text,                        -- e.g. "江苏"
  add column publisher text,                     -- e.g. "译林出版社"
  add column edition text,                       -- e.g. "2024"
  add column standard text,                      -- e.g. "义务教育英语课程标准（2022年版）"
  add column source text not null default 'repo'
    check (source in ('repo', 'dokki', 'teacher')),
  add column source_ref text,                    -- Dokki resource id when source = 'dokki'
  add column updated_at timestamptz not null default now();

alter table public.course_units
  add column theme text,                         -- 主题语境：人与自我 / 人与社会 / 人与自然
  add column topic text,
  -- [{ "id": "u1-g1", "kind": "speaking|grammar|vocabulary|function", "text": "..." }]
  add column goals jsonb not null default '[]',
  -- { "vocabulary": [...], "grammar": [...], "functions": [...], "speaking_tasks": [...] }
  add column content jsonb not null default '{}',
  add column source_ref text;

-- ============ 学习档案：选课与单元进度 ============

create table public.enrollments (
  student_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  current_unit_id uuid references public.course_units (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'paused', 'done')),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (student_id, course_id)
);

create table public.unit_progress (
  student_id uuid not null references public.profiles (id) on delete cascade,
  unit_id uuid not null references public.course_units (id) on delete cascade,
  status text not null default 'learning'
    check (status in ('learning', 'reviewing', 'mastered')),
  mastery numeric not null default 0 check (mastery between 0 and 1),
  goal_scores jsonb not null default '{}',       -- { "u1-g1": 0.8, ... }
  sessions integer not null default 0,
  last_studied_at timestamptz,
  primary key (student_id, unit_id)
);

alter table public.sessions
  add column mode text not null default 'free' check (mode in ('free', 'course')),
  add column unit_id uuid references public.course_units (id) on delete set null;

alter table public.enrollments enable row level security;
alter table public.unit_progress enable row level security;
create policy enrollments_own on public.enrollments
  for all using (auth.uid() = student_id) with check (auth.uid() = student_id);
create policy unit_progress_own on public.unit_progress
  for all using (auth.uid() = student_id) with check (auth.uid() = student_id);

-- ============ 学生快照 v2 ============
-- 调用者只能读自己的快照；agent 走 service_role。

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
    'profile', (
      select jsonb_build_object(
        'display_name', p.display_name, 'level', p.level, 'grade', p.grade,
        'learning_goal', p.learning_goal, 'preferred_topics', p.preferred_topics
      ) from public.profiles p where p.id = p_student
    ),
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
    'facts', coalesce((
      select jsonb_agg(jsonb_build_object('fact', f.fact, 'at', f.created_at)
                       order by f.created_at desc)
      from (select * from public.student_facts f2 where f2.student_id = p_student
            order by f2.created_at desc limit 12) f
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
