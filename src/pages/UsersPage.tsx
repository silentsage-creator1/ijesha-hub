import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card } from '@/components/ui/primitives'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

type Status = NonNullable<Profile['approval_status']>
const ROLES = ['admin', 'manager', 'trainer', 'student', 'parent', 'sponsor'] as const

export function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    const { data, error: loadError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (loadError) setError(loadError.message)
    else setUsers((data ?? []) as Profile[])
  }

  useEffect(() => { load() }, [])

  async function setStatus(id: string, status: Exclude<Status, 'pending'>) {
    setBusy(id)
    setError(null)
    const { error: actionError } = await supabase.rpc('set_approval', { target: id, status })
    if (actionError) {
      const { error: fallbackError } = await supabase.from('profiles').update({ approval_status: status }).eq('id', id)
      if (fallbackError) setError(actionError.message || fallbackError.message)
    }
    const targetUser = users.find((u) => u.id === id)
    if (status === 'approved' && targetUser?.role === 'student') {
      supabase.from('students').insert({
        profile_id: targetUser.id,
        full_name: targetUser.full_name,
        track: 'Frontend Development',
        status: 'active',
      }).then(() => {})
    }
    setBusy(null)
    setUsers((current) => current.map((user) => user.id === id ? { ...user, approval_status: status } : user))
  }

  async function approveAll(role: 'student' | 'trainer') {
    setBusy(`all-${role}`)
    setError(null)
    const pending = users.filter((user) => user.role === role && user.approval_status === 'pending')
    const results = await Promise.all(pending.map((user) => supabase.rpc('set_approval', { target: user.id, status: 'approved' })))
    setBusy(null)
    const failure = results.find((result) => result.error)?.error
    if (failure) setError(failure.message)
    else await load()
  }

  async function changeRole(id: string, role: Profile['role']) {
    setBusy(id)
    setError(null)
    const { error: updateError } = await supabase.from('profiles').update({ role }).eq('id', id)
    setBusy(null)
    if (updateError) setError(updateError.message)
    else setUsers((current) => current.map((user) => user.id === id ? { ...user, role } : user))
  }

  return <div>
    <PageHeader title="Users and approvals" subtitle="Review accounts, approval status, and assigned roles." actions={<div className="flex gap-2"><button onClick={() => approveAll('student')} disabled={busy !== null} className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm font-medium text-[var(--color-ink-700)] disabled:opacity-50">Accept all students</button><button onClick={() => approveAll('trainer')} disabled={busy !== null} className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm font-medium text-[var(--color-ink-700)] disabled:opacity-50">Accept all tutors</button></div>} />
    {error && <Card className="mb-4 border-[var(--color-danger-100)] p-3 text-sm text-[var(--color-danger-600)]">{error}</Card>}
    <Card className="overflow-x-auto p-5"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-[var(--color-line)] text-xs text-[var(--color-ink-400)]"><tr><th className="pb-3">Name</th><th className="pb-3">Role</th><th className="pb-3">Status</th><th className="pb-3">Requested</th><th className="pb-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[var(--color-line)]">{users.map((user) => <tr key={user.id}><td className="py-3 font-medium text-[var(--color-ink-900)]">{user.full_name}</td><td className="py-3"><select aria-label={`Role for ${user.full_name}`} value={user.role} disabled={busy !== null} onChange={(event) => changeRole(user.id, event.target.value as Profile['role'])} className="rounded-md border border-[var(--color-line)] bg-white px-2 py-1 text-sm capitalize disabled:opacity-50">{ROLES.map((role) => <option key={role} value={role}>{role}</option>)}</select></td><td className="py-3 capitalize">{user.approval_status ?? 'approved'}</td><td className="py-3">{new Date(user.created_at).toLocaleDateString()}</td><td className="py-3"><div className="flex justify-end gap-2">{user.approval_status === 'pending' && <button onClick={() => setStatus(user.id, 'approved')} disabled={busy !== null} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-success-600)]"><Check size={14} />Approve</button>}<button onClick={() => setStatus(user.id, 'rejected')} disabled={busy !== null} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-danger-600)]"><X size={14} />Reject</button></div></td></tr>)}</tbody></table>{users.length === 0 && <p className="py-6 text-center text-sm text-[var(--color-ink-400)]">No user accounts found.</p>}</Card>
  </div>
}
