import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
// Both Vercel and the local Vite server proxy /api to the backend.
// Keep login cookies first-party even if an old VITE_API_URL is configured.
export const apiUrl = (path: string) => path

export function isPlatformAdminEmail(email?: string | null) {
  return email?.trim().toLowerCase() === 'info@ijeshadigitalhub.com'
}

function initialsFor(name: string) { return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase() || 'U' }
function toState(account: AppUser): { session: AppSession; profile: Profile } {
  return { session: { user: { id: account.id, email: account.email, created_at: account.created_at, user_metadata: { full_name: account.full_name, role: account.role, track: account.track ?? 'Frontend Development', approval_status: account.approval_status, organization: account.organization } } }, profile: { id: account.id, full_name: account.full_name, role: account.role, organization: account.organization, created_at: account.created_at, approval_status: account.approval_status } }
}
class AuthRequestError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(apiUrl(path), { ...init, credentials: 'include', headers: { 'content-type': 'application/json', ...init?.headers } })
  } catch {
    throw new Error('The application sign-in service is temporarily unavailable. Please try again shortly.')
  }
  const payload = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new AuthRequestError(payload.error || `The application sign-in service returned an error (${response.status}). Please try again shortly.`, response.status)
  return payload
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AppSession | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const authRevision = useRef(0)
  const refreshProfile = useCallback(async () => {
    const revision = ++authRevision.current
    try {
      const { user: account } = await request<{ user: AppUser }>('/api/auth/me')
      if (revision !== authRevision.current) return
      const next = toState(account); setSession(next.session); setProfile(next.profile); setError(null)
    } catch (err) {
      if (revision !== authRevision.current) return
      if (err instanceof AuthRequestError && err.status === 401) {
        setSession(null); setProfile(null); setError(null)
      } else {
        setError(err instanceof Error ? err.message : 'Unable to refresh your session. Please try again shortly.')
      }
    } finally { if (revision === authRevision.current) setLoading(false) }
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
    async signIn(email, password) {
      ++authRevision.current
      try {
        const signedIn = await request<{ user: AppUser }>('/api/auth/signin', { method: 'POST', body: JSON.stringify({ email, password }) })
        // A successful password check does not prove that the browser saved the cookie.
        let verified: { user: AppUser }
        try { verified = await request<{ user: AppUser }>('/api/auth/me') }
        catch (err) {
          if (err instanceof AuthRequestError && err.status === 401) throw new Error('Your browser could not keep the login session. Allow cookies for this site and try again.')
          throw err
        }
        if (!verified.user || verified.user.id !== signedIn.user.id) throw new Error('Unable to confirm your login session. Please try again.')
        ++authRevision.current; setLoading(false)
        const next = toState(verified.user); setSession(next.session); setProfile(next.profile); setError(null)
        return { error: null }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to sign in.'
        setError(message); return { error: message }
      }
    },
    async quickSignIn() { return { error: 'Demo sign-in is no longer available. Please use an application account.' } },
    async signUp(email, password, fullName, track) { try { const result = await request<{ user: AppUser }>('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, fullName, track }) }); setError(null); return { error: null, user: result.user } } catch (err) { const message = err instanceof Error ? err.message : 'Unable to create your account.'; setError(message); return { error: message } } },
    async resetPassword(email) { try { const result = await request<{ developmentResetUrl?: string }>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); return { error: null, developmentResetUrl: result.developmentResetUrl } } catch (err) { return { error: err instanceof Error ? err.message : 'Unable to request a reset link.' } } },
    async completePasswordReset(token, password) { try { await request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }); return { error: null } } catch (err) { return { error: err instanceof Error ? err.message : 'Unable to reset password.' } } },
    async updatePassword(password) { try { await request('/api/auth/password', { method: 'PATCH', body: JSON.stringify({ password }) }); return { error: null } } catch (err) { return { error: err instanceof Error ? err.message : 'Unable to update your password.' } } },
    async updateEmail(email) { try { const { user: account } = await request<{ user: AppUser }>('/api/auth/email', { method: 'PATCH', body: JSON.stringify({ email }) }); const next = toState(account); setSession(next.session); setProfile(next.profile); return { error: null } } catch (err) { return { error: err instanceof Error ? err.message : 'Unable to update your email.' } } },
    async updateProfile(fullName) { try { const { user: account } = await request<{ user: AppUser }>('/api/auth/profile', { method: 'PATCH', body: JSON.stringify({ fullName }) }); const next = toState(account); setSession(next.session); setProfile(next.profile); return { error: null } } catch (err) { return { error: err instanceof Error ? err.message : 'Unable to update your profile.' } } },
    async signOut() { ++authRevision.current; await fetch(apiUrl('/api/auth/signout'), { method: 'POST', credentials: 'include' }); ++authRevision.current; setLoading(false); setSession(null); setProfile(null); setError(null) }, refreshProfile,
  }), [error, loading, profile, refreshProfile, session])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used within AuthProvider'); return context }
