-- Keep application courses and cohorts connected without exposing IDs in the UI.
alter table public.app_courses add column if not exists category text;
alter table public.cohorts add column if not exists app_course_id uuid references public.app_courses(id) on delete set null;
-- New cohorts use the application-course relationship; preserve legacy links.
alter table public.cohorts alter column course_id drop not null;
create unique index if not exists cohorts_app_course_name_idx on public.cohorts(app_course_id, name);

insert into public.app_courses (title, description, category, status, created_by)
select course.title, '', course.category, 'Draft', admin_account.id
from (values
  ('Software Development', 'Technology'),
  ('Cybersecurity', 'Technology'),
  ('Product Design', 'Design'),
  ('Data Analysis', 'Data')
) as course(title, category)
cross join lateral (
  select id from public.app_auth_users where role = 'admin' order by created_at limit 1
) as admin_account
where not exists (select 1 from public.app_courses where lower(title) = lower(course.title));
