import { useEffect, useState, type FormEvent } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Plus, Trash2, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Field } from '@/components/ui/Field'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/auth'
import { officialCourses } from '@/lib/courses'
import {
  getAllCohorts,
  saveCohort as persistCohort,
  deleteCohort as removePersistedCohort,
  type Cohort,
} from '@/lib/cohorts'

interface Course { id: string; name: string }

export function CohortsPage() {
  const { role } = useAuth()
  const canManage = role === 'admin' || role === 'manager'
  const [courses, setCourses] = useState<Course[]>([])
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [enrollments, setEnrollments] = useState<{ cohort_id: string; completion_status: string }[]>([])
  const [open, setOpen] = useState(false)
  const [cohortToDelete, setCohortToDelete] = useState<Cohort | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [courseId, setCourseId] = useState('')
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const [courseResult, cohortList, enrollmentResult] = await Promise.all([
        supabase.from('courses').select('id, name').order('name'),
        getAllCohorts(),
        supabase.from('enrollments').select('cohort_id,completion_status'),
      ])

      const loadedCourses = officialCourses((courseResult.data ?? []) as Course[])
      setCourses(loadedCourses)
      setCohorts(cohortList)
      setEnrollments((enrollmentResult.data ?? []) as { cohort_id: string; completion_status: string }[])
    } catch (err: any) {
      setError(err?.message || 'Error loading cohorts')
    }
  }

  useEffect(() => {
    load()
    const handleUpdate = () => load()
    window.addEventListener('cohorts-updated', handleUpdate)
    return () => window.removeEventListener('cohorts-updated', handleUpdate)
  }, [])

  const course = (c: Cohort) => c.course_name || courses.find((x) => x.id === c.course_id)?.name || 'Course'
  const close = () => {
    setOpen(false)
    setName('')
    setCourseId('')
    setStartsOn('')
    setEndsOn('')
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    if (!courseId) {
      setError('Please choose a course.')
      setSaving(false)
      return
    }

    const { error: saveErr } = await persistCohort({
      name: name.trim(),
      course_id: courseId,
      starts_on: startsOn || null,
      ends_on: endsOn || null,
    })

    setSaving(false)

    if (saveErr) {
      setError(saveErr)
    } else {
      setSuccessMessage(`Cohort "${name.trim()}" created successfully.`)
      setTimeout(() => setSuccessMessage(null), 4000)
      close()
      load()
    }
  }

  const handleConfirmRemove = async () => {
    if (!cohortToDelete) return
    setDeleting(true)
    setError(null)

    const target = cohortToDelete
    const { error: deleteErr } = await removePersistedCohort(target.id, target.name)
    setDeleting(false)

    if (deleteErr) {
      setError(`Could not remove cohort: ${deleteErr}`)
    } else {
      setCohorts((current) => current.filter((c) => c.id !== target.id))
      setSuccessMessage(`Cohort "${target.name}" was removed successfully.`)
      setTimeout(() => setSuccessMessage(null), 4000)
      setCohortToDelete(null)
      load()
    }
  }

  return (
    <div>
      <PageHeader
        title="Cohorts"
        subtitle="View and manage accessible cohorts across all programs."
        actions={
          canManage ? (
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-600)] transition-colors cursor-pointer"
            >
              <Plus size={16} /> Add cohort
            </button>
          ) : undefined
        }
      />

      {successMessage && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-[var(--color-danger-100)] border border-[var(--color-danger-300)] p-3 text-sm text-[var(--color-danger-700)]">
          <AlertCircle className="h-4 w-4 text-[var(--color-danger-600)] shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cohorts.length ? (
          cohorts.map((c) => {
            const rows = enrollments.filter((e) => e.cohort_id === c.id)
            const completed = rows.filter((e) => e.completion_status === 'completed').length
            const active = !(c.ends_on && new Date(c.ends_on) < new Date())
            return (
              <Card key={c.id} className="p-5 hover:border-[var(--color-harbor-400)] transition-colors flex flex-col justify-between">
                <div>
                  <Link to={`/cohorts/${c.id}`} className="block group">
                    <p className="font-display text-lg font-semibold text-[var(--color-ink-900)] group-hover:text-[var(--color-harbor-600)] transition-colors">
                      {c.name}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-ink-600)]">{course(c)}</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-[var(--color-ink-400)]">Dates</p>
                        <p className="font-medium text-xs text-[var(--color-ink-700)]">
                          {c.starts_on ?? 'Not set'} – {c.ends_on ?? 'Not set'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--color-ink-400)]">Status</p>
                        <p
                          className={`text-xs font-semibold ${
                            active ? 'text-[var(--color-success-600)]' : 'text-[var(--color-ink-500)]'
                          }`}
                        >
                          {active ? 'Active' : 'Completed'}
                        </p>
                      </div>
                      <div className="col-span-2 flex items-center gap-2 text-xs text-[var(--color-ink-600)]">
                        <Users size={14} />
                        {rows.length} current student{rows.length === 1 ? '' : 's'} · {completed} completed
                      </div>
                    </div>
                  </Link>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--color-line)] flex items-center justify-between">
                  <Link
                    to={`/cohorts/${c.id}`}
                    className="text-xs font-semibold text-[var(--color-harbor-600)] hover:underline"
                  >
                    Open cohort →
                  </Link>
                  {canManage && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        setCohortToDelete(c)
                      }}
                      className="inline-flex items-center gap-1 text-xs text-[var(--color-danger-600)] hover:text-[var(--color-danger-700)] hover:bg-[var(--color-danger-50)] px-2 py-1 rounded transition-colors cursor-pointer"
                      title={`Remove ${c.name}`}
                    >
                      <Trash2 size={13} />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </Card>
            )
          })
        ) : (
          <Card className="p-8 text-center text-sm text-[var(--color-ink-400)] col-span-full">
            No cohorts found.
          </Card>
        )}
      </div>

      {/* Confirmation Modal for Removing Cohort */}
      {cohortToDelete && (
        <Modal title="Remove Cohort" onClose={() => !deleting && setCohortToDelete(null)}>
          <div className="space-y-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900 space-y-2">
              <p className="font-semibold text-base">
                Are you sure you want to remove &quot;{cohortToDelete.name}&quot;?
              </p>
              <p className="text-xs text-red-700 leading-relaxed">
                This will unenroll any active students from this cohort and remove associated schedules and attendance records. This action cannot be undone.
              </p>
              {(() => {
                const count = enrollments.filter((e) => e.cohort_id === cohortToDelete.id).length
                return count > 0 ? (
                  <p className="text-xs font-medium text-red-800">
                    ⚠️ {count} student{count === 1 ? ' is' : 's are'} currently enrolled in this cohort.
                  </p>
                ) : null
              })()}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setCohortToDelete(null)}
                className="px-3.5 py-2 rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm font-medium text-[var(--color-ink-700)] hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmRemove}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-danger-600)] text-white text-sm font-semibold hover:bg-[var(--color-danger-700)] transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Removing…</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>Yes, Remove Cohort</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {open && (
        <Modal title="Add cohort" onClose={close}>
          <form onSubmit={save} className="space-y-3">
            <Field label="Course">
              <select
                required
                className="input"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
              >
                <option value="">Choose a course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cohort name">
              <input
                required
                className="input"
                placeholder="e.g. Cohort 2026A"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date">
                <input
                  type="date"
                  className="input"
                  value={startsOn}
                  onChange={(e) => setStartsOn(e.target.value)}
                />
              </Field>
              <Field label="End date">
                <input
                  type="date"
                  className="input"
                  value={endsOn}
                  onChange={(e) => setEndsOn(e.target.value)}
                />
              </Field>
            </div>
            <button
              disabled={saving}
              className="w-full rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-600)] disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving…' : 'Create cohort'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
