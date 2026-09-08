import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, Badge, Avatar } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Field } from '@/components/ui/Field'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/auth'
import type { Teacher } from '@/types'

interface FormState {
  full_name: string
  email: string
  specialty: string
  status: Teacher['status']
}

const EMPTY_FORM: FormState = { full_name: '', email: '', specialty: '', status: 'active' }

export function TeachersPage() {
  const { role } = useAuth()
  const canManage = role === 'admin' || role === 'manager'

  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setLoadError(null)
    const [tRes, pRes] = await Promise.all([
      supabase.from('teachers').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('role', 'trainer').order('created_at', { ascending: false }),
    ])
    if (tRes.error) {
      setLoadError(tRes.error.message)
    } else {
      const tData = (tRes.data ?? []) as Teacher[]
      const pData = (pRes.data ?? []) as any[]
      const existingProfileIds = new Set(tData.map((t) => t.profile_id).filter(Boolean))
      const existingEmails = new Set(tData.map((t) => t.email?.toLowerCase()).filter(Boolean))
      const extraTeachers: Teacher[] = []
      for (const prof of pData) {
        if (!existingProfileIds.has(prof.id) && (!prof.email || !existingEmails.has(prof.email.toLowerCase()))) {
          extraTeachers.push({
            id: prof.id,
            profile_id: prof.id,
            full_name: prof.full_name,
            email: prof.email ?? null,
            specialty: prof.department || 'Instructor',
            status: 'active',
            organization: prof.organization ?? null,
            created_by: null,
            created_at: prof.created_at,
            updated_at: prof.created_at,
          })
        }
      }
      setTeachers([...tData, ...extraTeachers])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(t: Teacher) {
    setEditing(t)
    setForm({ full_name: t.full_name, email: t.email ?? '', specialty: t.specialty ?? '', status: t.status })
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)

    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      specialty: form.specialty.trim() || null,
      status: form.status,
    }

    const result = editing
      ? await supabase.from('teachers').update(payload).eq('id', editing.id)
      : await supabase.from('teachers').insert(payload)

    setSaving(false)
    if (result.error) {
      setFormError(result.error.message)
      return
    }
    setModalOpen(false)
    load()
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const { error } = await supabase.from('teachers').delete().eq('id', id)
    setDeletingId(null)
    if (error) {
      setLoadError(error.message)
      return
    }
    setTeachers((prev) => prev.filter((t) => t.id !== id))
  }

  const filtered = teachers.filter((t) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return t.full_name.toLowerCase().includes(q) || (t.specialty ?? '').toLowerCase().includes(q) || (t.email ?? '').toLowerCase().includes(q)
  })

  if (!canManage) {
    return (
      <div>
        <PageHeader title="Trainers" subtitle="Directory of trainers." />
        <Card className="px-5 py-8 text-center text-sm text-[var(--color-ink-400)]">
          You don't have access to trainer management. Contact an administrator if you need this.
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Trainers"
        subtitle="Manage the trainer roster."
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-harbor-600)]"
          >
            <Plus size={16} />
            Add trainer
          </button>
        }
      />

      <div className="mb-4 relative max-w-xs">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search trainers…" className="input pl-9" />
      </div>

      {loadError && <p className="mb-4 rounded-md bg-[var(--color-danger-100)] px-3 py-2 text-sm text-[var(--color-danger-600)]">{loadError}</p>}

      <Card className="overflow-hidden">
        {loading ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-ink-400)]">Loading trainers…</p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-ink-400)]">
            {teachers.length === 0 ? 'No trainers yet.' : 'No trainers match your search.'}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)]">
            {filtered.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3.5">
                <Avatar initials={initialsFor(t.full_name)} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--color-ink-900)]">{t.full_name}</p>
                  <p className="truncate text-xs text-[var(--color-ink-400)]">{t.specialty || t.email || '—'}</p>
                </div>
                <Badge tone={t.status === 'active' ? 'success' : 'neutral'}>{t.status}</Badge>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(t)}
                    aria-label={`Edit ${t.full_name}`}
                    className="rounded-md p-1.5 text-[var(--color-ink-400)] hover:bg-[var(--color-ink-50)] hover:text-[var(--color-ink-700)]"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={deletingId === t.id}
                    aria-label={`Remove ${t.full_name}`}
                    className="rounded-md p-1.5 text-[var(--color-ink-400)] hover:bg-[var(--color-danger-100)] hover:text-[var(--color-danger-600)] disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {modalOpen && (
        <Modal title={editing ? 'Edit trainer' : 'Add trainer'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <Field label="Full name">
              <input
                required
                className="input"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </Field>
            <Field label="Email" hint="Optional — used to link a login account later.">
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </Field>
            <Field label="Specialty">
              <input
                className="input"
                placeholder="e.g. Frontend Development"
                value={form.specialty}
                onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
              />
            </Field>
            <Field label="Status">
              <select
                className="input"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Teacher['status'] }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>

            {formError && <p className="rounded-md bg-[var(--color-danger-100)] px-3 py-2 text-sm text-[var(--color-danger-600)]">{formError}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-[var(--radius-md)] px-3.5 py-2 text-sm font-medium text-[var(--color-ink-600)] hover:bg-[var(--color-ink-50)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-harbor-600)] disabled:opacity-60"
              >
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add trainer'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'T'
}
