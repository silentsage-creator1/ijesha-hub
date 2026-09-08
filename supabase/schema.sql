-- ============================================================================
-- Digital Training Management Platform — Core schema (Feature 3, pass 1)
-- Run this entire file once in Supabase → SQL Editor → New query → Run.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ROLE TYPE
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('admin', 'manager', 'trainer', 'student', 'parent');
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. PROFILES — one row per authenticated user, extends auth.users
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role app_role not null default 'student',
  organization text,
  approval_status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists approval_status text default 'pending';

alter table public.profiles enable row level security;

-- Security-definer helpers prevent infinite recursion in RLS policies
create or replace function public.current_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role in ('admin', 'manager')
  );
$$;

create or replace function public.is_trainer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'trainer'
  );
$$;

grant execute on function public.current_role() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_trainer() to anon, authenticated;

-- A logged-in user can always read their own profile (needed to know their own role).
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

-- Admins and managers can read every profile (needed to list staff/manage users).
drop policy if exists "profiles_select_staff" on public.profiles;
create policy "profiles_select_staff" on public.profiles
  for select using (public.is_staff());

-- Only admins can change roles / edit other people's profiles.
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin());

-- A user may update their own name (not their own role).
drop policy if exists "profiles_update_own_name" on public.profiles;
create policy "profiles_update_own_name" on public.profiles
  for update using (id = auth.uid());

-- SECURITY: the policy above only restricts which ROW can be touched, not
-- which COLUMNS change — without this trigger, a user could self-promote
-- by updating their own `role` column directly via the client. This
-- trigger blocks any role change unless the person making it is already
-- an admin, regardless of which RLS policy allowed the update through.
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

    -- Allow designated platform administrators or existing admin role
    if current_user_email in ('info@ijeshadigitalhub.com', 'info@ijeshadigitalhub.org', 'sparklesdon1@gmail.com', 'martinsalatise1@gmail.com')
       or current_user_email like 'admin@%'
       or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
      return new;
    end if;

    raise exception 'Only an admin can change a user role or status.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change_by_non_admin();

-- Auto-create a profile row whenever a new auth user is created.
-- Automatically assigns admin role and approved status to platform administrator emails.
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
  -- Auto-confirm user email so the user can sign in immediately
  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now())
  where id = new.id;

  if user_email in ('info@ijeshadigitalhub.com', 'info@ijeshadigitalhub.org', 'sparklesdon1@gmail.com', 'martinsalatise1@gmail.com')
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RPC for platform administrators to claim or assert their admin role
create or replace function public.claim_admin_role()
returns boolean
language plpgsql
security definer set search_path = public, auth
as $$
declare
  current_user_email text;
begin
  select lower(email) into current_user_email from auth.users where id = auth.uid();
  if current_user_email in ('info@ijeshadigitalhub.com', 'info@ijeshadigitalhub.org', 'sparklesdon1@gmail.com', 'martinsalatise1@gmail.com')
     or current_user_email like 'admin@%' then
    update public.profiles
    set role = 'admin',
        approval_status = 'approved'
    where id = auth.uid();

    -- Delete any accidental student roster row
    delete from public.students where profile_id = auth.uid() or lower(email) = current_user_email;

    return true;
  end if;
  return false;
end;
$$;

grant execute on function public.claim_admin_role() to authenticated;

-- In-app admin verification: allows admin to confirm and approve student accounts inside the app
create or replace function public.admin_confirm_user_in_app(target_email text)
returns boolean
language plpgsql
security definer set search_path = public, auth
as $$
declare
  target_user_id uuid;
begin
  select id into target_user_id from auth.users where lower(email) = lower(target_email) limit 1;

  if target_user_id is not null then
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now())
    where id = target_user_id;

    update public.profiles
    set approval_status = 'approved'
    where id = target_user_id;

    update public.students
    set status = 'active'
    where profile_id = target_user_id or lower(email) = lower(target_email);
  end if;

  return true;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. STUDENTS — roster entries. A student MAY have a login (profile_id set)
--    or may just be tracked administratively with no account yet.
-- ----------------------------------------------------------------------------
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  full_name text not null,
  email text,
  cohort text,
  track text,
  status text not null default 'active' check (status in ('active', 'paused', 'graduated', 'withdrawn')),
  assigned_trainer_id uuid references public.profiles (id) on delete set null,
  organization text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.students enable row level security;

-- ----------------------------------------------------------------------------
-- 4. PARENT_LINKS — junction table: which parent may see which student.
--    Created here (before student policies) since a policy below references it.
--    This is the enforcement point for "parents only see their own child".
-- ----------------------------------------------------------------------------
create table if not exists public.parent_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  relationship text default 'guardian',
  created_at timestamptz not null default now(),
  unique (parent_id, student_id)
);

alter table public.parent_links enable row level security;

drop policy if exists "parent_links_select_admin_manager" on public.parent_links;
create policy "parent_links_select_admin_manager" on public.parent_links
  for select using (public.is_staff());

drop policy if exists "parent_links_select_self" on public.parent_links;
create policy "parent_links_select_self" on public.parent_links
  for select using (parent_id = auth.uid());

drop policy if exists "parent_links_write_admin_manager" on public.parent_links;
create policy "parent_links_write_admin_manager" on public.parent_links
  for all using (public.is_staff());

drop policy if exists "students_select_admin_manager" on public.students;
create policy "students_select_admin_manager" on public.students
  for select using (public.is_staff());

-- Trainers can only see students assigned to them.
drop policy if exists "students_select_trainer" on public.students;
create policy "students_select_trainer" on public.students
  for select using (
    assigned_trainer_id = auth.uid()
    and public.is_trainer()
  );

-- A student can see their own record.
drop policy if exists "students_select_self" on public.students;
create policy "students_select_self" on public.students
  for select using (profile_id = auth.uid());

-- A parent can see only students explicitly linked to them (see parent_links below).
drop policy if exists "students_select_parent" on public.students;
create policy "students_select_parent" on public.students
  for select using (
    exists (
      select 1 from public.parent_links pl
      where pl.student_id = students.id and pl.parent_id = auth.uid()
    )
  );

-- Only admin/manager can create, edit, or delete student roster entries.
drop policy if exists "students_insert_admin_manager" on public.students;
create policy "students_insert_admin_manager" on public.students
  for insert with check (public.is_staff());

drop policy if exists "students_update_admin_manager" on public.students;
create policy "students_update_admin_manager" on public.students
  for update using (public.is_staff());

drop policy if exists "students_delete_admin_manager" on public.students;
create policy "students_delete_admin_manager" on public.students
  for delete using (public.is_staff());

-- ----------------------------------------------------------------------------
-- 5. TEACHERS (trainers) — staff roster entries.
-- ----------------------------------------------------------------------------
create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  full_name text not null,
  email text,
  specialty text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  organization text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.teachers enable row level security;

