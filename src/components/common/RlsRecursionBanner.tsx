import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Copy, ExternalLink, X } from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabase'

const FIX_SQL = `-- 1. Create non-recursive security definer helper functions
create or replace function public.current_role()
returns app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'manager'));
$$;

create or replace function public.is_trainer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'trainer');
$$;

grant execute on function public.current_role(), public.is_admin(), public.is_staff(), public.is_trainer() to anon, authenticated;

-- 2. Drop recursive policies on public.profiles and recreate them
drop policy if exists "profiles_select_staff" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own_name" on public.profiles;

create policy "profiles_select_own" on public.profiles for select using (id = auth.uid());
create policy "profiles_select_staff" on public.profiles for select using (public.is_staff());
create policy "profiles_update_admin" on public.profiles for update using (public.is_admin());
create policy "profiles_update_own_name" on public.profiles for update using (id = auth.uid());

-- 3. Fix policies on students table
drop policy if exists "students_select_admin_manager" on public.students;
create policy "students_select_admin_manager" on public.students for select using (public.is_staff());

drop policy if exists "students_select_trainer" on public.students;
create policy "students_select_trainer" on public.students for select using (assigned_trainer_id = auth.uid() and public.is_trainer());

drop policy if exists "students_insert_admin_manager" on public.students;
create policy "students_insert_admin_manager" on public.students for insert with check (public.is_staff());

drop policy if exists "students_update_admin_manager" on public.students;
create policy "students_update_admin_manager" on public.students for update using (public.is_staff());

drop policy if exists "students_delete_admin_manager" on public.students;
create policy "students_delete_admin_manager" on public.students for delete using (public.is_staff());

-- 4. Fix policies on teachers table
drop policy if exists "teachers_select_admin_manager" on public.teachers;
create policy "teachers_select_admin_manager" on public.teachers for select using (public.is_staff());

drop policy if exists "teachers_insert_admin_manager" on public.teachers;
create policy "teachers_insert_admin_manager" on public.teachers for insert with check (public.is_staff());

drop policy if exists "teachers_update_admin_manager" on public.teachers;
create policy "teachers_update_admin_manager" on public.teachers for update using (public.is_staff());

drop policy if exists "teachers_delete_admin_manager" on public.teachers;
create policy "teachers_delete_admin_manager" on public.teachers for delete using (public.is_staff());

-- 5. Fix policies on parent_links table
drop policy if exists "parent_links_select_admin_manager" on public.parent_links;
create policy "parent_links_select_admin_manager" on public.parent_links for select using (public.is_staff());

drop policy if exists "parent_links_write_admin_manager" on public.parent_links;
create policy "parent_links_write_admin_manager" on public.parent_links for all using (public.is_staff());
`

export function RlsRecursionBanner() {
  const [detected, setDetected] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const handleEvent = () => {
      setDetected(true)
    }
    window.addEventListener('supabase_rls_recursion_error', handleEvent)

    // Also proactively check once if Supabase is configured
    if (supabaseConfigured) {
      const checkRls = async () => {
        try {
          const { error } = await supabase.from('profiles').select('id').limit(1)
          if (
            error &&
            (error.code === '42P17' ||
              error.message?.toLowerCase().includes('infinite recursion'))
          ) {
            setDetected(true)
          }
        } catch {
          // ignore
        }
      }
      checkRls()
    }

    return () => {
      window.removeEventListener('supabase_rls_recursion_error', handleEvent)
    }
  }, [])

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(FIX_SQL)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      // Fallback
      setCopied(true)
    }
  }

  if (!detected || dismissed) return null

  return (
    <>
      <aside aria-label="Supabase database notification" className="bg-amber-500 text-slate-900 px-4 py-2.5 text-xs font-medium flex items-center justify-between shadow-sm z-50 border-b border-amber-600/30">
        <div className="flex items-center gap-2.5 truncate mr-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-slate-950" />
          <span className="truncate">
            <strong>Supabase Database Fix Required:</strong> Infinite recursion
            detected on profiles policy (Error 42P17).
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={copySql}
            className="inline-flex items-center gap-1.5 bg-slate-900 text-amber-300 hover:text-white px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors shadow-xs"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>Copied SQL!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy SQL Fix</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="underline text-slate-950 hover:text-black font-semibold cursor-pointer px-1"
          >
            Instructions
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-amber-600/20 rounded cursor-pointer text-slate-900"
            title="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </aside>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 text-slate-800 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h2 className="text-base font-bold text-slate-900">
                  Fix Supabase Infinite Recursion (Error 42P17)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="my-4 text-sm space-y-3 overflow-y-auto flex-1">
              <p className="text-slate-600 leading-relaxed">
                The Row Level Security policy on your Supabase <code className="bg-slate-100 text-slate-900 px-1 py-0.5 rounded font-mono text-xs">profiles</code> table
                previously queried <code className="bg-slate-100 text-slate-900 px-1 py-0.5 rounded font-mono text-xs">profiles</code> directly, causing PostgreSQL to
                trigger an infinite loop.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1.5">
                <p className="font-semibold">How to apply this 10-second fix:</p>
                <ol className="list-decimal list-inside space-y-1 pl-1">
                  <li>
                    Open your <strong>Supabase Dashboard</strong> and navigate to the <strong>SQL Editor</strong> tab.
                  </li>
                  <li>Click <strong>+ New query</strong>.</li>
                  <li>
                    Click the <strong>Copy SQL</strong> button below and paste it into the editor.
                  </li>
                  <li>Click <strong>Run</strong> (or press Cmd/Ctrl + Enter).</li>
                </ol>
              </div>

              <div className="relative mt-3">
                <div className="flex items-center justify-between bg-slate-900 text-slate-300 text-xs px-3 py-1.5 rounded-t-lg">
                  <span className="font-mono">fix-infinite-recursion.sql</span>
                  <button
                    type="button"
                    onClick={copySql}
                    className="inline-flex items-center gap-1 text-amber-300 hover:text-white text-xs font-semibold cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy SQL</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-slate-950 text-slate-100 text-xs font-mono p-3 rounded-b-lg overflow-x-auto max-h-56 leading-relaxed border border-slate-800">
                  {FIX_SQL}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors"
              >
                <span>Open Supabase Dashboard</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                onClick={() => {
                  copySql()
                }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-white" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy SQL & Close'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
