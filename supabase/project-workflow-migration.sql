-- Run this once in Supabase SQL Editor to update the existing projects table.
alter table public.projects add column if not exists status text not null default 'draft'
  check (status in ('draft', 'published', 'closed'));
alter table public.projects add column if not exists instructions text;
alter table public.projects add column if not exists start_at timestamptz;
alter table public.projects add column if not exists submission_type text not null default 'text'
  check (submission_type in ('file', 'text', 'link', 'multiple_files'));
alter table public.projects add column if not exists allow_resubmission boolean not null default false;
alter table public.projects add column if not exists maximum_submissions integer not null default 1;
alter table public.projects add column if not exists maximum_score numeric(8,2);
alter table public.projects add column if not exists rubric text;
alter table public.projects add column if not exists resources jsonb not null default '[]'::jsonb;

create table if not exists public.project_submissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  response_text text,
  response_link text,
  status text not null default 'submitted'
    check (status in ('draft', 'submitted', 'revision_required', 'reviewed')),
  score numeric(8,2),
  feedback text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_submissions enable row level security;

-- Existing project permissions continue to govern who may see projects.
drop policy if exists "project_submissions_view" on public.project_submissions;
create policy "project_submissions_view" on public.project_submissions for select
  using (public.can_view_student(project_submissions.student_id));
drop policy if exists "project_submissions_student_write" on public.project_submissions;
create policy "project_submissions_student_write" on public.project_submissions for insert with check (
  exists (
    select 1 from public.students s
    join public.projects p on p.id = project_submissions.project_id
    join public.enrollments e on e.student_id = s.id and e.cohort_id = p.cohort_id
    where s.id = project_submissions.student_id and s.profile_id = auth.uid() and p.status = 'published'
  )
);
drop policy if exists "project_submissions_student_update" on public.project_submissions;
create policy "project_submissions_student_update" on public.project_submissions for update using (
  exists (
    select 1 from public.students s
    join public.projects p on p.id = project_submissions.project_id
    where s.id = project_submissions.student_id and s.profile_id = auth.uid()
      and p.allow_resubmission = true and project_submissions.status = 'revision_required'
  )
) with check (true);
drop policy if exists "project_submissions_staff_update" on public.project_submissions;
create policy "project_submissions_staff_update" on public.project_submissions for update
  using (public.can_manage_academics(student_id))
  with check (public.can_manage_academics(student_id));
