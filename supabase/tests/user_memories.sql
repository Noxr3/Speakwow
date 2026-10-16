begin;
insert into auth.users(id, email) values
 ('aaaaaaaa-0000-4000-8000-000000000001', 'ada@test.local'),
 ('bbbbbbbb-0000-4000-8000-000000000002', 'bo@test.local');
insert into public.sessions(id, student_id, persona_id) values
 ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'frank');
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare v timestamptz;
begin
 assert public.apply_user_memory('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 'pet', 'create', 'Has a cat.', null);
 select updated_at into v from public.user_memories where key = 'pet';
 assert not public.apply_user_memory('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 'pet', 'create', 'Duplicate.', null);
 assert public.apply_user_memory('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 'pet', 'update', 'Has a dog.', v);
 assert not public.apply_user_memory('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 'pet', 'delete', null, v), 'stale delete rejected';
 begin
  perform public.apply_user_memory('bbbbbbbb-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000001', 'pet', 'create', 'Wrong student.', null);
  raise exception 'cross-user session accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
update public.user_memories set content = 'User corrected this.' where key = 'pet';
do $$
begin
 assert (select source_session_id is null from public.user_memories where key = 'pet'), 'user correction protected';
 begin
  insert into public.user_memories(user_id, key, content) values('bbbbbbbb-0000-4000-8000-000000000002', 'bad', 'Cross-user.');
  raise exception 'cross-user insert accepted';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.apply_user_memory('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 'bad', 'create', 'Bypass.', null);
  raise exception 'user invoked agent RPC';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare v timestamptz;
begin
 select updated_at into v from public.user_memories where key = 'pet';
 assert not public.apply_user_memory('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 'pet', 'update', 'Overwrite user.', v);
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
update public.user_memories set deleted_at = now() where key = 'pet';
do $$
begin
 assert (select content = '' and source_session_id is null from public.user_memories where key = 'pet'), 'forget erases content and source';
end $$;
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare v timestamptz;
begin
 select updated_at into v from public.user_memories where key = 'pet';
 assert not public.apply_user_memory('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 'pet', 'create', 'Resurrect.', null);
 assert not public.apply_user_memory('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 'pet', 'update', 'Resurrect.', v);
end $$;
reset role;
rollback;