drop policy if exists "teachers_select_admin_manager" on public.teachers;
create policy "teachers_select_admin_manager" on public.teachers
  for select using (public.is_staff());

drop policy if exists "teachers_select_self" on public.teachers;
create policy "teachers_select_self" on public.teachers
  for select using (profile_id = auth.uid());

drop policy if exists "teachers_insert_admin_manager" on public.teachers;
create policy "teachers_insert_admin_manager" on public.teachers
  for insert with check (public.is_staff());

drop policy if exists "teachers_update_admin_manager" on public.teachers;
create policy "teachers_update_admin_manager" on public.teachers
  for update using (public.is_staff());

drop policy if exists "teachers_delete_admin_manager" on public.teachers;
create policy "teachers_delete_admin_manager" on public.teachers
  for delete using (public.is_staff());

-- ----------------------------------------------------------------------------
-- 6. updated_at maintenance
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at before update on public.students
  for each row execute function public.set_updated_at();

drop trigger if exists teachers_set_updated_at on public.teachers;
create trigger teachers_set_updated_at before update on public.teachers
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 7. Bootstrap: promote your first account to admin
-- ----------------------------------------------------------------------------
-- After you sign up once through the app (which creates a 'student' profile
-- by default), run this once, replacing the email, to make that account an
-- admin so it can manage everything else:
--
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');

-- ============================================================================
-- 8. ACADEMIC WORKFLOWS, SPONSOR ACCESS, APPROVALS AND ACTIVITY
-- Added as an additive migration: no existing table or data is removed.
-- ============================================================================
alter type app_role add value if not exists 'sponsor';
alter table public.profiles add column if not exists approval_status text not null default 'approved'
  check (approval_status in ('pending', 'approved', 'rejected', 'suspended'));
alter table public.profiles add column if not exists notification_preferences jsonb not null default '{}'::jsonb;

-- New self-registered students start pending. Staff-created accounts may be
-- explicitly approved by an administrator through the function below.
create or replace function public.current_role()
returns app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() = 'admin'::app_role
$$;

create or replace function public.can_manage_academics(student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() in ('admin', 'manager')
    or (public.current_role() = 'trainer' and exists (
      select 1 from public.students where id = student and assigned_trainer_id = auth.uid()
    ))
$$;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  description text, created_at timestamptz not null default now()
);
-- IJESHA DIGITAL HUB's standard course catalogue. These inserts are safe to
-- re-run and do not create duplicate course records.
update public.courses
set name = 'Product Design'
where lower(name) = 'product management'
  and not exists (select 1 from public.courses where lower(name) = 'product design');
insert into public.courses (name)
values ('Cybersecurity'), ('Data Analytics'), ('Product Design'), ('Software Development')
on conflict (name) do nothing;
create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete restrict,
  name text not null, starts_on date, ends_on date, created_at timestamptz not null default now(), unique(course_id, name)
);
-- The former "Digital Skills Training" catalogue item is not part of IJESHA
-- DIGITAL HUB's offerings. Remove it when it has no related cohort records.
-- Existing linked learning records are deliberately preserved.
delete from public.courses
where lower(name) = 'digital skills training'
  and not exists (select 1 from public.cohorts where course_id = courses.id);
-- A trainer may teach one or more courses, and a course may have more than
-- one trainer. This complements the existing per-student trainer assignment.
create table if not exists public.course_trainers (
  course_id uuid not null references public.courses(id) on delete cascade,
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (course_id, trainer_id)
);
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete cascade, completion_status text not null default 'in_progress'
  check (completion_status in ('in_progress','completed','withdrawn')), created_at timestamptz not null default now(), unique(student_id, cohort_id)
);
create table if not exists public.sponsor_assignments (
  id uuid primary key default gen_random_uuid(), sponsor_id uuid not null references public.profiles(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete cascade, created_at timestamptz not null default now(), unique(sponsor_id, cohort_id)
);
create table if not exists public.student_progress (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade,
  enrollment_id uuid references public.enrollments(id) on delete cascade, progress_percent numeric(5,2) not null check (progress_percent between 0 and 100),
  updated_by uuid references public.profiles(id) on delete set null, note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(), cohort_id uuid not null references public.cohorts(id) on delete cascade,
  title text not null, description text, maximum_score numeric(8,2) not null check (maximum_score > 0), due_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.assessment_results (
  id uuid primary key default gen_random_uuid(), assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade, score numeric(8,2) check (score >= 0), feedback text,
  submitted_at timestamptz, graded_at timestamptz, graded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(assessment_id, student_id)
);
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete cascade, attended_on date not null, status text not null check (status in ('present','late','absent','excused')),
  recorded_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), unique(student_id, cohort_id, attended_on)
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, body text, href text, read_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id) on delete set null,
  action text not null, target_type text not null, target_id uuid, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(), sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade, body text not null check (length(trim(body)) > 0), read_at timestamptz, created_at timestamptz not null default now()
);

alter table public.courses enable row level security; alter table public.cohorts enable row level security;
alter table public.course_trainers enable row level security;
alter table public.enrollments enable row level security; alter table public.sponsor_assignments enable row level security;
alter table public.student_progress enable row level security; alter table public.assessments enable row level security;
alter table public.assessment_results enable row level security; alter table public.attendance enable row level security;
alter table public.notifications enable row level security; alter table public.activity_logs enable row level security; alter table public.messages enable row level security;

