-- Assign a trainer to an individual cohort. Existing course-level trainer
-- assignments continue to grant access to cohorts without a direct trainer.
alter table public.cohorts
  add column if not exists trainer_id uuid;

-- Some installations already have cohorts.trainer_id linked to profiles.id.
-- Trainer accounts in this app live in app_auth_users, so replace that FK.
alter table public.cohorts drop constraint if exists cohorts_trainer_id_fkey;
update public.cohorts c
set trainer_id = null
where c.trainer_id is not null
  and not exists (select 1 from public.app_auth_users a where a.id = c.trainer_id);
alter table public.cohorts
  add constraint cohorts_trainer_id_fkey
  foreign key (trainer_id) references public.app_auth_users(id) on delete set null;

create index if not exists cohorts_trainer_id_idx on public.cohorts(trainer_id);
