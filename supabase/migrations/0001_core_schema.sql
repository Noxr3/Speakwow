-- Speakwow core schema (C1-B 定稿)
-- 硬约束：对话会话与课程/作业挂在同一学生档案（profiles）下、互相可引用。
-- 依据文档：C1-B 数据模型定稿（6f95cdfe）；agent 数据契约见其第五节。

-- ============ enums ============

-- 7 类内容/练习类型（wow3 六类素材合并入 exercises 单表）
create type public.exercise_type as enum (
  'scenario', 'talkabout', 'repeat', 'word', 'dictation', 'reading', 'write'
);

-- attempts.type 覆盖 wow3 全部 7 个 *_records collection；
-- imgtalk 为保留值（wow3 中为空壳，已决策丢弃，不迁移数据）
create type public.attempt_type as enum (
  'scenario', 'talkabout', 'repeat', 'word', 'dictation', 'write', 'imgtalk'
);

create type public.weakness_source as enum ('live_session', 'exercise');

create type public.submission_status as enum ('pending', 'submitted', 'graded');

create type public.subscription_status as enum (
  'active', 'trialing', 'past_due', 'canceled', 'incomplete'
);

-- ============ 学生档案（唯一的「人」） ============

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  level text,                          -- CEFR 等级（A1-C2），水平自适应用
  points integer not null default 0,   -- wow3 KV 积分迁入
  preferred_topics text[] not null default '{}',
  selected_textbook_id uuid,           -- wow3 kv.hget(userId,'textbook') 迁入；外键在 courses 建表后补
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 新用户注册自动建档
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ 课程体系（wow3 textbooks 嵌套拍平为三表） ============

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  access text not null default 'public',   -- wow3 access 字段
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_selected_textbook_fk
  foreign key (selected_textbook_id) references public.courses (id) on delete set null;

create table public.course_units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  position integer not null,
  title text not null,
  unique (course_id, position)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.course_units (id) on delete cascade,
  position integer not null,
  exercise_id uuid,                    -- 外键在 exercises 建表后补
  legacy_type text,                    -- wow3 lessons[{type,id}] 的 type 原值
  unique (unit_id, position)
);

-- ============ 练习素材（wow3 六类内容 collection 合并） ============

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  type public.exercise_type not null,
  title text not null,
  content jsonb not null default '{}',  -- prompt/character/flow/pages 数组等原样入
  access text not null default 'public',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.lessons
  add constraint lessons_exercise_fk
  foreign key (exercise_id) references public.exercises (id) on delete set null;

create index idx_exercises_type on public.exercises (type);

-- ============ 作业（老师端） ============

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid references public.exercises (id),   -- wow3 threadId
  course_id uuid references public.courses (id),       -- wow3 textbookId
  creator_id uuid references public.profiles (id),     -- 老师
  org_id uuid,                                         -- 组织维度 C4 展开
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status public.submission_status not null default 'pending',
  submitted_at timestamptz,
  best_attempt_id uuid,                -- 外键在 attempts 建表后补
  unique (assignment_id, student_id)
);