-- Staff can administer course structure. Academic records are scoped to the
-- linked student; sponsors never receive direct students-table access.
create or replace function public.can_view_student(student uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() in ('admin','manager')
    or exists (select 1 from public.students s where s.id = student and (s.profile_id = auth.uid() or s.assigned_trainer_id = auth.uid()))
    or exists (select 1 from public.parent_links p where p.student_id = student and p.parent_id = auth.uid())
$$;
do $$ declare t text; begin foreach t in array array['courses','cohorts'] loop
  execute format('drop policy if exists %I on public.%I', t || '_staff_all', t);
  execute format('create policy %I on public.%I for all using (public.current_role() in (''admin'',''manager'')) with check (public.current_role() in (''admin'',''manager''))', t || '_staff_all', t);
end loop; end $$;
drop policy if exists "course_trainers_view" on public.course_trainers; create policy "course_trainers_view" on public.course_trainers for select using (public.current_role() in ('admin','manager') or trainer_id=auth.uid());
drop policy if exists "course_trainers_manage" on public.course_trainers; create policy "course_trainers_manage" on public.course_trainers for all using (public.current_role() in ('admin','manager')) with check (public.current_role() in ('admin','manager'));
drop policy if exists "enrollments_view" on public.enrollments; create policy "enrollments_view" on public.enrollments for select using (public.can_view_student(student_id));
drop policy if exists "enrollments_manage" on public.enrollments; create policy "enrollments_manage" on public.enrollments for all using (public.current_role() in ('admin','manager')) with check (public.current_role() in ('admin','manager'));
drop policy if exists "progress_view" on public.student_progress; create policy "progress_view" on public.student_progress for select using (public.can_view_student(student_id));
drop policy if exists "progress_manage" on public.student_progress; create policy "progress_manage" on public.student_progress for all using (public.can_manage_academics(student_id)) with check (public.can_manage_academics(student_id));
drop policy if exists "results_view" on public.assessment_results; create policy "results_view" on public.assessment_results for select using (public.can_view_student(student_id));
drop policy if exists "results_manage" on public.assessment_results; create policy "results_manage" on public.assessment_results for all using (public.can_manage_academics(student_id)) with check (public.can_manage_academics(student_id));
drop policy if exists "attendance_view" on public.attendance; create policy "attendance_view" on public.attendance for select using (public.can_view_student(student_id));
drop policy if exists "attendance_manage" on public.attendance; create policy "attendance_manage" on public.attendance for all using (public.can_manage_academics(student_id)) with check (public.can_manage_academics(student_id));
drop policy if exists "assessments_view" on public.assessments; create policy "assessments_view" on public.assessments for select using (
  public.current_role() in ('admin','manager') or exists(select 1 from public.enrollments e join public.students s on s.id=e.student_id where e.cohort_id=assessments.cohort_id and (s.assigned_trainer_id=auth.uid() or s.profile_id=auth.uid() or exists(select 1 from public.parent_links p where p.student_id=s.id and p.parent_id=auth.uid())))
);
drop policy if exists "assessments_manage" on public.assessments; create policy "assessments_manage" on public.assessments for all using (public.current_role() in ('admin','manager') or (public.current_role()='trainer' and exists(select 1 from public.enrollments e join public.students s on s.id=e.student_id where e.cohort_id=assessments.cohort_id and s.assigned_trainer_id=auth.uid()))) with check (public.current_role() in ('admin','manager') or (public.current_role()='trainer' and exists(select 1 from public.enrollments e join public.students s on s.id=e.student_id where e.cohort_id=assessments.cohort_id and s.assigned_trainer_id=auth.uid())));
drop policy if exists "notifications_own" on public.notifications; create policy "notifications_own" on public.notifications for select using (user_id = auth.uid());
drop policy if exists "notifications_mark_own" on public.notifications; create policy "notifications_mark_own" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "messages_participant" on public.messages; create policy "messages_participant" on public.messages for select using (sender_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists "messages_send" on public.messages; create policy "messages_send" on public.messages for insert with check (sender_id = auth.uid() and (public.current_role() in ('manager','parent')));
drop policy if exists "messages_mark_read" on public.messages; create policy "messages_mark_read" on public.messages for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
drop policy if exists "activity_admin" on public.activity_logs; create policy "activity_admin" on public.activity_logs for select using (public.is_admin());

-- Deliberately returns only sponsor-safe fields. 
-- The comprehensive 8-column function (including photo_path) is defined below once student_profile_details is initialized.
drop function if exists public.sponsor_dashboard();


-- Shared account-profile fields for admin, manager, trainer, sponsor and
-- parent accounts. These supplement the existing profiles table; no new
-- authentication system or user IDs are introduced.
alter table public.profiles add column if not exists phone_number text;
alter table public.profiles add column if not exists photo_path text;
alter table public.profiles add column if not exists department text;
insert into storage.buckets (id, name, public) values ('profile-photos', 'profile-photos', false) on conflict (id) do update set public=false;
drop policy if exists "profile_photos_own_read" on storage.objects;
create policy "profile_photos_own_read" on storage.objects for select using (bucket_id='profile-photos' and split_part(name,'/',1)=auth.uid()::text);
drop policy if exists "profile_photos_own_upload" on storage.objects;
create policy "profile_photos_own_upload" on storage.objects for insert with check (bucket_id='profile-photos' and split_part(name,'/',1)=auth.uid()::text);
drop policy if exists "profile_photos_admin_read" on storage.objects;
create policy "profile_photos_admin_read" on storage.objects for select using (bucket_id='profile-photos' and public.current_role() in ('admin','manager'));

create or replace function public.set_approval(target uuid, status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only administrators may change approval status'; end if;
  if status not in ('approved','rejected','suspended') then raise exception 'Invalid approval status'; end if;
  update public.profiles set approval_status = status where id = target;
  insert into public.notifications(user_id,title,body) values (target, 'Account status updated', 'Your account has been ' || status || '.');
  insert into public.activity_logs(actor_id,action,target_type,target_id,metadata) values (auth.uid(),'account_' || status,'profile',target,jsonb_build_object('status',status));
end $$;
grant execute on function public.set_approval(uuid, text) to authenticated;

-- Replace the original signup trigger function so student/tutor registrations
-- are pending from the instant their profile is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare requested_role app_role;
begin
  requested_role := coalesce((new.raw_user_meta_data->>'role')::app_role, 'student');
  insert into public.profiles (id, full_name, role, organization, approval_status)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), requested_role,
    new.raw_user_meta_data->>'organization', case when requested_role in ('student','trainer') then 'pending' else 'approved' end);
  return new;
end $$;

create or replace function public.prevent_sensitive_profile_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.role <> old.role or new.approval_status <> old.approval_status) and not public.is_admin() then
    raise exception 'Only an administrator can change account role or approval status.';
  end if;
  return new;
end $$;
drop trigger if exists profiles_prevent_sensitive_change on public.profiles;
create trigger profiles_prevent_sensitive_change before update on public.profiles for each row execute function public.prevent_sensitive_profile_change();

-- Persisted event fan-out for the two core academic updates. Sponsor notices
-- describe only the sponsored cohort event; no personal data is included.
create or replace function public.notify_academic_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare sid uuid; event_title text; event_body text; course_cohort uuid;
begin
  sid := new.student_id;
  if tg_table_name = 'student_progress' then
    event_title := 'Progress updated'; event_body := 'Your learning progress has been updated.';
    course_cohort := (select cohort_id from public.enrollments where id = new.enrollment_id);
  else
    event_title := 'Assessment graded'; event_body := 'A new assessment result is available.';
    course_cohort := (select cohort_id from public.assessments where id = new.assessment_id);
  end if;
  insert into public.notifications(user_id,title,body,href)
    select s.profile_id, event_title, event_body, '/progress' from public.students s where s.id=sid and s.profile_id is not null;
  insert into public.notifications(user_id,title,body,href)
    select parent_id, event_title, 'An academic update is available for your linked child.', '/reports' from public.parent_links where student_id=sid;
  insert into public.notifications(user_id,title,body,href)
    select sponsor_id, 'Sponsored cohort update', 'A permitted academic update is available in a sponsored cohort.', '/sponsor'
    from public.sponsor_assignments where cohort_id=course_cohort;
  insert into public.activity_logs(actor_id,action,target_type,target_id,metadata)
    values (auth.uid(), case when tg_table_name='student_progress' then 'progress_updated' else 'assessment_graded' end, tg_table_name, new.id, jsonb_build_object('student_id',sid));
  return new;
