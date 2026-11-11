begin;
insert into auth.users(id,email) values
 ('aa120000-0000-4000-8000-000000000001','history-one@example.test'),
 ('aa120000-0000-4000-8000-000000000002','history-two@example.test');
insert into public.profiles(id) values
 ('aa120000-0000-4000-8000-000000000001'),('aa120000-0000-4000-8000-000000000002') on conflict do nothing;
insert into public.courses(id,title,subject) values ('cc120000-0000-4000-8000-000000000001','History test','english');
insert into public.course_units(id,course_id,position,title) values
 ('dd120000-0000-4000-8000-000000000001','cc120000-0000-4000-8000-000000000001',1,'First');
insert into public.sessions(id,student_id,persona_id) values
 ('ee120000-0000-4000-8000-000000000001','aa120000-0000-4000-8000-000000000001','frank'),
 ('ee120000-0000-4000-8000-000000000002','aa120000-0000-4000-8000-000000000002','lucy');
insert into public.lesson_attempts(id,session_id,unit_id,step_id,scores,passed) values
 ('ff120000-0000-4000-8000-000000000001','ee120000-0000-4000-8000-000000000001','dd120000-0000-4000-8000-000000000001','learn','{}',true),
 ('ff120000-0000-4000-8000-000000000002','ee120000-0000-4000-8000-000000000002','dd120000-0000-4000-8000-000000000001','learn','{}',true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aa120000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from public.lesson_attempts a join public.sessions s on s.id=a.session_id where s.student_id=auth.uid()) <> 1 then
   raise exception 'Own learning history missing';
 end if;
 if exists(select 1 from public.lesson_attempts a join public.sessions s on s.id=a.session_id where s.student_id='aa120000-0000-4000-8000-000000000002') then
   raise exception 'Other learner history leaked';
 end if;
 if (select count(*) from public.lesson_attempts) <> 1 then raise exception 'RLS bypassed without explicit filter'; end if;
end $$;
reset role;
rollback;
