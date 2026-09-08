-- ============================================================================
-- Attendance & Training Session Migration
-- Run this once in Supabase SQL Editor. Safe to re-run.
-- ============================================================================

-- Ensure week_number exists on training_sessions
alter table public.training_sessions add column if not exists week_number integer default 1;

-- Ensure training_session_id exists on attendance
alter table public.attendance add column if not exists training_session_id uuid references public.training_sessions(id) on delete cascade;

-- Create index for fast lookups by session
create index if not exists idx_attendance_session on public.attendance (training_session_id);
create index if not exists idx_attendance_student on public.attendance (student_id);
create index if not exists idx_training_sessions_cohort on public.training_sessions (cohort_id);

-- Ensure RLS allows managing attendance by session
drop policy if exists "attendance_session_manage" on public.attendance;
create policy "attendance_session_manage" on public.attendance
  for all using (
    public.current_role() in ('admin', 'manager') or (
      public.current_role() = 'trainer' and exists (
        select 1 from public.training_sessions ts where ts.id = attendance.training_session_id and ts.trainer_id = auth.uid()
      )
    ) or public.can_manage_academics(student_id)
  )
  with check (
    public.current_role() in ('admin', 'manager') or (
      public.current_role() = 'trainer' and exists (
        select 1 from public.training_sessions ts where ts.id = attendance.training_session_id and ts.trainer_id = auth.uid()
      )
    ) or public.can_manage_academics(student_id)
  );