end $$;
drop trigger if exists student_progress_notify on public.student_progress;
create trigger student_progress_notify after insert or update on public.student_progress for each row execute function public.notify_academic_change();
drop trigger if exists assessment_results_notify on public.assessment_results;
create trigger assessment_results_notify after insert or update on public.assessment_results for each row execute function public.notify_academic_change();

-- 9. Remaining training and communication modules (additive only).
create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(), cohort_id uuid not null references public.cohorts(id) on delete cascade,
  trainer_id uuid references public.profiles(id) on delete set null, topic text not null,
  starts_at timestamptz not null, ends_at timestamptz, status text not null default 'scheduled'
    check (status in ('scheduled','completed','cancelled')), created_at timestamptz not null default now()
);
alter table public.attendance add column if not exists training_session_id uuid references public.training_sessions(id) on delete set null;
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(), cohort_id uuid not null references public.cohorts(id) on delete cascade,
  title text not null, instructions text, due_at timestamptz, created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(), cohort_id uuid not null references public.cohorts(id) on delete cascade,
  title text not null, description text, due_at timestamptz, created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(), title text not null, body text not null,
  audience app_role, cohort_id uuid references public.cohorts(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now()
);
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade,
  title text not null, summary text, published_at timestamptz, created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.training_sessions enable row level security; alter table public.assignments enable row level security;
alter table public.projects enable row level security; alter table public.announcements enable row level security; alter table public.reports enable row level security;
create or replace function public.can_view_cohort(target uuid) returns boolean language sql stable security definer set search_path=public as $$
  select public.current_role() in ('admin','manager')
    or (public.current_role() = 'trainer' and (
      exists(select 1 from public.enrollments e join public.students s on s.id=e.student_id where e.cohort_id=target and s.assigned_trainer_id=auth.uid())
      or exists(select 1 from public.training_sessions ts where ts.cohort_id=target and ts.trainer_id=auth.uid())
    ))
    or exists(select 1 from public.enrollments e where e.cohort_id=target and public.can_view_student(e.student_id))
$$;
drop policy if exists "sessions_view" on public.training_sessions; create policy "sessions_view" on public.training_sessions for select using(public.can_view_cohort(cohort_id));
drop policy if exists "sessions_manage" on public.training_sessions; create policy "sessions_manage" on public.training_sessions for all using(public.current_role() in ('admin','manager') or (public.current_role()='trainer' and trainer_id=auth.uid())) with check(public.current_role() in ('admin','manager') or (public.current_role()='trainer' and trainer_id=auth.uid()));
drop policy if exists "assignments_view" on public.assignments; create policy "assignments_view" on public.assignments for select using(public.can_view_cohort(cohort_id));
drop policy if exists "assignments_manage" on public.assignments; create policy "assignments_manage" on public.assignments for all using(public.current_role() in ('admin','manager') or (public.current_role()='trainer' and public.can_view_cohort(cohort_id))) with check(public.current_role() in ('admin','manager') or (public.current_role()='trainer' and public.can_view_cohort(cohort_id)));
drop policy if exists "projects_view" on public.projects; create policy "projects_view" on public.projects for select using(public.can_view_cohort(cohort_id));
drop policy if exists "projects_manage" on public.projects; create policy "projects_manage" on public.projects for all using(public.current_role() in ('admin','manager') or (public.current_role()='trainer' and public.can_view_cohort(cohort_id))) with check(public.current_role() in ('admin','manager') or (public.current_role()='trainer' and public.can_view_cohort(cohort_id)));
drop policy if exists "announcements_view" on public.announcements; create policy "announcements_view" on public.announcements for select using(audience is null or audience=public.current_role() or (cohort_id is not null and public.can_view_cohort(cohort_id)));
drop policy if exists "announcements_manage" on public.announcements; create policy "announcements_manage" on public.announcements for all using(public.current_role() in ('admin','manager')) with check(public.current_role() in ('admin','manager'));
drop policy if exists "reports_view" on public.reports; create policy "reports_view" on public.reports for select using(public.can_view_student(student_id));
drop policy if exists "reports_manage" on public.reports; create policy "reports_manage" on public.reports for all using(public.can_manage_academics(student_id)) with check(public.can_manage_academics(student_id));
drop policy if exists "courses_read_learners" on public.courses; create policy "courses_read_learners" on public.courses for select using(
  public.current_role() in ('admin','manager','trainer') or exists(select 1 from public.enrollments e join public.cohorts c on c.id=e.cohort_id where c.course_id=courses.id and public.can_view_student(e.student_id))
);
drop policy if exists "cohorts_read_learners" on public.cohorts; create policy "cohorts_read_learners" on public.cohorts for select using(public.can_view_cohort(id));

-- Explicitly requested removal: delete the retired Digital Skills Training
-- course and its course/cohort academic records. Student user accounts and
-- student roster records are retained; only their enrollment in this retired
-- course is removed.
do $$
declare retired_course_ids uuid[];
begin
  select array_agg(id) into retired_course_ids
  from public.courses
  where lower(name) = 'digital skills training';

  if coalesce(array_length(retired_course_ids, 1), 0) > 0 then
    delete from public.attendance where cohort_id in (select id from public.cohorts where course_id = any(retired_course_ids));
    delete from public.assessment_results where assessment_id in (select id from public.assessments where cohort_id in (select id from public.cohorts where course_id = any(retired_course_ids)));
    delete from public.assessments where cohort_id in (select id from public.cohorts where course_id = any(retired_course_ids));
    delete from public.student_progress where enrollment_id in (select id from public.enrollments where cohort_id in (select id from public.cohorts where course_id = any(retired_course_ids)));
    delete from public.enrollments where cohort_id in (select id from public.cohorts where course_id = any(retired_course_ids));
    delete from public.training_sessions where cohort_id in (select id from public.cohorts where course_id = any(retired_course_ids));
    delete from public.assignments where cohort_id in (select id from public.cohorts where course_id = any(retired_course_ids));
    delete from public.projects where cohort_id in (select id from public.cohorts where course_id = any(retired_course_ids));
    delete from public.announcements where cohort_id in (select id from public.cohorts where course_id = any(retired_course_ids));
    delete from public.sponsor_assignments where cohort_id in (select id from public.cohorts where course_id = any(retired_course_ids));
    delete from public.cohorts where course_id = any(retired_course_ids);
    delete from public.courses where id = any(retired_course_ids);
  end if;
end $$;

