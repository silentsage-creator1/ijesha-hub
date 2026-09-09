-- Session trainers use the same application accounts as sign-in and role changes.
alter table public.training_sessions
  add column if not exists app_trainer_id uuid
  references public.app_auth_users(id) on delete set null;
