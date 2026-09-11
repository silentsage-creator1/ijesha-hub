import { useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AuthProvider, useAuth } from '@/app/auth'
import { AppRoutes } from '@/app/routes'
import { LoginPage } from '@/pages/LoginPage'
import { SupabaseNotConfigured } from '@/pages/SupabaseNotConfigured'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { supabaseConfigured } from '@/lib/supabase'
import { RlsRecursionBanner } from '@/components/common/RlsRecursionBanner'

function Gate() {
  const { session, profile, loading, error, refreshProfile } = useAuth()
  const [retrying, setRetrying] = useState(false)
  const retry = async () => {
    if (retrying) return
    setRetrying(true)
    try { await refreshProfile() } finally { setRetrying(false) }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)]">
        <Loader2 size={24} className="animate-spin text-[var(--color-harbor-500)]" />
      </div>
    )
  }

  // A failed initial lookup is not proof that the session has expired.
  // Do not expose the workspace until an account has been verified.
  if (error && (!session || !profile)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] p-4">
        <div className="max-w-md rounded-[var(--radius-lg)] border border-[var(--color-danger-100)] bg-white p-6 text-center shadow-[var(--shadow-card)]">
          <h1 className="font-display text-lg font-semibold text-[var(--color-ink-900)]">We couldn’t open your workspace</h1>
          <p className="mt-2 text-sm text-[var(--color-ink-500)]">{error}</p>
          <button
            type="button"
            onClick={() => void retry()}
            disabled={retrying}
            className="mt-5 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3.5 py-2 text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
          >
            {retrying ? 'Retrying…' : 'Retry connection'}
          </button>
        </div>
      </div>
    )
  }

  if (!session) return <LoginPage />

  // Signed in but the profile row hasn't loaded (or the trigger hasn't run yet) — treat as loading.
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)]">
        <Loader2 size={24} className="animate-spin text-[var(--color-harbor-500)]" />
      </div>
    )
  }

  // Keep the same route tree mounted so a temporary outage does not discard
  // the current page or unsaved form inputs. API authorization still applies.
  return <>
    <div role="status" aria-live="polite">
      {error && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3 text-sm text-[var(--color-ink-700)]">
        <span>Connection interrupted. We couldn’t refresh your session. Your workspace is still open; we’ll retry automatically.</span>
        <button type="button" disabled={retrying} onClick={() => void retry()} className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-1.5 font-semibold disabled:opacity-60">
          {retrying ? 'Retrying…' : 'Retry connection'}
        </button>
      </div>}
    </div>
    <AppRoutes />
  </>
}

export default function App() {
  const [showSetupGuide, setShowSetupGuide] = useState(false)

  return (
    <AuthProvider>
      <BrowserRouter>
        {window.location.pathname === '/reset-password' ? (
          <ResetPasswordPage />
        ) : showSetupGuide ? (
          <SupabaseNotConfigured onDismiss={() => setShowSetupGuide(false)} />
        ) : (
          <div className="min-h-screen flex flex-col">
            <RlsRecursionBanner />
            {!supabaseConfigured && (
              <div className="bg-[var(--color-harbor-800)] text-white px-3 py-1.5 text-xs flex items-center justify-between z-50">
                <div className="flex items-center gap-2 truncate">
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="truncate"><strong>Interactive Demo Mode:</strong> All 6 roles and platform features available.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSetupGuide(true)}
                  className="underline text-blue-200 hover:text-white font-medium ml-3 cursor-pointer shrink-0"
                >
                  Connect Supabase
                </button>
              </div>
            )}
            <div className="flex-1 flex flex-col">
              <Gate />
            </div>
          </div>
        )}
      </BrowserRouter>
    </AuthProvider>
  )
}