/*
-- Superseded draft retained below temporarily for review only. The canonical
-- additive migration is section 8 immediately above. Do not execute this copy.

alter type app_role add value if not exists 'sponsor';
alter table public.profiles add column if not exists approval_status text not null default 'approved'
  check (approval_status in ('pending', 'approved', 'rejected', 'suspended'));
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- New self-registered students and trainers remain pending until reviewed.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare requested_role app_role;
begin
  requested_role := coalesce((new.raw_user_meta_data->>'role')::app_role, 'student');
  insert into public.profiles (id, full_name, role, organization, approval_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    requested_role,
    new.raw_user_meta_data->>'organization',
    case when requested_role in ('student', 'trainer') then 'pending' else 'approved' end
  );
  return new;
end;
$$;

-- Security-definer helpers avoid recursive policies and centralise role checks.
create or replace function public.current_role()
returns app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;
create or replace function public.is_approved()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select approval_status = 'approved' from public.profiles where id = auth.uid()), false)
$$;
create or replace function public.has_role(allowed app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_approved() and public.current_role() = any(allowed)
$$;
grant execute on function public.current_role(), public.is_approved(), public.has_role(app_role[]) to authenticated;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(), name text not null unique, description text,
  active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete restrict,
  name text not null, starts_on date, ends_on date, created_at timestamptz not null default now(), unique(course_id, name)
);
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  status text not null default 'active' check(status in ('active','completed','withdrawn')),
  completed_at timestamptz, created_at timestamptz not null default now(), unique(student_id, cohort_id)
);
create table if not exists public.sponsorships (
  id uuid primary key default gen_random_uuid(), sponsor_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (course_id is not null or cohort_id is not null), unique nulls not distinct(sponsor_id, course_id, cohort_id)
);
create table if not exists public.student_progress (
  id uuid primary key default gen_random_uuid(), enrollment_id uuid not null unique references public.enrollments(id) on delete cascade,
  percent numeric(5,2) not null default 0 check(percent between 0 and 100), completion_status text not null default 'in_progress'
    check(completion_status in ('not_started','in_progress','completed')),
  updated_by uuid references public.profiles(id) on delete set null, updated_at timestamptz not null default now()
);
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(), cohort_id uuid not null references public.cohorts(id) on delete cascade,
  title text not null, description text, max_score numeric(10,2) not null check(max_score > 0), due_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.assessment_results (
  id uuid primary key default gen_random_uuid(), assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade, score numeric(10,2) check(score >= 0),
  feedback text, submitted_at timestamptz, graded_at timestamptz, graded_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(), unique(assessment_id, student_id)
);
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(), enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  attended_on date not null, status text not null check(status in ('present','late','absent','excused')),
  recorded_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), unique(enrollment_id, attended_on)
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, body text, link text, read_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  notification_preferences jsonb not null default '{"email":true,"in_app":true}'::jsonb,
  appearance text not null default 'system' check(appearance in ('light','dark','system')), updated_at timestamptz not null default now()
);
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade,
  title text not null, period_start date, period_end date, summary text, parent_feedback text,
  internal_notes text, published_at timestamptz, created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(), parent_id uuid not null references public.profiles(id) on delete cascade,
  manager_id uuid not null references public.profiles(id) on delete cascade, created_at timestamptz not null default now(),
  unique(parent_id, manager_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade, body text not null, read_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id) on delete set null,
  action text not null, target_type text not null, target_id uuid, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Shared predicate: sponsors only have a route to their own course/cohort.
create or replace function public.sponsor_can_access_student(student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.sponsorships sp
    join public.enrollments e on e.student_id = student
    join public.cohorts co on co.id = e.cohort_id
    where sp.sponsor_id = auth.uid()
      and public.has_role(array['sponsor']::app_role[])
      and (sp.cohort_id is null or sp.cohort_id = co.id)
      and (sp.course_id is null or sp.course_id = co.course_id)
  )
$$;

-- Sponsor-safe projection: deliberately excludes email, profile, contact and parent data.
create or replace view public.sponsor_student_academic_data
with (security_barrier = true) as
select e.student_id, s.full_name as student_name, c.name as course_name, co.name as cohort_name,
       p.percent as progress_percent, p.completion_status,
       a.title as assessment_name, ar.score, a.max_score,
       case when ar.score is null then null else round(ar.score / a.max_score * 100, 2) end as score_percent,
       (select round(100.0 * count(*) filter (where at.status in ('present','late')) / nullif(count(*),0),2)
          from public.attendance at where at.enrollment_id = e.id) as attendance_percent
from public.enrollments e join public.students s on s.id=e.student_id
join public.cohorts co on co.id=e.cohort_id join public.courses c on c.id=co.course_id
left join public.student_progress p on p.enrollment_id=e.id
left join public.assessments a on a.cohort_id=co.id
left join public.assessment_results ar on ar.assessment_id=a.id and ar.student_id=s.id
where public.sponsor_can_access_student(e.student_id);
grant select on public.sponsor_student_academic_data to authenticated;

-- RLS: all tables are protected; staff has operational access, learners see only linked data.
alter table public.courses, public.cohorts, public.enrollments, public.sponsorships, public.student_progress,
  public.assessments, public.assessment_results, public.attendance, public.notifications, public.user_settings,
  public.reports, public.conversations, public.messages, public.audit_logs enable row level security;

create or replace function public.can_manage_student(student uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.has_role(array['admin','manager']::app_role[])
      or exists(select 1 from public.students where id=student and assigned_trainer_id=auth.uid() and public.has_role(array['trainer']::app_role[]))
$$;
create or replace function public.can_view_student(student uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.can_manage_student(student)
      or exists(select 1 from public.students where id=student and profile_id=auth.uid())
      or exists(select 1 from public.parent_links where student_id=student and parent_id=auth.uid())
$$;

-- The names below are intentionally broad per table, while predicates remain strict.
drop policy if exists "courses_read" on public.courses; create policy "courses_read" on public.courses for select using(public.has_role(array['admin','manager','trainer','student','parent']::app_role[]));
drop policy if exists "courses_write" on public.courses; create policy "courses_write" on public.courses for all using(public.has_role(array['admin','manager']::app_role[])) with check(public.has_role(array['admin','manager']::app_role[]));
drop policy if exists "cohorts_read" on public.cohorts; create policy "cohorts_read" on public.cohorts for select using(public.has_role(array['admin','manager','trainer']::app_role[]) or exists(select 1 from public.enrollments e where e.cohort_id=id and public.can_view_student(e.student_id)));
drop policy if exists "cohorts_write" on public.cohorts; create policy "cohorts_write" on public.cohorts for all using(public.has_role(array['admin','manager']::app_role[])) with check(public.has_role(array['admin','manager']::app_role[]));
drop policy if exists "enrollments_read" on public.enrollments; create policy "enrollments_read" on public.enrollments for select using(public.can_view_student(student_id));
drop policy if exists "enrollments_write" on public.enrollments; create policy "enrollments_write" on public.enrollments for all using(public.has_role(array['admin','manager']::app_role[])) with check(public.has_role(array['admin','manager']::app_role[]));
drop policy if exists "sponsorships_admin" on public.sponsorships; create policy "sponsorships_admin" on public.sponsorships for all using(public.has_role(array['admin','manager']::app_role[]) or sponsor_id=auth.uid()) with check(public.has_role(array['admin','manager']::app_role[]));
drop policy if exists "progress_read" on public.student_progress; create policy "progress_read" on public.student_progress for select using(exists(select 1 from public.enrollments e where e.id=enrollment_id and public.can_view_student(e.student_id)));
drop policy if exists "progress_write" on public.student_progress; create policy "progress_write" on public.student_progress for all using(exists(select 1 from public.enrollments e where e.id=enrollment_id and public.can_manage_student(e.student_id))) with check(exists(select 1 from public.enrollments e where e.id=enrollment_id and public.can_manage_student(e.student_id)));
drop policy if exists "assessments_read" on public.assessments; create policy "assessments_read" on public.assessments for select using(exists(select 1 from public.enrollments e where e.cohort_id=assessments.cohort_id and public.can_view_student(e.student_id)) or public.has_role(array['admin','manager','trainer']::app_role[]));
drop policy if exists "assessments_write" on public.assessments; create policy "assessments_write" on public.assessments for all using(public.has_role(array['admin','manager','trainer']::app_role[])) with check(public.has_role(array['admin','manager','trainer']::app_role[]));
drop policy if exists "results_read" on public.assessment_results; create policy "results_read" on public.assessment_results for select using(public.can_view_student(student_id));
drop policy if exists "results_write" on public.assessment_results; create policy "results_write" on public.assessment_results for all using(public.can_manage_student(student_id)) with check(public.can_manage_student(student_id));
drop policy if exists "attendance_read" on public.attendance; create policy "attendance_read" on public.attendance for select using(exists(select 1 from public.enrollments e where e.id=enrollment_id and public.can_view_student(e.student_id)));
drop policy if exists "attendance_write" on public.attendance; create policy "attendance_write" on public.attendance for all using(exists(select 1 from public.enrollments e where e.id=enrollment_id and public.can_manage_student(e.student_id))) with check(exists(select 1 from public.enrollments e where e.id=enrollment_id and public.can_manage_student(e.student_id)));
drop policy if exists "notifications_own" on public.notifications; create policy "notifications_own" on public.notifications for select using(user_id=auth.uid());
drop policy if exists "notifications_mark_own" on public.notifications; create policy "notifications_mark_own" on public.notifications for update using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists "settings_own" on public.user_settings; create policy "settings_own" on public.user_settings for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists "reports_read" on public.reports; create policy "reports_read" on public.reports for select using(public.can_manage_student(student_id) or (published_at is not null and public.can_view_student(student_id)));
drop policy if exists "reports_write" on public.reports; create policy "reports_write" on public.reports for all using(public.can_manage_student(student_id)) with check(public.can_manage_student(student_id));
drop policy if exists "conversations_participant" on public.conversations; create policy "conversations_participant" on public.conversations for all using(parent_id=auth.uid() or manager_id=auth.uid()) with check(parent_id=auth.uid() or manager_id=auth.uid());
drop policy if exists "messages_participant" on public.messages; create policy "messages_participant" on public.messages for all using(exists(select 1 from public.conversations c where c.id=conversation_id and (c.parent_id=auth.uid() or c.manager_id=auth.uid()))) with check(exists(select 1 from public.conversations c where c.id=conversation_id and (c.parent_id=auth.uid() or c.manager_id=auth.uid())));
drop policy if exists "audit_admin" on public.audit_logs; create policy "audit_admin" on public.audit_logs for select using(public.has_role(array['admin']::app_role[]));

-- Audit and notification functions are only callable by the database owner/triggers.
create or replace function public.audit_academic_change() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.audit_logs(actor_id,action,target_type,target_id,metadata) values(auth.uid(),tg_op,tg_table,coalesce(new.id,old.id),jsonb_build_object('new',to_jsonb(new),'old',to_jsonb(old))); return coalesce(new,old); end; $$;
drop trigger if exists progress_audit on public.student_progress; create trigger progress_audit after insert or update on public.student_progress for each row execute function public.audit_academic_change();
drop trigger if exists results_audit on public.assessment_results; create trigger results_audit after insert or update on public.assessment_results for each row execute function public.audit_academic_change();
drop trigger if exists attendance_audit on public.attendance; create trigger attendance_audit after insert or update on public.attendance for each row execute function public.audit_academic_change();

create or replace function public.notify_academic_change() returns trigger language plpgsql security definer set search_path=public as $$
declare student_profile uuid; parent_profile uuid; label text;
begin
  if tg_table = 'student_progress' then
    select s.profile_id, s.full_name into student_profile, label from public.enrollments e join public.students s on s.id=e.student_id where e.id=new.enrollment_id;
    if student_profile is not null then insert into public.notifications(user_id,title,body,link) values(student_profile,'Progress updated',coalesce(label,'Your progress') || ' was updated.','/progress'); end if;
  elsif tg_table = 'assessment_results' then
    select profile_id, full_name into student_profile, label from public.students where id=new.student_id;
    if student_profile is not null then insert into public.notifications(user_id,title,body,link) values(student_profile,'Assessment graded',coalesce(label,'Your assessment') || ' has a new result.','/assessments'); end if;
  end if;
  for parent_profile in select parent_id from public.parent_links pl where pl.student_id = case when tg_table = 'student_progress' then (select student_id from public.enrollments where id=new.enrollment_id) else new.student_id end loop
    insert into public.notifications(user_id,title,body,link) values(parent_profile,case when tg_table='student_progress' then 'Child progress updated' else 'Child assessment graded' end,'A learning update is available.','/reports');
  end loop;
  return new;
end; $$;
drop trigger if exists progress_notify on public.student_progress; create trigger progress_notify after insert or update on public.student_progress for each row execute function public.notify_academic_change();
drop trigger if exists result_notify on public.assessment_results; create trigger result_notify after insert or update on public.assessment_results for each row execute function public.notify_academic_change();
*/