-- ============ 实时对话（Noxr3 侧新增） ============

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  persona_id text not null,            -- packages/shared/personas/*.json 的 id
  assignment_id uuid references public.assignments (id),  -- 硬约束②：会话可由作业发起
  room_name text,
  started_at timestamptz,
  ended_at timestamptz,
  summary text,                        -- 会话结束由共享层写入（话题/表现/发现）
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index idx_sessions_student on public.sessions (student_id, started_at desc);
create index idx_messages_session on public.messages (session_id, created_at);

-- ============ 练习记录（wow3 七个 *_records 合并为单表） ============

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  type public.attempt_type not null,
  exercise_id uuid references public.exercises (id),
  assignment_id uuid references public.assignments (id),  -- 硬约束③：练习可作为作业提交
  session_id uuid references public.sessions (id),        -- 硬约束③：练习可在陪练会话中发起
  score numeric,
  report jsonb,                        -- 评分报告（talkabout 四维/repeat 逐句等原样入）
  item_records jsonb,                  -- repeat 逐句 record[] 等
  is_finished boolean not null default false,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.submissions
  add constraint submissions_best_attempt_fk
  foreign key (best_attempt_id) references public.attempts (id) on delete set null;

-- 「时间窗内每生最高分」（作业批改）核心索引
create index idx_attempts_assignment on public.attempts (assignment_id, student_id, score);
create index idx_attempts_student_created on public.attempts (student_id, created_at desc);

-- ============ Azure 评测结果（C3 接入） ============

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  attempt_id uuid references public.attempts (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  language text not null default 'en-US',   -- Lucy 线需 en-GB，参数化
  scores jsonb not null default '{}',       -- pronunciation/accuracy/fluency/completeness/prosody/sum
  detail jsonb,                             -- phoneme 粒度明细
  created_at timestamptz not null default now()
);

-- ============ 薄弱点（家庭老师引导引擎数据源） ============

create table public.weaknesses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  item text not null,
  source public.weakness_source not null,
  evidence jsonb,                      -- 指向 attempt 或 session：{"attempt_id": ...} / {"session_id": ...}
  created_at timestamptz not null default now()
);

create index idx_weaknesses_student on public.weaknesses (student_id, created_at desc);

-- ============ 订阅（Stripe） ============

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status public.subscription_status not null default 'incomplete',
  plan text,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create unique index uq_subscriptions_stripe_sub on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- ============ 组织成员（课堂体系，C4 展开） ============

create table public.organization_members (
  org_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'student' check (role in ('teacher', 'student', 'admin')),
  joined_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- ============ 学生快照（agent 读路径，C1-B §5） ============
-- 会话开始时一次调用：select public.get_student_snapshot(:student_id);
-- 返回 {profile, open_assignments, top_weaknesses, last_session_summary}

create or replace function public.get_student_snapshot(p_student uuid)
returns jsonb
language sql security definer set search_path = public
stable
as $$
  select jsonb_build_object(
    'profile', (
      select jsonb_build_object(
        'display_name', p.display_name, 'level', p.level,
        'preferred_topics', p.preferred_topics
      ) from public.profiles p where p.id = p_student
    ),
    'open_assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'title', coalesce(e.title, 'assignment'),
        'type', a.exercise_id, 'due', a.end_at
      ) order by a.end_at nulls last)
      from public.assignments a
      left join public.exercises e on e.id = a.exercise_id
      where (a.end_at is null or a.end_at > now())
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
    'last_session_summary', (
      select s.summary from public.sessions s
      where s.student_id = p_student and s.summary is not null
      order by s.started_at desc nulls last limit 1
    )
  );
$$;

-- ============ RLS ============
-- web 端一律 anon key + 下列 policy；agent 用 service_role（仅 Railway 持有，
-- 绕过 RLS），豁免范围 = 快照读路径 + sessions/messages/weaknesses 写入（C1-B §5）。

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_units enable row level security;
alter table public.lessons enable row level security;
alter table public.exercises enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.sessions enable row level security;
alter table public.messages enable row level security;
alter table public.attempts enable row level security;
alter table public.assessments enable row level security;
alter table public.weaknesses enable row level security;
alter table public.subscriptions enable row level security;
alter table public.organization_members enable row level security;

-- profiles：本人读写
create policy profiles_self on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- 学习内容：登录用户可读，创建者可写
create policy content_read on public.courses for select to authenticated using (true);
create policy content_read on public.course_units for select to authenticated using (true);
create policy content_read on public.lessons for select to authenticated using (true);
create policy content_read on public.exercises for select to authenticated using (true);
create policy content_write on public.courses for all to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy content_write on public.exercises for all to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy units_write on public.course_units for all to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.created_by = auth.uid()))
  with check (exists (select 1 from public.courses c where c.id = course_id and c.created_by = auth.uid()));
create policy lessons_write on public.lessons for all to authenticated
  using (exists (
    select 1 from public.course_units u join public.courses c on c.id = u.course_id
    where u.id = unit_id and c.created_by = auth.uid()))
  with check (exists (
    select 1 from public.course_units u join public.courses c on c.id = u.course_id
    where u.id = unit_id and c.created_by = auth.uid()));

-- 作业：登录用户可读（学生需看到布置的作业），老师可写
create policy assignments_read on public.assignments for select to authenticated using (true);
create policy assignments_write on public.assignments for all to authenticated
  using (creator_id = auth.uid()) with check (creator_id = auth.uid());

-- 学习数据：学生本人全权（同一档案，陪练↔课程共用）
create policy submissions_own on public.submissions
  for all using (auth.uid() = student_id) with check (auth.uid() = student_id);
create policy sessions_own on public.sessions
  for all using (auth.uid() = student_id) with check (auth.uid() = student_id);
create policy messages_own on public.messages
  for all using (exists (select 1 from public.sessions s where s.id = session_id and s.student_id = auth.uid()))
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.student_id = auth.uid()));
create policy attempts_own on public.attempts
  for all using (auth.uid() = student_id) with check (auth.uid() = student_id);
create policy assessments_own on public.assessments
  for all using (auth.uid() = student_id) with check (auth.uid() = student_id);
create policy weaknesses_own on public.weaknesses
  for all using (auth.uid() = student_id) with check (auth.uid() = student_id);
create policy subscriptions_own on public.subscriptions
  for select using (auth.uid() = user_id);
create policy org_members_own on public.organization_members
  for select using (auth.uid() = user_id);
