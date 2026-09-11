import { useState, type FormEvent } from 'react'
import {
  GraduationCap,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '@/app/auth'
import { Card } from '@/components/ui/primitives'

export function LoginPage() {
  const { signIn, signUp, resetPassword } = useAuth()

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setSubmitting(true)

    if (mode === 'forgot') {
      const result = await resetPassword(email.trim())
      setSubmitting(false)
      if (result.error) setError(result.error)
      else setNotice(result.developmentResetUrl ? `Development reset link: ${result.developmentResetUrl}` : 'If an account exists for that email, a reset link has been sent.')
      return
    }
    if (mode === 'signin') {
      const result = await signIn(email.trim(), password)

      setSubmitting(false)

      if (result.error) {
        setError(result.error)
      }

      return
    }

    const result = await signUp(
      email.trim(),
      password,
      fullName.trim(),
    )

    if (result.error) {
      setSubmitting(false)
      setError(result.error)
      return
    }

    setSubmitting(false)
    setPassword('')
    setNotice(
      `Registration received for ${email.trim()}. An administrator will review and activate your account in the app. You cannot sign in until approved.`,
    )
    setMode('signin')
  }


  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-ember-500)] text-white">
            <GraduationCap size={22} />
          </span>

          <h1 className="mt-3 font-display text-xl font-semibold text-[var(--color-ink-900)]">
            IJESHA DIGITAL HUB
          </h1>

          <p className="text-sm text-[var(--color-ink-400)]">
            Digital Training Management Platform
          </p>
        </div>

        <Card className="p-6">
          <div className="mb-5 flex rounded-[var(--radius-md)] bg-[var(--color-paper)] p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                setError(null)
                setNotice(null)
              }}
              className={`flex-1 rounded-[calc(var(--radius-md)-2px)] py-1.5 ${
                mode === 'signin'
                  ? 'bg-white text-[var(--color-ink-900)] shadow-sm'
                  : 'text-[var(--color-ink-400)]'
              }`}
            >
              Sign in
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setError(null)
                setNotice(null)
              }}
              className={`flex-1 rounded-[calc(var(--radius-md)-2px)] py-1.5 ${
                mode === 'signup'
                  ? 'bg-white text-[var(--color-ink-900)] shadow-sm'
                  : 'text-[var(--color-ink-400)]'
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' && (
              <>
                <Field label="Full name">
                  <input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input"
                    placeholder="Ada Nwosu"
                    autoComplete="name"
                  />
                </Field>

              </>
            )}

            <Field label="Email">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </Field>

            {mode !== 'forgot' && <Field label="Password">
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                autoComplete={
                  mode === 'signin'
                    ? 'current-password'
                    : 'new-password'
                }
              />
            </Field>}
            {mode === 'signin' && <button type="button" onClick={() => { setMode('forgot'); setError(null); setNotice(null) }} className="-mt-1 text-xs font-semibold text-[var(--color-harbor-700)]">Forgot password?</button>}

            {error && (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] p-3.5 text-xs text-[var(--color-danger-700)]">
                <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-danger-800)]">
                  <AlertCircle size={15} />

                  <span>Account access issue</span>
                </div>

                <p className="leading-relaxed">
                  {error}
                </p>

              </div>
            )}

            {notice && (
              <div className="rounded-md border border-[var(--color-success-200)] bg-[var(--color-success-50)] p-3 text-xs leading-relaxed text-[var(--color-success-700)]">
                {notice}
              </div>
            )}

            {mode === 'signup' && (
              <div className="flex items-start gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-2.5 text-[11px] text-[var(--color-ink-600)]">
                <ShieldCheck
                  size={16}
                  className="mt-0.5 shrink-0 text-[var(--color-harbor-600)]"
                />

                <span>
                  <strong>In-App Admin Verification:</strong> After creating
                  your account, an administrator can review and activate
                  your account inside the app.
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-harbor-600)] disabled:opacity-60"
            >
              {submitting && (
                <Loader2 size={16} className="animate-spin" />
              )}

              {submitting
                ? mode === 'forgot'
                  ? 'Sending reset link...'
                  : mode === 'signin'
                  ? 'Signing in...'
                  : 'Creating account...'
                : mode === 'forgot'
                  ? 'Send reset link'
                  : mode === 'signin'
                  ? 'Sign in'
                  : 'Create Account'}
            </button>

          </form>
        </Card>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--color-ink-600)]">
        {label}
      </span>

      {children}
    </label>
  )
}