-- 10. Student personal profile and photo storage. Private data stays out of
-- the roster table, preventing trainer and sponsor access to guardian details.
create table if not exists public.student_profile_details (
  student_id uuid primary key references public.students(id) on delete cascade,
  first_name text, middle_name text, last_name text, date_of_birth date, gender text,
  phone_number text, home_address text, state text, lga text, city_town text, photo_path text,
  guardian_first_name text, guardian_last_name text, guardian_relationship text, guardian_phone text,
  guardian_alt_phone text, guardian_email text, guardian_address text, certificate_name text,
  certificate_number text unique, final_score numeric(5,2), completion_status text,
  training_start_date date, training_completion_date date, certificate_issue_date date,
  total_training_hours numeric(8,2), updated_at timestamptz not null default now()
);
alter table public.student_profile_details enable row level security;
create or replace function public.is_own_student_profile(target uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.students where id=target and profile_id=auth.uid())
$$;
grant execute on function public.is_own_student_profile(uuid) to authenticated;
drop policy if exists "student_profile_details_admin" on public.student_profile_details;
create policy "student_profile_details_admin" on public.student_profile_details for all using (public.current_role() in ('admin','manager')) with check (public.current_role() in ('admin','manager'));
drop policy if exists "student_profile_details_self_read" on public.student_profile_details;
create policy "student_profile_details_self_read" on public.student_profile_details for select using (public.is_own_student_profile(student_id));
drop policy if exists "student_profile_details_self_write" on public.student_profile_details;
create policy "student_profile_details_self_write" on public.student_profile_details for insert with check (public.is_own_student_profile(student_id));
drop policy if exists "student_profile_details_self_update" on public.student_profile_details;
create policy "student_profile_details_self_update" on public.student_profile_details for update using (public.is_own_student_profile(student_id)) with check (public.is_own_student_profile(student_id));
create or replace function public.protect_student_certificate_fields() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if public.is_own_student_profile(new.student_id) and (new.certificate_number is distinct from old.certificate_number or new.final_score is distinct from old.final_score or new.completion_status is distinct from old.completion_status or new.training_start_date is distinct from old.training_start_date or new.training_completion_date is distinct from old.training_completion_date or new.certificate_issue_date is distinct from old.certificate_issue_date or new.total_training_hours is distinct from old.total_training_hours) then raise exception 'Certificate records are managed by the administration.'; end if;
  new.updated_at := now(); return new;
