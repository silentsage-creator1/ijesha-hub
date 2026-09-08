# Setup — Backend (Supabase)

Supabase is used as the database. Authentication is handled by the separate
application backend, which keeps password hashes and the Supabase service-role
key off the browser.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. Wait for it to finish provisioning (a couple of minutes).

## 2. Run the schema

1. In your Supabase project, open **SQL Editor → New query**.
2. Paste the entire contents of `supabase/schema.sql` from this repo.
3. Click **Run**.
4. Run `supabase/app-auth-migration.sql` in a new query.

This creates:
- `profiles` — one row per logged-in user, holding their `role`
  (`admin | manager | trainer | student | parent`)
- `students`, `teachers` — the rosters, with full CRUD for admin/manager and
  scoped read access for trainers/students/parents
- `parent_links` — which parent account can see which student
- A trigger that auto-creates a `profiles` row (defaulting to role `student`)
  whenever someone signs up
- Row-level security policies on every table enforcing all of the above at
  the database level — not just hidden in the UI

Safe to re-run if you make schema changes later — it uses `if not exists` /
`drop policy if exists` throughout.

## 3. Configure the backend

In **Project Settings → API**, copy the **Project URL** and **service_role**
key. Put these only in `.env.server`; never put the service-role key in a
Vite/browser environment.

## 4. Configure the app

```bash
copy .env.server.example .env.server
```

Edit `.env.server`:

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
APP_ADMIN_EMAIL=info@ijeshadigitalhub.com
```

## 5. Install and run

```bash
npm install
npm run server
npm run dev
```

## 6. Create your first administrator account

1. Set `APP_ADMIN_EMAIL` in `.env.server` to your exact email address.
2. Start the backend, then sign up with that email. That account is created
   as an approved administrator; all other sign-ups are pending.
3. Sign in — you'll now see the Admin dashboard
   and full navigation, including Users/Students/Trainers management.

## 7. Add staff and students

- As an admin or manager, go to **Students** or **Trainers** in the nav to
  add/edit/remove roster entries. These are plain records — they don't need
  a login account to exist.
- To let someone actually log in as a manager/trainer/parent, they need to
  sign up for an account (or you create one for them via Supabase Dashboard
  → Authentication → Users → Add user), then an admin updates their role in
  `profiles` the same way as step 6.
- To link a parent to a student so they can see that student's info, insert
  a row into `parent_links` (a dedicated UI for this is a next step — see
  `AGENTS.md`).

## What's real vs. what's still a placeholder

| Area | Status |
|---|---|
| Auth (sign up/in/out) | Real — application backend |
| Roles & permissions | Real — enforced by Postgres RLS, not just hidden in the UI |
| Students roster (add/edit/remove) | Real |
| Trainers roster (add/edit/remove) | Real |
| Student detail page | Real record view; attendance/progress/assignments/etc. sections are documented placeholders (see the page itself) |
| Courses, Cohorts, Sessions, Attendance, Assignments, Projects, Assessments, Progress, Reports, Analytics, Announcements, Audit logs, Settings | Not built yet — placeholder pages |
| Parent-child linking | Table + RLS exist; no UI yet to create links |

## Troubleshooting

- **"Supabase isn't configured yet" screen** — your `.env` is missing or the
  dev server needs a restart after editing it.
- **Login works but the app hangs on a spinner** — the `profiles` row for
  that user probably wasn't created. Check the SQL Editor logs for the
  `handle_new_user` trigger, or manually insert a row into `profiles` for
  that user's `id`.
- **"new row violates row-level security policy"** — the signed-in user's
  role doesn't have permission for that action. Check their role in
  `profiles`.
- **"infinite recursion detected in policy for relation 'profiles'" (Error 42P17)** — Run
  `supabase/fix-infinite-recursion.sql` in your Supabase SQL Editor. This replaces
  recursive role subqueries on `profiles` with lightweight, cached `security definer`
  helper functions (`is_staff()`, `is_admin()`, `current_role()`), completely resolving
  the error.
- **"registration is awaiting in-app administrator approval"** — sign in with
  the administrator account and approve the account through the application
  backend's protected approval endpoint.
