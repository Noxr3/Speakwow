begin;
-- Profile explicitly joins the student's sessions before reading recent attempts.
-- The FK had no index; this also avoids a table scan when a session is deleted.
-- Existing student-leading PKs already cover enrollments and unit_progress.
set local lock_timeout = '3s';
set local statement_timeout = '30s';
create index lesson_attempts_session_recent
  on public.lesson_attempts (session_id, created_at desc);
commit;
