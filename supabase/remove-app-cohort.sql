-- Install once. This migration does not delete any cohort.
-- The application calls this transaction only after staff confirms removal.
begin;
create or replace function public.remove_app_cohort(target_id uuid, expected_name text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  target_name text;
  account_ids uuid[];
  student_ids uuid[];
  profile_ids uuid[];
  course_ids uuid[];
  affected_students uuid[];
  child_table text;
begin
  select name into target_name from public.cohorts where id = target_id for update;
  if not found then raise exception 'Target cohort not found. Nothing was deleted.'; end if;
  if expected_name is null or target_name is distinct from expected_name then raise exception 'Cohort name differs from the confirmed target. Nothing was deleted.'; end if;

  select array_agg(id) into account_ids from public.app_auth_users;
  select array_agg(id) into student_ids from public.students;
  select array_agg(id) into profile_ids from public.profiles;
  select array_agg(id) into course_ids from public.app_courses;
  select array_agg(distinct student_id) into affected_students from (
    select student_id from public.enrollments where cohort_id = target_id
    union select student_id from public.app_auth_users where active_cohort_id = target_id
  ) linked;

  -- Remove pointers only, never the people or course records themselves.
  update public.app_auth_users set active_cohort_id = null where active_cohort_id = target_id;
  update public.app_courses set cohort_id = null where cohort_id = target_id;
  update public.students set cohort = null
    where id = any(coalesce(affected_students, array[]::uuid[])) and cohort = target_name;

  -- Explicit allowlist: only records whose cohort_id matches the confirmed ID.
  -- Child submissions, resources, scores and progress follow their existing FKs.
  foreach child_table in array array[
    'attendance', 'app_learning_items', 'assessments', 'assignments', 'projects',
    'training_sessions', 'announcements', 'sponsor_assignments', 'sponsorships',
    'cohort_schedules', 'enrollments'
  ] loop
    if exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = child_table and column_name = 'cohort_id') then
      execute format('delete from public.%I where cohort_id = $1', child_table) using target_id;
    end if;
  end loop;
  delete from public.cohorts where id = target_id;

  -- Fail closed if any unexpected cascade/trigger removes a protected record.
  if exists (select 1 from unnest(account_ids) x(id) where not exists(select 1 from public.app_auth_users a where a.id=x.id))
    or exists (select 1 from unnest(student_ids) x(id) where not exists(select 1 from public.students s where s.id=x.id))
    or exists (select 1 from unnest(profile_ids) x(id) where not exists(select 1 from public.profiles p where p.id=x.id))
    or exists (select 1 from unnest(course_ids) x(id) where not exists(select 1 from public.app_courses c where c.id=x.id)) then
    raise exception 'Protected account, student, profile or course was affected. All deletion changes are rolled back.';
  end if;
  return true;
end;
$$;
revoke all on function public.remove_app_cohort(uuid,text) from public, anon, authenticated;
grant execute on function public.remove_app_cohort(uuid,text) to service_role;
notify pgrst, 'reload schema';
commit;
