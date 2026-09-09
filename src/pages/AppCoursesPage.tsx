import { useEffect, useState, type FormEvent } from 'react'
import { Plus, BookOpen, Users } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Badge, Card } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { apiUrl, useAuth } from '@/app/auth'
import { useNavigate } from 'react-router-dom'

type Course = { id: string; title: string; description: string; level: string | null; status: 'Draft' | 'Published'; cohort_id: string | null; trainer_id: string | null }
type Trainer = { id: string; full_name: string; email: string }
type Cohort = { id: string; name: string }

export function AppCoursesPage() {
  const { role } = useAuth()
  const navigate = useNavigate()
  const canManage = role === 'admin' || role === 'manager'
  const [courses, setCourses] = useState<Course[]>([])
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function deleteCourse() {
    if (!deleteTarget || deleting || !canManage) return
    setDeleting(true)
    setDeleteError('')
    try {
      const response = await fetch(apiUrl(`/api/courses/${deleteTarget.id}`), { method: 'DELETE', credentials: 'include' })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Unable to delete course. Please try again.')
      }
      setCourses(current => current.filter(course => course.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Unable to delete course.')
    } finally { setDeleting(false) }
  }
  const [form, setForm] = useState({ title: '', description: '', level: '', trainerId: '', cohortId: '' })

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const courseResponse = await fetch(apiUrl('/api/courses'), { credentials: 'include' })
      const coursePayload = await courseResponse.json() as { courses?: Course[]; error?: string }
      if (!courseResponse.ok) throw new Error(coursePayload.error || 'Unable to load courses.')
      setCourses(coursePayload.courses ?? [])
      if (canManage) {
        const [accountResponse, cohortResponse] = await Promise.all([
          fetch(apiUrl('/api/admin/accounts'), { credentials: 'include' }),
          fetch(apiUrl('/api/learning/cohorts'), { credentials: 'include' }),
        ])
        const accounts = await accountResponse.json() as { users?: Array<Trainer & { role: string }> }
        const cohortPayload = await cohortResponse.json() as { cohorts?: Cohort[] }
        if (accountResponse.ok) setTrainers((accounts.users ?? []).filter((user) => user.role === 'trainer'))
        if (cohortResponse.ok) setCohorts(cohortPayload.cohorts ?? [])
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load courses.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [canManage])

  async function createCourse(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(apiUrl('/api/courses'), {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: form.title, description: form.description, level: form.level || null, trainerId: form.trainerId || null, cohortId: form.cohortId || null }),
      })
      const payload = await response.json() as { course?: Course; error?: string }
      if (!response.ok || !payload.course) throw new Error(payload.error || 'Unable to create course.')
      setCourses((current) => [payload.course!, ...current])
      setForm({ title: '', description: '', level: '', trainerId: '', cohortId: '' })
      setOpen(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to create course.')
    } finally { setSaving(false) }
  }

  return <div className="space-y-6">
    {deleteTarget && <Modal title="Delete course" onClose={() => { if (!deleting) setDeleteTarget(null) }}>
      <p className="text-sm">Delete “{deleteTarget.title}”? This removes the course permanently. Linked cohorts remain, but lose their course association.</p>
      {deleteError && <p role="alert" className="mt-3 text-sm text-[var(--color-danger-600)]">{deleteError}</p>}
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" disabled={deleting} onClick={() => setDeleteTarget(null)} className="rounded-lg border border-[var(--color-line)] px-4 py-2">Cancel</button>
        <button type="button" disabled={deleting} onClick={() => void deleteCourse()} className="rounded-lg bg-[var(--color-danger-600)] px-4 py-2 text-white disabled:opacity-50">{deleting ? 'Deleting…' : 'Delete course'}</button>
      </div>
    </Modal>}
    <PageHeader title="Courses" subtitle="Courses are available only after an administrator creates and assigns them." actions={canManage ? <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-harbor-600)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-harbor-700)]"><Plus size={16} /> Add Course</button> : undefined} />
    {error && <p className="rounded-lg border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] p-3 text-sm text-[var(--color-danger-700)]">{error}</p>}
    {loading ? <Card className="p-6 text-sm text-[var(--color-ink-500)]">Loading courses…</Card> : courses.length === 0 ? <Card className="p-8 text-center"><BookOpen className="mx-auto mb-3 text-[var(--color-ink-400)]" size={30} /><p className="font-semibold text-[var(--color-ink-900)]">No courses yet</p><p className="mt-1 text-sm text-[var(--color-ink-500)]">Courses will appear here when they are created and assigned.</p></Card> : <div className="grid gap-4 md:grid-cols-2">{courses.map((course) => <div key={course.id} className="relative"><button type="button" onClick={() => navigate(`/courses/${course.id}`)} className="w-full text-left"><Card className="h-full p-5 transition-shadow hover:shadow-[var(--shadow-pop)]"><div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-lg font-bold text-[var(--color-ink-900)]">{course.title}</h2><p className="mt-1 text-sm text-[var(--color-ink-600)]">{course.description || 'No description provided.'}</p></div><Badge tone={course.status === 'Published' ? 'success' : 'neutral'}>{course.status}</Badge></div><div className="mt-4 flex gap-4 text-xs text-[var(--color-ink-500)]"><span>{course.level || 'Level not set'}</span><span className="inline-flex items-center gap-1"><Users size={13} /> {course.cohort_id ? 'Cohort assigned' : 'No cohort assigned'}</span></div></Card></button>{canManage && <button type="button" aria-label={`Delete ${course.title}`} onClick={() => { setDeleteError(''); setDeleteTarget(course) }} className="mt-2 rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm font-semibold text-[var(--color-danger-600)]">Delete course</button>}</div>)}</div>}
    {open && <Modal title="Add Course" onClose={() => setOpen(false)}><form onSubmit={createCourse} className="space-y-4"><label className="block text-sm font-medium">Course title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--color-line)] p-2" /></label><label className="block text-sm font-medium">Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--color-line)] p-2" /></label><label className="block text-sm font-medium">Level (optional)<input value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--color-line)] p-2" /></label><label className="block text-sm font-medium">Trainer (optional)<select value={form.trainerId} onChange={(event) => setForm({ ...form, trainerId: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--color-line)] p-2"><option value="">No trainer assigned</option>{trainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.full_name || trainer.email}</option>)}</select></label><label className="block text-sm font-medium">Cohort (optional)<select value={form.cohortId} onChange={(event) => setForm({ ...form, cohortId: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--color-line)] p-2"><option value="">No cohort assigned</option>{cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select></label><button disabled={saving} className="rounded-lg bg-[var(--color-harbor-600)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Create Course'}</button></form></Modal>}
  </div>
}
