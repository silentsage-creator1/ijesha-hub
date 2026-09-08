import { AlertTriangle, Database, ArrowRight, ExternalLink, CheckCircle2 } from 'lucide-react'

export function SupabaseNotConfigured({ onDismiss }: { onDismiss?: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] px-4 py-8">
      <div className="w-full max-w-xl rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6 sm:p-8 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--color-harbor-600)]">
            <Database size={22} />
            <p className="font-display text-lg font-semibold text-[var(--color-ink-900)]">IJESHA DIGITAL HUB Setup</p>
          </div>
          <span className="rounded-full bg-[var(--color-warning-50)] px-2.5 py-1 text-xs font-medium text-[var(--color-warning-600)] border border-[var(--color-warning-100)] flex items-center gap-1">
            <AlertTriangle size={12} /> Supabase not connected
          </span>
        </div>

        <p className="text-sm text-[var(--color-ink-600)] leading-relaxed">
          The app is ready with a full interactive environment. To enable persistent cloud storage with your own Supabase database, follow the steps below:
        </p>

        <div className="mt-4 space-y-3 rounded-[var(--radius-md)] bg-[var(--color-ink-50)] p-4 text-xs sm:text-sm text-[var(--color-ink-700)]">
          <div className="flex items-start gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-harbor-500)] text-[10px] font-bold text-white">1</span>
            <div>
              <p className="font-medium text-[var(--color-ink-900)]">Create a Supabase Project</p>
              <p className="text-[var(--color-ink-500)]">Visit <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-[var(--color-harbor-600)] underline inline-flex items-center gap-0.5">supabase.com <ExternalLink size={10} /></a> and create a free project.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-harbor-500)] text-[10px] font-bold text-white">2</span>
            <div>
              <p className="font-medium text-[var(--color-ink-900)]">Set Environment Variables</p>
              <p className="text-[var(--color-ink-500)]">Copy project URL and anon key to <code className="rounded bg-white px-1 py-0.5 border border-[var(--color-line)]">.env</code>:</p>
              <pre className="mt-1 rounded bg-white p-2 font-mono text-[11px] text-[var(--color-ink-800)] border border-[var(--color-line)] overflow-x-auto">
                VITE_SUPABASE_URL=https://xyzcompany.supabase.co{'\n'}
                VITE_SUPABASE_ANON_KEY=eyJh...
              </pre>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-harbor-500)] text-[10px] font-bold text-white">3</span>
            <div>
              <p className="font-medium text-[var(--color-ink-900)]">Execute Database Schema</p>
              <p className="text-[var(--color-ink-500)]">Run <code className="rounded bg-white px-1 py-0.5 border border-[var(--color-line)]">supabase/schema.sql</code> in your Supabase SQL Editor.</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--color-line)] pt-4">
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-harbor-600)] transition-colors shadow-sm cursor-pointer"
            >
              Explore in Interactive Demo Mode
              <ArrowRight size={16} />
            </button>
          ) : (
            <a
              href="/"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-harbor-600)] transition-colors shadow-sm"
            >
              Explore in Interactive Demo Mode
              <ArrowRight size={16} />
            </a>
          )}
          <span className="flex items-center gap-1.5 text-xs text-[var(--color-success-600)] font-medium">
            <CheckCircle2 size={14} /> All 6 roles fully simulated
          </span>
        </div>
      </div>
    </div>
  )
}
