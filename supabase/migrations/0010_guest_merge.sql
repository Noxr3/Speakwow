-- A guest's practice is kept, and moves into their account when they sign in.
--
-- A visitor who starts a call without signing in becomes an anonymous user
-- (Supabase anonymous sign-in, auth.users.is_anonymous). Everything the
-- teacher learns about them is then saved exactly as for a student: their
-- sessions, words, memories, course and progress. When they sign in to an
-- account, the web asks them, and merge_guest_into moves it all across.
--
-- Where both have the same thing (a memory under the same key, the same
-- course or unit, the same saved API key), the account's own wins: what was
-- built up over many calls is not replaced by one evening as a guest. What
-- is left behind goes when the server deletes the anonymous user after the
-- merge (every table cascades from profiles).

create function public.merge_guest_into(p_guest uuid, p_account uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  moved jsonb := '{}'::jsonb;
  n integer;
  had_active boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not allowed to merge accounts' using errcode = '42501';
  end if;
  -- Only an anonymous user is ever merged, and only into a real account:
  -- one signed-in account can never be folded into another.
  if p_guest is null or p_account is null or p_guest = p_account
     or not exists (select 1 from auth.users where id = p_guest and is_anonymous)
     or not exists (select 1 from auth.users where id = p_account and not is_anonymous)
  then
    raise exception 'only a guest can be merged into a signed-in account'
      using errcode = '42501';
  end if;

  -- Calls, with their words (messages hang off the session).
  update public.sessions set student_id = p_account where student_id = p_guest;
  get diagnostics n = row_count;
  moved := moved || jsonb_build_object('sessions', n);

  update public.weaknesses set student_id = p_account where student_id = p_guest;
  get diagnostics n = row_count;
  moved := moved || jsonb_build_object('weaknesses', n);

  update public.attempts set student_id = p_account where student_id = p_guest;
  update public.assessments set student_id = p_account where student_id = p_guest;

  -- Memories are copied: their stamp trigger keeps user_id fixed on update.
  -- A key the account already has (even one it deleted) stays the account's.
  insert into public.user_memories (user_id, key, content, source_session_id, created_at)
  select p_account, g.key, g.content, g.source_session_id, g.created_at
  from public.user_memories g
  where g.user_id = p_guest and g.deleted_at is null
  on conflict (user_id, key) do nothing;
  get diagnostics n = row_count;
  moved := moved || jsonb_build_object('memories', n);

  -- Courses. The account's active course stays its active one; the guest's
  -- becomes paused next to it. Same course or unit: the account's row wins.
  select exists (
    select 1 from public.enrollments
    where student_id = p_account and status = 'active'
  ) into had_active;
  update public.enrollments g
    set student_id = p_account,
        status = case when had_active and g.status = 'active' then 'paused' else g.status end,
        updated_at = now()
  where g.student_id = p_guest
    and not exists (
      select 1 from public.enrollments a
      where a.student_id = p_account and a.course_id = g.course_id
    );
  get diagnostics n = row_count;
  moved := moved || jsonb_build_object('enrollments', n);

  update public.unit_progress g set student_id = p_account
  where g.student_id = p_guest
    and not exists (
      select 1 from public.unit_progress a
      where a.student_id = p_account and a.unit_id = g.unit_id
    );

  update public.submissions g set student_id = p_account
  where g.student_id = p_guest
    and not exists (
      select 1 from public.submissions a
      where a.student_id = p_account and a.assignment_id = g.assignment_id
    );

  update public.user_api_keys set user_id = p_account
  where user_id = p_guest
    and not exists (select 1 from public.user_api_keys where user_id = p_account);

  update public.student_phones set student_id = p_account where student_id = p_guest;
  update public.subscriptions set user_id = p_account where user_id = p_guest;
  update public.organization_members g set user_id = p_account
  where g.user_id = p_guest
    and not exists (
      select 1 from public.organization_members a
      where a.user_id = p_account and a.org_id = g.org_id
    );

  return moved;
end;
$$;

revoke all on function public.merge_guest_into(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_guest_into(uuid, uuid) to service_role;
