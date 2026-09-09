begin;
alter table public.training_sessions add column if not exists week_number integer check(week_number between 1 and 520);
alter table public.training_sessions
  add column if not exists app_trainer_id uuid references public.app_auth_users(id) on delete set null,
  add column if not exists description text not null default '',
  add column if not exists session_type text not null default 'physical',
  add column if not exists location text not null default '',
  add column if not exists meeting_link text not null default '';
-- Existing sessions can be completed later with an end time.
alter table public.training_sessions drop constraint if exists session_end_after_start;
alter table public.training_sessions add constraint session_end_after_start check (ends_at is null or ends_at > starts_at) not valid;
alter table public.training_sessions drop constraint if exists session_type_valid;
alter table public.training_sessions add constraint session_type_valid check (session_type in ('physical','online','hybrid'));
alter table public.app_learning_items add column if not exists session_id uuid references public.training_sessions(id) on delete set null;
alter table public.app_learning_items drop constraint if exists app_learning_items_item_type_check;
alter table public.app_learning_items add constraint app_learning_items_item_type_check check(item_type in ('classwork','assignment','assessment','project'));
create table if not exists public.app_session_resources (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  kind text not null check(kind in ('material','note')),
  title text not null,
  content text not null default '',
  created_by uuid not null references public.app_auth_users(id),
  created_at timestamptz not null default now()
);
alter table public.app_session_resources enable row level security;
commit;
