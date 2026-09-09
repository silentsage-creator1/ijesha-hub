begin;
alter table public.attendance
  add column if not exists enrollment_id uuid references public.enrollments(id) on delete cascade,
  add column if not exists student_id uuid references public.students(id) on delete cascade,
  add column if not exists cohort_id uuid references public.cohorts(id) on delete cascade,
  add column if not exists training_session_id uuid references public.training_sessions(id) on delete set null,
  add column if not exists app_recorded_by uuid references public.app_auth_users(id) on delete set null;
-- Allow separate attendance for two sessions on the same day.
alter table public.attendance drop constraint if exists attendance_student_id_cohort_id_attended_on_key;
alter table public.attendance drop constraint if exists attendance_enrollment_id_attended_on_key;
create unique index if not exists attendance_student_session_key on public.attendance(student_id,training_session_id);
commit;
