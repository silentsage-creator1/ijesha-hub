begin;
alter table public.app_auth_users add column if not exists active_cohort_id uuid references public.cohorts(id) on delete set null;
create or replace function public.assign_app_student_cohort(account_id uuid, target_cohort_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare a public.app_auth_users; c public.cohorts; sid uuid; course_name text;
begin
  select * into strict a from public.app_auth_users where id=account_id for update;
  if a.role <> 'student' or a.approval_status <> 'approved' then
    raise exception 'Approve this student account before assigning a cohort.';
  end if;
  select * into strict c from public.cohorts where id=target_cohort_id;
  select title into strict course_name from public.app_courses where id=c.app_course_id;
  sid := a.student_id;
  if sid is null then
    select id into sid from public.students where lower(email)=lower(a.email) limit 1;
  end if;
  if sid is null then
    insert into public.students(full_name,email,track,status) values(a.full_name,a.email,course_name,'active') returning id into sid;
  end if;
  insert into public.enrollments(student_id,cohort_id,completion_status)
    values(sid,c.id,'in_progress')
    on conflict(student_id,cohort_id) do update set completion_status='in_progress';
  update public.students set cohort=c.name,track=course_name where id=sid;
  update public.app_auth_users set student_id=sid,active_cohort_id=c.id where id=a.id;
  return sid;
end;
$$;
revoke all on function public.assign_app_student_cohort(uuid,uuid) from public,anon,authenticated;
grant execute on function public.assign_app_student_cohort(uuid,uuid) to service_role;
commit;
