begin;
alter table public.app_auth_users add column if not exists is_active boolean not null default true;

create or replace function public.revoke_deactivated_app_sessions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_active = false then
    delete from public.app_auth_sessions where user_id = new.id;
    delete from public.app_password_reset_tokens where user_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.revoke_deactivated_app_sessions() from public, anon, authenticated;
drop trigger if exists revoke_deactivated_app_sessions on public.app_auth_users;
create trigger revoke_deactivated_app_sessions after update of is_active on public.app_auth_users
for each row execute function public.revoke_deactivated_app_sessions();

-- Only administrator-managed links grant parent certificate access.
create table if not exists public.app_parent_links (
  parent_id uuid not null references public.app_auth_users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  primary key (parent_id, student_id)
);
alter table public.app_parent_links enable row level security;
revoke all on public.app_parent_links from anon, authenticated;
grant all on public.app_parent_links to service_role;
-- Preserve existing explicit links only where the account ID itself matches.
insert into public.app_parent_links(parent_id, student_id)
select p.parent_id, p.student_id from public.parent_links p
join public.app_auth_users a on a.id = p.parent_id and a.role = 'parent'
on conflict do nothing;
notify pgrst, 'reload schema';
commit;
