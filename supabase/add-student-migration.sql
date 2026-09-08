-- Run this once before using Add Student. It supports the New Student status.
alter table public.students drop constraint if exists students_status_check;
alter table public.students add constraint students_status_check
  check (status in ('new', 'active', 'paused', 'graduated', 'withdrawn'));
