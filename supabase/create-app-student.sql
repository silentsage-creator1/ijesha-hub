-- Atomic staff-created account, profile details and cohort enrollment.
create or replace function public.create_app_student(input jsonb, password_digest text)
returns uuid language plpgsql security definer set search_path=public as $$
declare aid uuid; sid uuid; cid uuid; cname text;
begin
  cid := (input->>'cohortId')::uuid;
  select a.title into strict cname from cohorts c join app_courses a on a.id=c.app_course_id
    where c.id=cid and a.id=(input->>'courseId')::uuid;
  insert into app_auth_users(email,full_name,password_hash,role,approval_status,track)
    values(lower(trim(input->>'email')),trim(concat_ws(' ',input->>'firstName',nullif(input->>'middleName',''),input->>'lastName')),password_digest,'student','approved',cname)
    returning id into aid;
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
