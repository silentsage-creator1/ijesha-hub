begin;
-- Administrator-only API calls this service-role-only function.
create or replace function public.record_past_student_cohort(account_id uuid,target_cohort_id uuid,enrolled_on date)
returns uuid language plpgsql security definer set search_path=public as $$
declare a public.app_auth_users; c public.cohorts; sid uuid; course_name text; current_cid uuid;
begin
  select * into strict a from public.app_auth_users where id=account_id for update;
  if a.role <> 'student' or a.approval_status <> 'approved' then raise exception 'Select an approved student account.'; end if;
  select * into strict c from public.cohorts where id=target_cohort_id;
  if c.ends_on is null or c.ends_on >= current_date then raise exception 'Choose a completed cohort with an end date in the past.'; end if;
  if enrolled_on is null or enrolled_on > c.ends_on or (c.starts_on is not null and enrolled_on < c.starts_on) then raise exception 'Enrollment date must fall within the cohort training dates.'; end if;
  select title into strict course_name from public.app_courses where id=c.app_course_id;
  sid := a.student_id;
  if sid is null then select id into sid from public.students where lower(email)=lower(a.email) limit 1; end if;
  if sid is null then
    insert into public.students(full_name,email,track,status) values(a.full_name,a.email,course_name,'graduated') returning id into sid;
  end if;
  insert into public.enrollments(student_id,cohort_id,completion_status,created_at)
    values(sid,c.id,'completed',enrolled_on)
    on conflict(student_id,cohort_id) do update set completion_status='completed',created_at=excluded.created_at;
  -- Adding history must not replace another current course/cohort.
  select e.cohort_id into current_cid from public.enrollments e
    where e.student_id=sid and e.completion_status='in_progress' and e.cohort_id<>c.id
    order by (e.cohort_id=a.active_cohort_id) desc nulls last,e.created_at desc limit 1;
  if current_cid is null then
    update public.students set cohort=c.name,track=course_name,status='graduated' where id=sid;
    update public.app_auth_users set student_id=sid,active_cohort_id=c.id,track=course_name where id=a.id;
  else
    update public.students s set cohort=h.name,track=ac.title,status='active'
      from public.cohorts h join public.app_courses ac on ac.id=h.app_course_id where s.id=sid and h.id=current_cid;
    update public.app_auth_users set student_id=sid,active_cohort_id=current_cid where id=a.id;
  end if;
  return sid;
end;
$$;
revoke all on function public.record_past_student_cohort(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.record_past_student_cohort(uuid,uuid,date) to service_role;

create or replace function public.create_app_student(input jsonb,password_digest text)
returns uuid language plpgsql security definer set search_path=public as $$
declare aid uuid; sid uuid; cid uuid; cname text;
begin
  cid := (input->>'cohortId')::uuid;
  select a.title into strict cname from cohorts c join app_courses a on a.id=c.app_course_id
    where c.id=cid and a.id=(input->>'courseId')::uuid;
  insert into app_auth_users(email,full_name,password_hash,role,approval_status,track)
    values(lower(trim(input->>'email')),trim(concat_ws(' ',input->>'firstName',nullif(input->>'middleName',''),input->>'lastName')),password_digest,'student','approved',cname) returning id into aid;
  if coalesce((input->>'pastStudent')::boolean,false) then
    sid := public.record_past_student_cohort(aid,cid,(input->>'enrollmentDate')::date);
  else
    sid := public.assign_app_student_cohort(aid,cid);
  end if;
  insert into student_profile_details(student_id,first_name,middle_name,last_name,date_of_birth,gender,phone_number)
    values(sid,input->>'firstName',nullif(input->>'middleName',''),input->>'lastName',(input->>'dateOfBirth')::date,input->>'gender',input->>'phone')
    on conflict(student_id) do update set first_name=excluded.first_name,middle_name=excluded.middle_name,last_name=excluded.last_name,date_of_birth=excluded.date_of_birth,gender=excluded.gender,phone_number=excluded.phone_number;
  update enrollments set created_at=(input->>'enrollmentDate')::date where student_id=sid and cohort_id=cid;
  return sid;
end;
$$;
revoke all on function public.create_app_student(jsonb,text) from public,anon,authenticated;
grant execute on function public.create_app_student(jsonb,text) to service_role;
-- Separate entry point fails safely when this migration has not been installed.
create or replace function public.create_past_app_student(input jsonb,password_digest text)
returns uuid language sql security definer set search_path=public as $$
  select public.create_app_student(input || '{"pastStudent":true}'::jsonb,password_digest);
$$;
revoke all on function public.create_past_app_student(jsonb,text) from public,anon,authenticated;
grant execute on function public.create_past_app_student(jsonb,text) to service_role;
commit;
