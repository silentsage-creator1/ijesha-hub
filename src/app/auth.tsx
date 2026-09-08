import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CurrentUser, Profile, Role } from '@/types'

type AppUser = { id: string; email: string; full_name: string; role: Role; organization: string; track?: string | null; approval_status: 'pending' | 'approved' | 'rejected'; created_at: string }
export type AppSession = { user: { id: string; email: string; created_at: string; user_metadata: Record<string, unknown> } }

interface AuthContextValue {
  session: AppSession | null; profile: Profile | null; user: CurrentUser | null; role: Role | null; loading: boolean; error: string | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  quickSignIn: (role: Role) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string, track?: string) => Promise<{ error: string | null; user?: AppUser }>
  resetPassword: (email: string) => Promise<{ error: string | null; developmentResetUrl?: string }>
  completePasswordReset: (token: string, password: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  updateEmail: (email: string) => Promise<{ error: string | null }>
  updateProfile: (fullName: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>; refreshProfile: () => Promise<void>
}
const AuthContext = createContext<AuthContextValue | null>(null)

export function isPlatformAdminEmail(email?: string | null) {
  return email?.trim().toLowerCase() === 'info@ijeshadigitalhub.com'
}

function initialsFor(name: string) { return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase() || 'U' }
function toState(account: AppUser): { session: AppSession; profile: Profile } {
  return { session: { user: { id: account.id, email: account.email, created_at: account.created_at, user_metadata: { full_name: account.full_name, role: account.role, track: account.track ?? 'Frontend Development', approval_status: account.approval_status, organization: account.organization } } }, profile: { id: account.id, full_name: account.full_name, role: account.role, organization: account.organization, created_at: account.created_at, approval_status: account.approval_status } }
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, { ...init, credentials: 'include', headers: { 'content-type': 'application/json', ...init?.headers } })
  } catch {
    throw new Error('The application sign-in service is unavailable. Start `npm run server`, then refresh this page.')
  }
  const payload = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || `The application sign-in service returned an error (${response.status}). Check its terminal output.`)
  return payload
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AppSession | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refreshProfile = useCallback(async () => {
    try { const { user: account } = await request<{ user: AppUser }>('/api/auth/me'); const next = toState(account); setSession(next.session); setProfile(next.profile); setError(null) }
    catch (err) { setSession(null); setProfile(null); if (!(err instanceof Error && err.message === 'Not signed in.')) setError(err instanceof Error ? err.message : 'Unable to restore your session.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void refreshProfile() }, [refreshProfile])
  useEffect(() => {
    const interval = window.setInterval(() => { void refreshProfile() }, 30_000)
    return () => window.clearInterval(interval)
  }, [refreshProfile])
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshProfile()
    }
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [refreshProfile])
  const value = useMemo<AuthContextValue>(() => ({
    session, profile, user: profile ? { name: profile.full_name, role: profile.role, initials: initialsFor(profile.full_name), org: profile.organization ?? undefined, photoPath: profile.photo_path ?? undefined } : null, role: profile?.role ?? null, loading, error,
    async signIn(email, password) { try { const { user: account } = await request<{ user: AppUser }>('/api/auth/signin', { method: 'POST', body: JSON.stringify({ email, password }) }); const next = toState(account); setSession(next.session); setProfile(next.profile); setError(null); return { error: null } } catch (err) { const message = err instanceof Error ? err.message : 'Unable to sign in.'; setError(message); return { error: message } } },
    async quickSignIn() { return { error: 'Demo sign-in is no longer available. Please use an application account.' } },
    async signUp(email, password, fullName, track) { try { const result = await request<{ user: AppUser }>('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, fullName, track }) }); setError(null); return { error: null, user: result.user } } catch (err) { const message = err instanceof Error ? err.message : 'Unable to create your account.'; setError(message); return { error: message } } },
    async resetPassword(email) { try { const result = await request<{ developmentResetUrl?: string }>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); return { error: null, developmentResetUrl: result.developmentResetUrl } } catch (err) { return { error: err instanceof Error ? err.message : 'Unable to request a reset link.' } } },
    async completePasswordReset(token, password) { try { await request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }); return { error: null } } catch (err) { return { error: err instanceof Error ? err.message : 'Unable to reset password.' } } },
    async updatePassword(password) { try { await request('/api/auth/password', { method: 'PATCH', body: JSON.stringify({ password }) }); return { error: null } } catch (err) { return { error: err instanceof Error ? err.message : 'Unable to update your password.' } } },
    async updateEmail(email) { try { const { user: account } = await request<{ user: AppUser }>('/api/auth/email', { method: 'PATCH', body: JSON.stringify({ email }) }); const next = toState(account); setSession(next.session); setProfile(next.profile); return { error: null } } catch (err) { return { error: err instanceof Error ? err.message : 'Unable to update your email.' } } },
    async updateProfile(fullName) { try { const { user: account } = await request<{ user: AppUser }>('/api/auth/profile', { method: 'PATCH', body: JSON.stringify({ fullName }) }); const next = toState(account); setSession(next.session); setProfile(next.profile); return { error: null } } catch (err) { return { error: err instanceof Error ? err.message : 'Unable to update your profile.' } } },
    async signOut() { await fetch('/api/auth/signout', { method: 'POST', credentials: 'include' }); setSession(null); setProfile(null); setError(null) }, refreshProfile,
  }), [error, loading, profile, refreshProfile, session])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used within AuthProvider'); return context }
