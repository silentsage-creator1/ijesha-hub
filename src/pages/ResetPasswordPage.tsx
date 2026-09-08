import { useState, type FormEvent } from 'react'
import { GraduationCap } from 'lucide-react'
import { useAuth } from '@/app/auth'
import { Card } from '@/components/ui/primitives'

export function ResetPasswordPage() {
  const { completePasswordReset } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null); setNotice(null)
    if (password.length < 8) { setError('Use at least 8 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) { setError('This reset link is incomplete. Request a new one.'); return }
    setSaving(true); const result = await completePasswordReset(token, password); setSaving(false)
    if (result.error) setError(result.error); else setNotice('Password updated. You can now sign in with your new password.')
  }
  return <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] px-4"><div className="w-full max-w-sm"><div className="mb-6 flex flex-col items-center text-center"><span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-ember-500)] text-white"><GraduationCap size={22}/></span><h1 className="mt-3 font-display text-xl font-semibold text-[var(--color-ink-900)]">IJESHA DIGITAL HUB</h1><p className="text-sm text-[var(--color-ink-400)]">Choose a new password</p></div><Card className="p-6"><form onSubmit={submit} className="space-y-3.5"><label className="block"><span className="mb-1 block text-xs font-medium text-[var(--color-ink-600)]">New password</span><input required minLength={8} type="password" autoComplete="new-password" className="input" value={password} onChange={e=>setPassword(e.target.value)}/></label><label className="block"><span className="mb-1 block text-xs font-medium text-[var(--color-ink-600)]">Confirm new password</span><input required minLength={8} type="password" autoComplete="new-password" className="input" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>{error&&<p className="text-sm text-[var(--color-danger-600)]">{error}</p>}{notice&&<p className="text-sm text-[var(--color-success-600)]">{notice}</p>}<button disabled={saving} className="w-full rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving?'Updating…':'Update password'}</button></form></Card></div></div>
}
