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

-- Synthetic scale check only. All rows and DDL roll back.
insert into public.sessions(id,student_id,persona_id)
select md5('perf-session-' || i)::uuid,'aa120000-0000-4000-8000-000000000002','frank' from generate_series(1,10000) i;
insert into public.lesson_attempts(id,session_id,unit_id,step_id,scores,passed)
select md5('perf-attempt-' || i)::uuid,md5('perf-session-' || (1+(i%10000)))::uuid,
 'dd120000-0000-4000-8000-000000000001','learn','{}',true from generate_series(1,100000) i;
analyze public.sessions;
analyze public.lesson_attempts;
drop index public.lesson_attempts_session_recent;
explain (analyze, buffers)
select a.id, a.summary, a.passed, a.created_at from public.lesson_attempts a
join public.sessions s on s.id=a.session_id
where s.student_id='aa120000-0000-4000-8000-000000000001'
order by a.created_at desc limit 8;
create index lesson_attempts_session_recent on public.lesson_attempts(session_id,created_at desc);
explain (analyze, buffers)
select a.id, a.summary, a.passed, a.created_at from public.lesson_attempts a
join public.sessions s on s.id=a.session_id
where s.student_id='aa120000-0000-4000-8000-000000000001'
order by a.created_at desc limit 8;
rollback;
