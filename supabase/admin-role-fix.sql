-- ============================================================================
-- IJESHA DIGITAL HUB - PLATFORM ADMINISTRATOR PROMOTION & ACCESS FIX
-- Run this in your Supabase Project > SQL Editor
-- ============================================================================

-- 1. Ensure 'admin' role on profiles for info@ijeshadigitalhub.com and administrators
update public.profiles
set role = 'admin',
    approval_status = 'approved',
    full_name = coalesce(full_name, 'Ijesha Digital Hub Admin'),
    organization = 'Ijesha Digital Hub'
where id in (
  select id from auth.users
  where lower(email) in (
    'info@ijeshadigitalhub.com',
    'info@ijeshadigitalhub.org',
    'sparklesdon1@gmail.com',
    'martinsalatise1@gmail.com',
    'martinsalatise5@gmail.com'
  )
  or lower(email) like 'martinsalatise%@gmail.com'
  or lower(email) like 'admin@%'
);

-- 2. Clean up any accidental student roster entries for the admin
delete from public.students
where lower(email) in (
  'info@ijeshadigitalhub.com',
  'info@ijeshadigitalhub.org',
  'sparklesdon1@gmail.com',
  'martinsalatise1@gmail.com',
  'martinsalatise5@gmail.com'
)
or lower(email) like 'martinsalatise%@gmail.com'
or profile_id in (
  select id from auth.users
  where lower(email) in (
    'info@ijeshadigitalhub.com',
    'info@ijeshadigitalhub.org',
    'sparklesdon1@gmail.com',
    'martinsalatise1@gmail.com',
    'martinsalatise5@gmail.com'
  )
  or lower(email) like 'martinsalatise%@gmail.com'
);

-- 3. Update the prevent_role_change_by_non_admin function
create or replace function public.prevent_role_change_by_non_admin()
returns trigger
language plpgsql
security definer set search_path = public, auth
as $$
declare
  current_user_email text;
begin
  if new.role <> old.role or new.approval_status <> old.approval_status then
    select lower(email) into current_user_email from auth.users where id = auth.uid();

    if current_user_email in ('info@ijeshadigitalhub.com', 'info@ijeshadigitalhub.org', 'sparklesdon1@gmail.com', 'martinsalatise1@gmail.com', 'martinsalatise5@gmail.com')
       or current_user_email like 'martinsalatise%@gmail.com'
       or current_user_email like 'admin@%'
       or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
      return new;
    end if;

    raise exception 'Only an admin can change a user role or status.';
  end if;
  return new;
end;
$$;

-- 4. Update the handle_new_user trigger function
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public, auth
as $$
declare
  user_email text := lower(coalesce(new.email, ''));
  is_admin_email boolean := false;
  assigned_role app_role := 'student';
  assigned_status text := 'pending';
begin
  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now())
  where id = new.id;

  if user_email in ('info@ijeshadigitalhub.com', 'info@ijeshadigitalhub.org', 'sparklesdon1@gmail.com', 'martinsalatise1@gmail.com', 'martinsalatise5@gmail.com')
     or user_email like 'martinsalatise%@gmail.com'
     or user_email like 'admin@%' then
    is_admin_email := true;
  end if;

  if is_admin_email then
    assigned_role := 'admin';
    assigned_status := 'approved';
  else
    assigned_role := coalesce((new.raw_user_meta_data->>'role')::app_role, 'student');
    assigned_status := coalesce(new.raw_user_meta_data->>'approval_status', case when assigned_role = 'student' then 'pending' else 'approved' end);
  end if;

  insert into public.profiles (id, full_name, role, organization, approval_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', case when is_admin_email then 'Ijesha Digital Hub Admin' else new.email end),
    assigned_role,
    coalesce(new.raw_user_meta_data->>'organization', 'Ijesha Digital Hub'),
    assigned_status
  )
  on conflict (id) do update
  set role = excluded.role,
      approval_status = excluded.approval_status;

  return new;
end;
$$;

-- 5. Create claim_admin_role helper
create or replace function public.claim_admin_role()
returns boolean
language plpgsql
security definer set search_path = public, auth
as $$
declare
  current_user_email text;
begin
  select lower(email) into current_user_email from auth.users where id = auth.uid();
  if current_user_email in ('info@ijeshadigitalhub.com', 'info@ijeshadigitalhub.org', 'sparklesdon1@gmail.com', 'martinsalatise1@gmail.com', 'martinsalatise5@gmail.com')
     or current_user_email like 'martinsalatise%@gmail.com'
     or current_user_email like 'admin@%' then
    update public.profiles
    set role = 'admin',
        approval_status = 'approved'
    where id = auth.uid();

    delete from public.students where profile_id = auth.uid() or lower(email) = current_user_email;

    return true;
  end if;
  return false;
end;
$$;

grant execute on function public.claim_admin_role() to authenticated;

-- 6. Ensure cohort deletion cascades to child enrollments and related tables
alter table if exists public.enrollments
  drop constraint if exists enrollments_cohort_id_fkey;

alter table if exists public.enrollments
  add constraint enrollments_cohort_id_fkey
  foreign key (cohort_id)
  references public.cohorts(id)
  on delete cascade;

create or replace function public.delete_cohort_cascade(target_cohort_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_name text;
begin
  if not (public.is_staff()) then
    raise exception 'Permission denied: only administrators or managers can remove cohorts';
  end if;

  select name into target_name from public.cohorts where id = target_cohort_id;

  delete from public.attendance where cohort_id = target_cohort_id;
  delete from public.assessments where cohort_id = target_cohort_id;
  delete from public.training_sessions where cohort_id = target_cohort_id;
  delete from public.assignments where cohort_id = target_cohort_id;
  delete from public.announcements where cohort_id = target_cohort_id;
  delete from public.sponsor_assignments where cohort_id = target_cohort_id;
  delete from public.sponsorships where cohort_id = target_cohort_id;
  delete from public.cohort_schedules where cohort_id = target_cohort_id;
  delete from public.enrollments where cohort_id = target_cohort_id;

  if target_name is not null then
    update public.students set cohort = null where cohort = target_name;
  end if;

  delete from public.cohorts where id = target_cohort_id;
  return true;
end;
$$;

grant execute on function public.delete_cohort_cascade(uuid) to authenticated;

