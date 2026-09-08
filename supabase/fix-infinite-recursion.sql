-- ============================================================================
-- IJESHA DIGITAL HUB - FIX RLS INFINITE RECURSION (ERROR 42P17)
-- Run this SQL in your Supabase Dashboard -> SQL Editor -> New Query -> Run
-- This completely fixes "infinite recursion detected in policy for relation profiles"
-- ============================================================================

-- 1. Create SECURITY DEFINER functions to query roles without triggering RLS recursively
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

-- 2. Drop the recursive policies on public.profiles and replace with non-recursive ones
drop policy if exists "profiles_select_staff" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own_name" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_select_staff" on public.profiles
  for select using (public.is_staff());

create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin());

create policy "profiles_update_own_name" on public.profiles
  for update using (id = auth.uid());

-- 3. Fix policies on students table
drop policy if exists "students_select_admin_manager" on public.students;
create policy "students_select_admin_manager" on public.students
  for select using (public.is_staff());

drop policy if exists "students_select_trainer" on public.students;
create policy "students_select_trainer" on public.students
  for select using (
    assigned_trainer_id = auth.uid() and public.is_trainer()
  );

drop policy if exists "students_insert_admin_manager" on public.students;
create policy "students_insert_admin_manager" on public.students
  for insert with check (public.is_staff());

drop policy if exists "students_update_admin_manager" on public.students;
create policy "students_update_admin_manager" on public.students
  for update using (public.is_staff());

drop policy if exists "students_delete_admin_manager" on public.students;
create policy "students_delete_admin_manager" on public.students
  for delete using (public.is_staff());

-- 4. Fix policies on teachers table
drop policy if exists "teachers_select_admin_manager" on public.teachers;
create policy "teachers_select_admin_manager" on public.teachers
  for select using (public.is_staff());

drop policy if exists "teachers_insert_admin_manager" on public.teachers;
create policy "teachers_insert_admin_manager" on public.teachers
  for insert with check (public.is_staff());

drop policy if exists "teachers_update_admin_manager" on public.teachers;
create policy "teachers_update_admin_manager" on public.teachers
  for update using (public.is_staff());

drop policy if exists "teachers_delete_admin_manager" on public.teachers;
create policy "teachers_delete_admin_manager" on public.teachers
  for delete using (public.is_staff());

-- 5. Fix policies on parent_links table
drop policy if exists "parent_links_select_admin_manager" on public.parent_links;
create policy "parent_links_select_admin_manager" on public.parent_links
  for select using (public.is_staff());

drop policy if exists "parent_links_write_admin_manager" on public.parent_links;
create policy "parent_links_write_admin_manager" on public.parent_links
  for all using (public.is_staff());

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

