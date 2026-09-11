import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Badge, Card } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { apiUrl, useAuth } from '@/app/auth'

type Course = { id: string; title: string; description: string; level: string | null; status: 'Draft' | 'Published'; content?: unknown[]; cohort_id: string | null; trainer_id: string | null }

export function AppCourseDetailPage() {
  const { id } = useParams()
  const { role } = useAuth()
  const canManage = role === 'admin' || role === 'manager'
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ title: '', description: '', status: 'Draft', level: '', trainerId: '', cohortId: '' })
  const [trainers, setTrainers] = useState<Array<{id:string;full_name:string}>>([])
  const [cohorts, setCohorts] = useState<Array<{id:string;name:string;app_course_id?:string|null}>>([])
  useEffect(() => {
    if (!canManage) return
    let cancelled = false
    Promise.all(['/api/admin/accounts','/api/cohorts'].map(async path => {
      const response = await fetch(apiUrl(path), {credentials:'include'})
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to load assignment options.')
      return payload
    })).then(([accounts, workspace]) => {
      if (cancelled) return
      setTrainers(accounts.users.filter((a: {role:string;approval_status:string;is_active?:boolean}) => a.role === 'trainer' && a.approval_status === 'approved' && a.is_active !== false))
      setCohorts(workspace.cohorts)
    }).catch(err => { if (!cancelled) setSaveError(err.message) })
    return () => { cancelled = true }
  }, [canManage])
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!course || !canManage || saving) return
    if (!form.title.trim()) { setSaveError('Enter a course name.'); return }
    setSaving(true); setSaveError('')
    try {
      const response = await fetch(apiUrl('/api/courses/' + encodeURIComponent(course.id)), { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
      const payload = await response.json()
      if (!response.ok || !payload.course) throw new Error(payload.error || 'Unable to update course.')
      setCourse(payload.course); setEditing(false); setMessage('Course updated successfully.')
      window.dispatchEvent(new Event('courses-updated'))
    } catch (err) { setSaveError(err instanceof Error ? err.message : 'Unable to update course.') }
    finally { setSaving(false) }
  }
  const [course, setCourse] = useState<Course | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { void (async () => { try { const response = await fetch(apiUrl('/api/courses'), { credentials: 'include' }); const payload = await response.json() as { courses?: Course[]; error?: string }; if (!response.ok) throw new Error(payload.error || 'Unable to load course.'); const found = (payload.courses ?? []).find((item) => item.id === id); if (!found) throw new Error('Course not found or you no longer have access to it.'); setCourse(found) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Unable to load course.') } })() }, [id])
  if (error) return <p className="text-sm text-[var(--color-danger-700)]">{error}</p>
  if (!course) return <Card className="p-6 text-sm text-[var(--color-ink-500)]">Loading course…</Card>
  const modules = Array.isArray(course.content) ? course.content : []
  return <div className="space-y-6"><Link to="/courses" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-harbor-700)]"><ArrowLeft size={16} /> Back to courses</Link><PageHeader title={course.title} subtitle={course.description || 'No course description provided.'} actions={canManage ? <button type="button" onClick={() => { setForm({ title: course.title, description: course.description ?? '', status: course.status, level: course.level ?? '', trainerId: course.trainer_id ?? '', cohortId: course.cohort_id ?? '' }); setSaveError(''); setMessage(''); setEditing(true) }} className="rounded-lg bg-[var(--color-harbor-600)] px-4 py-2 text-sm font-semibold text-white">Edit Course</button> : undefined} />
    {message && <p role="status">{message}</p>}
    {editing && canManage && <Modal title="Edit Course" onClose={() => { if (!saving) setEditing(false) }}><form onSubmit={save} className="space-y-4">
      <label className="block text-sm font-medium">Course name<input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--color-line)] p-2" /></label>
      <label className="block text-sm font-medium">Description<textarea rows={4} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--color-line)] p-2" /></label>
      <label className="block text-sm font-medium">Level (optional)<input className="input" value={form.level} onChange={e=>setForm({...form,level:e.target.value})}/></label>
      <label className="block text-sm font-medium">Trainer (optional)<select className="input" value={form.trainerId} onChange={e=>setForm({...form,trainerId:e.target.value})}><option value="">No trainer assigned</option>{form.trainerId&&!trainers.some(t=>t.id===form.trainerId)&&<option value={form.trainerId}>Current trainer (unavailable)</option>}{trainers.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select></label>
      <label className="block text-sm font-medium">Cohort (optional)<select className="input" value={form.cohortId} onChange={e=>setForm({...form,cohortId:e.target.value})}><option value="">No cohort assigned</option>{cohorts.filter(c=>c.app_course_id===course.id||c.id===course.cohort_id).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="block text-sm font-medium">Status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--color-line)] p-2"><option>Draft</option><option>Published</option></select></label>
      {saveError && <p role="alert" className="text-sm text-[var(--color-danger-700)]">{saveError}</p>}
      <div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={() => setEditing(false)} className="rounded-lg border border-[var(--color-line)] px-4 py-2">Cancel</button><button disabled={saving} className="rounded-lg bg-[var(--color-harbor-600)] px-4 py-2 text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save Changes'}</button></div>
    </form></Modal>}<Card className="p-5"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm text-[var(--color-ink-600)]"><BookOpen size={17} /> {course.level || 'Level not set'} · {course.cohort_id ? 'Cohort assigned' : 'No cohort assigned'}</div><Badge tone={course.status === 'Published' ? 'success' : 'neutral'}>{course.status}</Badge></div></Card><Card className="p-5"><h2 className="font-display font-bold text-[var(--color-ink-900)]">Course content</h2>{modules.length ? <ol className="mt-4 space-y-2">{modules.map((module, index) => <li key={index} className="rounded-lg border border-[var(--color-line)] p-3 text-sm text-[var(--color-ink-700)]">{typeof module === 'object' && module && 'title' in module ? String(module.title) : `Module ${index + 1}`}</li>)}</ol> : <p className="mt-2 text-sm text-[var(--color-ink-500)]">No learning content has been added yet.</p>}</Card></div>
}
