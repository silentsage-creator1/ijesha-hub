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
  const { session, profile, loading, error, signOut } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)]">
        <Loader2 size={24} className="animate-spin text-[var(--color-harbor-500)]" />
      </div>
    )
  }

  if (!session) return <LoginPage />

  // A failed profile query must not leave a signed-in person on a perpetual spinner.
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] p-4">
        <div className="max-w-md rounded-[var(--radius-lg)] border border-[var(--color-danger-100)] bg-white p-6 text-center shadow-[var(--shadow-card)]">
          <h1 className="font-display text-lg font-semibold text-[var(--color-ink-900)]">We couldn’t open your workspace</h1>
          <p className="mt-2 text-sm text-[var(--color-ink-500)]">{error}</p>
          <button
            type="button"
            onClick={() => signOut()}
            className="mt-5 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3.5 py-2 text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
          >
            Return to Sign In
          </button>
        </div>
      </div>
    )
  }

  // Signed in but the profile row hasn't loaded (or the trigger hasn't run yet) — treat as loading.
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)]">
        <Loader2 size={24} className="animate-spin text-[var(--color-harbor-500)]" />
      </div>
    )
  }

  return <AppRoutes />
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
