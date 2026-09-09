begin;
-- Older installations have phone/bio/emergency_contact fields instead of
-- the expanded student form. Preserve those columns and add the new fields.
alter table public.student_profile_details
  add column if not exists first_name text,
  add column if not exists middle_name text,
  add column if not exists last_name text,
  add column if not exists date_of_birth date,
  add column if not exists gender text,
  add column if not exists phone_number text,
  add column if not exists home_address text,
  add column if not exists state text,
  add column if not exists lga text,
  add column if not exists city_town text,
  add column if not exists guardian_first_name text,
  add column if not exists guardian_last_name text,
  add column if not exists guardian_relationship text,
  add column if not exists guardian_phone text,
  add column if not exists guardian_alt_phone text,
  add column if not exists guardian_email text,
  add column if not exists guardian_address text,
  add column if not exists certificate_name text;
create unique index if not exists student_profile_details_student_unique on public.student_profile_details(student_id);
create table if not exists public.app_profile_details (
  user_id uuid primary key references public.app_auth_users(id) on delete cascade,
  details jsonb not null default '{}'::jsonb
);
create table if not exists public.app_certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  student_name text not null, course text not null, cohort text not null,
  certificate_type text not null, issue_date date not null,
  status text not null check(status in ('Issued','Pending','Draft')),
  template_url text, calibration jsonb,
  issued_by uuid references public.app_auth_users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.app_profile_details enable row level security;
alter table public.app_certificates enable row level security;
revoke all on public.app_profile_details, public.app_certificates from anon, authenticated;
grant all on public.app_profile_details, public.app_certificates to service_role;
create index if not exists app_certificates_student_idx on public.app_certificates(student_id);
commit;
