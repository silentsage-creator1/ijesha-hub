-- Application-owned authentication. Run once in Supabase SQL Editor.
-- These tables are accessed only by the application backend using the service-role key.
create table if not exists public.app_auth_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  password_hash text not null,
  role public.app_role not null default 'student',
  track text,
  organization text not null default 'Ijesha Digital Hub',
  student_id uuid references public.students(id) on delete set null,
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.app_auth_users
  add column if not exists student_id uuid references public.students(id) on delete set null;

create table if not exists public.app_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_auth_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_auth_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Courses authored and assigned through the application backend. Content is
-- deliberately stored as structured JSON so modules, lessons, quizzes and
-- assignments travel together as one course draft.
create table if not exists public.app_courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  thumbnail text,
  level text,
  status text not null default 'Draft' check (status in ('Draft', 'Published')),
  content jsonb not null default '[]'::jsonb,
  cohort_id uuid references public.cohorts(id) on delete set null,
  trainer_id uuid references public.app_auth_users(id) on delete set null,
  start_date date,
  end_date date,
  created_by uuid not null references public.app_auth_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One shared learning workflow for classwork, assessments and projects.
create table if not exists public.app_learning_items (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('classwork', 'assessment', 'project')),
  title text not null,
  instructions text not null default '',
  cohort_id uuid references public.cohorts(id) on delete cascade,
  due_at timestamptz,
  maximum_score numeric not null default 100 check (maximum_score > 0),
  status text not null default 'published' check (status in ('draft', 'published', 'closed')),
  created_by uuid not null references public.app_auth_users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.app_learning_submissions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.app_learning_items(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  response text not null default '',
  submitted_at timestamptz,
  score numeric,
  feedback text,
  graded_by uuid references public.app_auth_users(id) on delete set null,
  graded_at timestamptz,
  unique(item_id, student_id)
);

alter table public.app_auth_users enable row level security;
alter table public.app_auth_sessions enable row level security;
alter table public.app_password_reset_tokens enable row level security;
alter table public.app_courses enable row level security;
alter table public.app_learning_items enable row level security;
alter table public.app_learning_submissions enable row level security;
