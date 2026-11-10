begin;
insert into auth.users(id, email) values ('aa110000-0000-4000-8000-000000000001', 'course-test@example.test'), ('aa110000-0000-4000-8000-000000000002', 'other-test@example.test');
insert into public.profiles(id) values ('aa110000-0000-4000-8000-000000000001'), ('aa110000-0000-4000-8000-000000000002') on conflict do nothing;
insert into public.courses(id,title,subject) values ('cc110000-0000-4000-8000-000000000001','Course one','english'), ('cc110000-0000-4000-8000-000000000002','Course two','english');
insert into public.course_units(id,course_id,position,title,goals) values
('dd110000-0000-4000-8000-000000000001','cc110000-0000-4000-8000-000000000001',1,'First','[{"id":"u1-g1","text":"Speak independently","kind":"speaking"}]'),
('dd110000-0000-4000-8000-000000000002','cc110000-0000-4000-8000-000000000001',2,'Next','[{"id":"u2-g1","text":"Speak independently","kind":"speaking"}]'),
('dd110000-0000-4000-8000-000000000003','cc110000-0000-4000-8000-000000000002',1,'Other','[{"id":"u1-g1","text":"Speak independently","kind":"speaking"}]');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aa110000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.select_course('cc110000-0000-4000-8000-000000000001');
do $$ begin
  begin
    perform public.select_course('cc110000-0000-4000-8000-000000000001','dd110000-0000-4000-8000-000000000003');
    raise exception 'invalid unit accepted';
  exception when raise_exception then
    if sqlerrm = 'invalid unit accepted' then raise; end if;
  end;
  begin
    perform public.record_study_attempt(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'learn', '{}');
    raise exception 'student can grade themselves';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.sessions(id,student_id,persona_id,mode,unit_id) values
('ee110000-0000-4000-8000-000000000001','aa110000-0000-4000-8000-000000000001','frank','course','dd110000-0000-4000-8000-000000000001');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
-- A brand-new learner has no progress row; NULL must not bypass ordering.
do $$ begin
 begin
   perform public.record_study_attempt(gen_random_uuid(),'ee110000-0000-4000-8000-000000000001','dd110000-0000-4000-8000-000000000001','check','{"u1-g1":1}');
   raise exception 'new learner skipped teaching';
 exception when raise_exception then if sqlerrm='new learner skipped teaching' then raise; end if; end;
end $$;
select public.record_study_attempt('ff110000-0000-4000-8000-000000000001','ee110000-0000-4000-8000-000000000001','dd110000-0000-4000-8000-000000000001','learn','{"u1-g1":1}');
-- Replay of a committed response must not add another attempt.
select public.record_study_attempt('ff110000-0000-4000-8000-000000000001','ee110000-0000-4000-8000-000000000001','dd110000-0000-4000-8000-000000000001','learn','{"u1-g1":1}');
do $$ begin
 if (select count(*) from public.lesson_attempts where session_id='ee110000-0000-4000-8000-000000000001') <> 1 then raise exception 'duplicate attempt'; end if;
 begin
   perform public.record_study_attempt(gen_random_uuid(),'ee110000-0000-4000-8000-000000000001','dd110000-0000-4000-8000-000000000001','check','{"u1-g1":1}');
   raise exception 'skipped practice';
 exception when raise_exception then if sqlerrm='skipped practice' then raise; end if; end;
end $$;
select public.record_study_attempt('ff110000-0000-4000-8000-000000000002','ee110000-0000-4000-8000-000000000001','dd110000-0000-4000-8000-000000000001','practice','{"u1-g1":1}');
select public.record_study_attempt('ff110000-0000-4000-8000-000000000003','ee110000-0000-4000-8000-000000000001','dd110000-0000-4000-8000-000000000001','check','{"u1-g1":0.3}');
do $$ begin
 if (select status from public.unit_progress where unit_id='dd110000-0000-4000-8000-000000000001') = 'mastered' then raise exception 'practice incorrectly passed exam'; end if;
 if (select current_unit_id from public.enrollments where course_id='cc110000-0000-4000-8000-000000000001') <> 'dd110000-0000-4000-8000-000000000001' then raise exception 'failed exam advanced unit'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aa110000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.select_course('cc110000-0000-4000-8000-000000000002');
select public.select_course('cc110000-0000-4000-8000-000000000001');
do $$ begin
 if (select count(*) from public.enrollments where status='active') <> 1 then raise exception 'multiple active courses'; end if;
 if (public.get_student_snapshot(auth.uid()) #>> '{current_course,current_unit,session_progress,check,status}') <> 'reviewing' then raise exception 'progress lost after course switch'; end if;
end $$;
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.record_study_attempt('ff110000-0000-4000-8000-000000000004','ee110000-0000-4000-8000-000000000001','dd110000-0000-4000-8000-000000000001','check','{"u1-g1":0.9}');
do $$ begin
 if (select current_unit_id from public.enrollments where course_id='cc110000-0000-4000-8000-000000000001') <> 'dd110000-0000-4000-8000-000000000002' then raise exception 'passing exam did not advance'; end if;
end $$;
-- Reviewing a completed lesson records evidence without erasing prior mastery.
select public.record_study_attempt('ff110000-0000-4000-8000-000000000005','ee110000-0000-4000-8000-000000000001','dd110000-0000-4000-8000-000000000001','check','{"u1-g1":0.2}');
do $$ begin
 if (select status from public.unit_progress where unit_id='dd110000-0000-4000-8000-000000000001') <> 'mastered' then raise exception 'review erased mastery'; end if;
 if (select current_unit_id from public.enrollments where course_id='cc110000-0000-4000-8000-000000000001') <> 'dd110000-0000-4000-8000-000000000002' then raise exception 'review moved course backwards'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aa110000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.lesson_attempts where session_id='ee110000-0000-4000-8000-000000000001') then raise exception 'other student read attempts'; end if;
end $$;
reset role;
rollback;
