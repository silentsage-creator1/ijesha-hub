# AGENTS.md — Digital Training Management Platform

This file documents the conventions established so far. Future features should
read this before writing code, and should reuse everything listed below
rather than recreating it.

## Status

- **Feature 1 (Design System & UI Foundation):** Did not exist in this
  workspace when Feature 2 began. The design system below was created as
  part of Feature 2 to unblock the shell, and now stands in as the
  foundation for all future features.
- **Feature 2 (Application Shell, Navigation & Dashboard Experience):**
  Complete.
- **Feature 3 (Backend, pass 1 — Auth + Students + Trainers):** Complete.
  Real Supabase backend: authentication, `profiles`/`students`/`teachers`/
  `parent_links` tables, row-level security enforcing role-based access at
  the database level. See `SETUP.md` to connect your own Supabase project.
  Manager/admin can add, edit, and remove students and trainers. Clicking a
  student's name in the roster opens `/students/:id`, a per-student detail
  page (the seed of what becomes their full staff-facing dashboard once
  attendance/progress/assignments/etc. are built — that page documents
  exactly which sections are still needed).

## Stack

- Vite + React 19 + TypeScript (strict-ish: `noUnusedLocals`, `noUnusedParameters`)
- Tailwind CSS v4 (via `@tailwindcss/vite`, config lives in `src/index.css` as `@theme`)
- `react-router-dom` for routing
- `lucide-react` for icons
- **Supabase** (Postgres + Auth) for the backend — client in `src/lib/supabase.ts`,
  schema + RLS policies in `supabase/schema.sql`, auth context in `src/app/auth.tsx`
- No other state library — Supabase's client + React state is enough so far

## Design system ("Harbor & Ember")

All tokens are CSS custom properties defined once in `src/index.css` under
`@theme`. Never hardcode a hex value in a component — reference the token
(e.g. `bg-[var(--color-harbor-500)]`).

- **Ink** (`--color-ink-*`): navy scale for structure, sidebar, text
- **Harbor** (`--color-harbor-*`): primary brand / interactive blue
- **Ember** (`--color-ember-*`): accent reserved for momentum/achievement
  moments (streaks, celebrations) — don't use it for ordinary UI chrome
- **Success/Warning/Danger**: status colors
- Fonts: Space Grotesk (`--font-display`, headings) + Inter (`--font-body`)

Shared primitives live in `src/components/ui/primitives.tsx`
(`Card`, `Badge`, `Avatar`, `ProgressRing`, `StreakChip`, `SectionHeading`).
Dashboard-specific building blocks live in `src/components/dashboard/blocks.tsx`
(`StatCard`, `AttentionList`, `ActivityFeed`). Reuse these before creating new
one-off components.

## Application shell

`src/components/shell/` holds the reusable shell: `AppShell` (layout),
`Sidebar`, `Topbar`, `Breadcrumbs`, `SearchBox`, `NotificationMenu`,
`UserMenu`, `PageHeader`. Every route renders inside `AppShell` via the
router's nested `<Outlet />` — don't build a competing layout.

## Navigation & roles

- Single source of truth: `src/data/navigation.ts` (`NAVIGATION` array +
  `navigationForRole(role)`).
- Roles: `admin | manager | trainer | student | parent`, typed in `src/types/index.ts`.
- Routes are generated from this same config in `src/app/routes.tsx` — adding
  a nav item automatically gets a placeholder route. When a feature actually
  builds a section out, replace its placeholder `<Route>` with the real page,
  no other wiring needed.
- **Role filtering here is UI wayfinding. Real enforcement now lives in
  Postgres row-level security** (`supabase/schema.sql`), which is the
  authoritative access-control layer — every table check covers auth,
  role, and resource ownership (e.g. a trainer's `students` query is
  automatically filtered to `assigned_trainer_id = auth.uid()` by RLS, not
  by client-side code). Never trust IDs supplied by the client for anything
  security-relevant; RLS is what actually prevents cross-role access even if
  a client bug or malicious client tried to query someone else's rows.
- Auth is real (`src/app/auth.tsx`, backed by Supabase Auth). The old
  demo-only role switcher is gone.

## Backend (Supabase)

- Schema + RLS: `supabase/schema.sql`. Re-run safely after edits (uses
  `if not exists` / `drop policy if exists`).
- Tables so far: `profiles` (role per user), `students`, `teachers`,
  `parent_links` (parent ↔ student junction, not yet exposed in any UI).
- Client: `src/lib/supabase.ts`, reads `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` from `.env` (see `.env.example`).
- `useAuth()` (`src/app/auth.tsx`) exposes `session`, `profile`, `user`,
  `role`, `signIn`, `signUp`, `signOut`. `App.tsx` gates the whole app:
  unconfigured Supabase → setup screen; no session → `LoginPage`; session
  but no profile row yet → loading spinner; otherwise → the real app.
- CRUD pattern used by `StudentsPage`/`TeachersPage`/`StudentDetailPage`:
  local `useState` list + a `load()` function called on mount, Supabase
  `.select()/.insert()/.update()/.delete()` directly from the client (no
  custom API layer — RLS is the security boundary, so this is safe).
  Follow this same pattern for future entities (Courses, Cohorts, Sessions,
  Attendance, ...) rather than introducing a different data-fetching
  approach.
- New entity checklist: (1) table + RLS policies in `schema.sql`,
  (2) TypeScript interface in `src/types/index.ts`, (3) page component
  following the Students/Teachers pattern, (4) wire the route in
  `src/app/routes.tsx`, replacing that item's placeholder.

## Progress reporting (planned, not built)

`src/pages/ReportsPage.tsx` documents the intended Trainer → Parent workflow
and — critically — the separation between parent-visible report fields and
internal trainer notes. When that feature is built, keep those as genuinely
separate fields/tables; never let internal notes flow into a published
report field.

## Engagement / motivation features

Streaks, achievement badges, celebration banners, and progress rings are
real UI primitives already in the system (see `StreakChip`, `ProgressRing`,
the ember accent). Keep them understated — one celebratory moment per view,
no public rankings, no shaming mechanics. If leaderboards are ever added,
they must be opt-in and framed positively.

## What's still placeholder

Every nav item other than Dashboard, Progress Reports, Students, and
Trainers renders `PlaceholderPage` with no fake data. Do not invent sample
courses, attendance records, etc. inside placeholders — only the dashboards
use illustrative demo data, and that's clearly a preview of shape, not real
records.

Known simplifications in this pass, worth revisiting:
- `organization` scoping exists as a column on `students`/`teachers` but
  isn't yet enforced in RLS (a manager currently sees all orgs, not just
  their own) — add an org-scoped policy once multi-org support matters.
- `parent_links` has no UI yet — rows must be inserted manually today.
- Self-signup lets anyone create an account (defaulting to role `student`);
  an admin must manually promote roles. A proper invite flow is a future
  feature.