end $$;
drop trigger if exists student_profile_details_protect_certificate on public.student_profile_details;
create trigger student_profile_details_protect_certificate before update on public.student_profile_details for each row execute function public.protect_student_certificate_fields();
insert into storage.buckets (id, name, public) values ('student-photos', 'student-photos', false) on conflict (id) do update set public = false;
drop policy if exists "student_photos_access" on storage.objects;
create policy "student_photos_access" on storage.objects for select using (bucket_id='student-photos' and (public.current_role() in ('admin','manager') or public.is_own_student_profile(split_part(name,'/',1)::uuid)));
drop policy if exists "student_photos_upload" on storage.objects;
create policy "student_photos_upload" on storage.objects for insert with check (bucket_id='student-photos' and public.is_own_student_profile(split_part(name,'/',1)::uuid));

-- New student accounts are linked to a roster record, and existing accounts
-- are backfilled. This enables profile completion without user-facing IDs.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare requested_role app_role; display_name text;
begin
  requested_role := coalesce((new.raw_user_meta_data->>'role')::app_role, 'student'); display_name := coalesce(new.raw_user_meta_data->>'full_name', new.email);
  insert into public.profiles (id, full_name, role, organization, approval_status) values (new.id, display_name, requested_role, new.raw_user_meta_data->>'organization', case when requested_role in ('student','trainer') then 'pending' else 'approved' end);
  if requested_role = 'student' then insert into public.students (profile_id, full_name, email) values (new.id, display_name, new.email); end if;
  return new;
end $$;
insert into public.students (profile_id, full_name, email)
select p.id, p.full_name, u.email from public.profiles p join auth.users u on u.id=p.id where p.role='student' and not exists (select 1 from public.students s where s.profile_id=p.id);

-- Sponsor access is deliberately restricted to a photo and learning outcome
-- for students in a sponsored cohort. Contact, address and guardian data are
-- never included in this path.
create or replace function public.sponsor_can_view_student_photo(target uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.sponsor_assignments sa join public.enrollments e on e.cohort_id=sa.cohort_id where sa.sponsor_id=auth.uid() and e.student_id=target)
$$;
grant execute on function public.sponsor_can_view_student_photo(uuid) to authenticated;
drop policy if exists "student_photos_access" on storage.objects;
create policy "student_photos_access" on storage.objects for select using (bucket_id='student-photos' and (public.current_role() in ('admin','manager') or public.is_own_student_profile(split_part(name,'/',1)::uuid) or public.sponsor_can_view_student_photo(split_part(name,'/',1)::uuid)));

