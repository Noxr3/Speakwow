-- Phone calls and text messages with the same teacher.
--
-- A student links a phone number on the website and proves it with a code
-- sent to that phone; from then on a call or a text from that number is the
-- same student, with the same memory. Numbers are written only by the server
-- (service role) after the code checks out, never by the browser, so nobody
-- can claim a number they do not hold.

create table public.student_phones (
  phone text primary key check (phone ~ '^\+[1-9][0-9]{6,14}$'), -- E.164
  student_id uuid not null references public.profiles (id) on delete cascade,
  verified_at timestamptz not null default now(),
  -- the student texted STOP: the teacher stops replying by text
  sms_opted_out boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_student_phones_student on public.student_phones (student_id);

alter table public.student_phones enable row level security;

create policy "student_phones: read own"
  on public.student_phones for select
  using (student_id = auth.uid());

create policy "student_phones: remove own"
  on public.student_phones for delete
  using (student_id = auth.uid());

-- Which door a session came through. A text conversation is a session too,
-- one per student per day, so calls and texts share one history.
alter table public.sessions
  add column channel text not null default 'web'
    check (channel in ('web', 'phone', 'sms'));

create index idx_sessions_student_channel
  on public.sessions (student_id, channel, started_at desc);
