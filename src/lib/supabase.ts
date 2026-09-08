import { createClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const url = typeof rawUrl === 'string' ? rawUrl.trim() : ''
const anonKey = typeof rawAnonKey === 'string' ? rawAnonKey.trim() : ''

export const supabaseConfigured = Boolean(
  url && anonKey && url !== 'undefined' && anonKey !== 'undefined'
)

if (!supabaseConfigured) {
  // Don't throw — let the app render a clear "not configured" screen instead
  // of a blank crash, since this file loads before any UI exists.
  console.warn(
    'Supabase is not configured. Copy .env.example to .env and fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.',
  )
}

export const supabase = createClient(
  supabaseConfigured ? url : 'https://placeholder.supabase.co',
  supabaseConfigured ? anonKey : 'placeholder-anon-key'
)

export function notifyIfRlsRecursionError(err: unknown) {
  if (!err) return
  const msg = typeof err === 'object' && err !== null && 'message' in err ? String((err as any).message) : String(err)
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as any).code) : ''
  if (code === '42P17' || msg.toLowerCase().includes('infinite recursion')) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('supabase_rls_recursion_error', {
          detail: { message: msg, code },
        })
      )
    }
  }
}