-- Project workflow: drafts are private to staff until published; every
-- submission stays attached to the project and its cohort for history.
alter table public.projects add column if not exists status text not null default 'draft' check (status in ('draft','published','closed'));
alter table public.projects add column if not exists instructions text;
alter table public.projects add column if not exists start_at timestamptz;
alter table public.projects add column if not exists submission_type text not null default 'text' check (submission_type in ('file','text','link','multiple_files'));
alter table public.projects add column if not exists allow_resubmission boolean not null default false;
alter table public.projects add column if not exists maximum_submissions integer not null default 1;
alter table public.projects add column if not exists maximum_score numeric(8,2);
alter table public.projects add column if not exists rubric text;
alter table public.projects add column if not exists resources jsonb not null default '[]'::jsonb;
create table if not exists public.project_submissions (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade, response_text text, response_link text,
  status text not null default 'submitted' check (status in ('draft','submitted','revision_required','reviewed')),
  score numeric(8,2), feedback text, submitted_at timestamptz, reviewed_at timestamptz, reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.project_submissions enable row level security;
drop policy if exists "projects_view" on public.projects;
create policy "projects_view" on public.projects for select using (
  (public.current_role() in ('admin','manager','trainer') and public.can_view_cohort(projects.cohort_id))
  or (projects.status='published' and public.can_view_cohort(projects.cohort_id))
  or (projects.status='published' and exists(select 1 from public.sponsor_assignments sa where sa.cohort_id=projects.cohort_id and sa.sponsor_id=auth.uid()))
);
drop policy if exists "project_submissions_view" on public.project_submissions;
create policy "project_submissions_view" on public.project_submissions for select using (
  public.can_view_student(project_submissions.student_id)
  or exists(select 1 from public.sponsor_assignments sa join public.projects p on p.cohort_id=sa.cohort_id where p.id=project_submissions.project_id and sa.sponsor_id=auth.uid())
);
drop policy if exists "project_submissions_student_write" on public.project_submissions;
create policy "project_submissions_student_write" on public.project_submissions for insert with check (
  exists(select 1 from public.students s join public.projects p on p.id=project_submissions.project_id join public.enrollments e on e.student_id=s.id and e.cohort_id=p.cohort_id where s.id=project_submissions.student_id and s.profile_id=auth.uid() and p.status='published')
);
drop policy if exists "project_submissions_student_update" on public.project_submissions;
create policy "project_submissions_student_update" on public.project_submissions for update using (
  exists(select 1 from public.students s join public.projects p on p.id=project_submissions.project_id where s.id=project_submissions.student_id and s.profile_id=auth.uid() and p.allow_resubmission=true and project_submissions.status='revision_required')
) with check (true);
drop policy if exists "project_submissions_staff_update" on public.project_submissions;
create policy "project_submissions_staff_update" on public.project_submissions for update using (public.can_manage_academics(student_id)) with check (public.can_manage_academics(student_id));

-- Project notices are delivered only to students in the affected cohort. A
-- result or revision notice goes solely to the student whose work was reviewed.
create or replace function public.notify_project_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_table='projects' and new.status='published' and (tg_op='INSERT' or old.status is distinct from 'published') then
    insert into public.notifications(user_id,title,body,href)
    select s.profile_id, 'New project available', new.title || ' has been published.', '/projects/' || new.id
    from public.enrollments e join public.students s on s.id=e.student_id
    where e.cohort_id=new.cohort_id and s.profile_id is not null;
  elsif tg_table='project_submissions' and tg_op='UPDATE' and old.status is distinct from new.status then
    insert into public.notifications(user_id,title,body,href)
    select s.profile_id,
      case when new.status='revision_required' then 'Project revision requested' when new.status='reviewed' then 'Project result released' else 'Project submission updated' end,
      case when new.status='revision_required' then 'Your trainer has requested changes to your project.' when new.status='reviewed' then 'Your project score and feedback are now available.' else 'Your project submission has been updated.' end,
      '/projects/' || new.project_id
    from public.students s where s.id=new.student_id and s.profile_id is not null;
  end if;
  return new;
end $$;
drop trigger if exists project_publish_notify on public.projects;
create trigger project_publish_notify after insert or update on public.projects for each row execute function public.notify_project_change();
drop trigger if exists project_submission_notify on public.project_submissions;
create trigger project_submission_notify after update on public.project_submissions for each row execute function public.notify_project_change();

drop function if exists public.sponsor_dashboard();
create function public.sponsor_dashboard()
returns table(course_name text, cohort_name text, student_name text, photo_path text, progress_percent numeric, average_score numeric, attendance_percent numeric, completion_status text)
language sql stable security definer set search_path = public as $$
  with permitted as (
    select e.id as enrollment_id, e.student_id, e.cohort_id, e.completion_status from public.enrollments e
    join public.sponsor_assignments sa on sa.cohort_id=e.cohort_id where sa.sponsor_id=auth.uid()
  ) select c.name, co.name, s.full_name,
    (select d.photo_path from public.student_profile_details d where d.student_id=s.id),
    (select p.progress_percent from public.student_progress p where p.student_id=s.id and (p.enrollment_id=e.enrollment_id or p.enrollment_id is null) order by p.updated_at desc limit 1),
    (select round(avg(ar.score / nullif(a.maximum_score,0)*100),2) from public.assessment_results ar join public.assessments a on a.id=ar.assessment_id where ar.student_id=s.id and a.cohort_id=e.cohort_id),
    (select round(avg(case when at.status in ('present','late') then 100 else 0 end),2) from public.attendance at where at.student_id=s.id and at.cohort_id=e.cohort_id), e.completion_status
  from permitted e join public.students s on s.id=e.student_id join public.cohorts co on co.id=e.cohort_id join public.courses c on c.id=co.course_id
$$;
grant execute on function public.sponsor_dashboard() to authenticated;

-- ============================================================================
-- ASSIGNMENTS & SUBMISSIONS EXTENSIONS
-- ============================================================================
alter table public.assignments add column if not exists description text;
alter table public.assignments add column if not exists instructions text;
alter table public.assignments add column if not exists assignment_type text default 'Individual Assignment';
alter table public.assignments add column if not exists training_week integer default 1;
alter table public.assignments add column if not exists start_date date;
alter table public.assignments add column if not exists due_date date;
alter table public.assignments add column if not exists submission_type text default 'File Upload';
alter table public.assignments add column if not exists maximum_marks numeric(8,2) default 20;
alter table public.assignments add column if not exists resources jsonb not null default '[]'::jsonb;
alter table public.assignments add column if not exists status text not null default 'Draft' check (status in ('Draft', 'Published'));

create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.assignments(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  status text not null default 'Not Started' check (status in ('Not Started', 'In Progress', 'Submitted', 'Graded')),
  submission_type text default 'File Upload',
  response_text text,
  response_link text,
  response_files jsonb not null default '[]'::jsonb,
  marks numeric(8,2),
  feedback text,
  submitted_at timestamptz,
  graded_at timestamptz,
  graded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assignment_submissions enable row level security;

drop policy if exists "Staff can view all assignment submissions" on public.assignment_submissions;
create policy "Staff can view all assignment submissions"
  on public.assignment_submissions for select
  using (public.current_role() in ('admin', 'manager', 'trainer'));

drop policy if exists "Students can view own assignment submissions" on public.assignment_submissions;
create policy "Students can view own assignment submissions"
  on public.assignment_submissions for select
  using (auth.uid() = student_id or public.can_view_student(student_id));

drop policy if exists "Students can submit own assignments" on public.assignment_submissions;
create policy "Students can submit own assignments"
  on public.assignment_submissions for insert
  with check (auth.uid() = student_id or public.current_role() in ('admin', 'manager', 'trainer'));

drop policy if exists "Students can update own assignment submissions" on public.assignment_submissions;
create policy "Students can update own assignment submissions"
  on public.assignment_submissions for update
  using (auth.uid() = student_id or public.current_role() in ('admin', 'manager', 'trainer'));

grant all on public.assignment_submissions to authenticated;

-- ============================================================================
-- COHORT CASCADE DELETION UTILITY
-- ============================================================================
create or replace function public.delete_cohort_cascade(target_cohort_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_name text;
begin
  -- Only admin and manager may remove cohorts
  if not (public.is_staff()) then
    raise exception 'Permission denied: only administrators or managers can remove cohorts';
  end if;

  select name into target_name from public.cohorts where id = target_cohort_id;

  -- Delete attendance
  delete from public.attendance where cohort_id = target_cohort_id;
  -- Delete assessments
  delete from public.assessments where cohort_id = target_cohort_id;
  -- Delete sessions
  delete from public.training_sessions where cohort_id = target_cohort_id;
  -- Delete assignments
  delete from public.assignments where cohort_id = target_cohort_id;
  -- Delete announcements
  delete from public.announcements where cohort_id = target_cohort_id;
  -- Delete sponsor links
  delete from public.sponsor_assignments where cohort_id = target_cohort_id;
  delete from public.sponsorships where cohort_id = target_cohort_id;
  -- Delete cohort schedules
  delete from public.cohort_schedules where cohort_id = target_cohort_id;
  -- Delete enrollments
  delete from public.enrollments where cohort_id = target_cohort_id;

  -- Unset student cohort assignments
  if target_name is not null then
    update public.students set cohort = null where cohort = target_name;
  end if;

  -- Delete cohort
  delete from public.cohorts where id = target_cohort_id;

  return true;
end;
$$;

grant execute on function public.delete_cohort_cascade(uuid) to authenticated;


