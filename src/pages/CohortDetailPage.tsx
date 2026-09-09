import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, CalendarDays, ClipboardCheck, Loader2, Trash2, Users } from 'lucide-react'
import { Badge, Card, ProgressRing, SectionHeading } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/app/auth'
import { cohortRequest, deleteCohort, getAllCohorts, type Cohort } from '@/lib/cohorts'
import { safeText, searchText } from '@/lib/text'
import { cohortStudentStatus, isPastStudentStatus as isPast, studentStatusLabel as labelStatus } from '@/lib/cohortStudentStatus'

type Student = { id: string; full_name: string; status: string; track: string | null }
type Enrollment = { id: string; student_id: string; completion_status: string; students: Student | null }
type Progress = { student_id: string; progress_percent: number }
type Attendance = { student_id: string; status: string }
type Tab = 'overview' | 'students' | 'past' | 'sessions' | 'attendance' | 'assignments' | 'assessments' | 'progress' | 'reports'

const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'students', label: 'Students' },
  { id: 'past', label: 'Past Students' },
  { id: 'sessions', label: 'Training Sessions' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'assessments', label: 'Assessments' },
  { id: 'progress', label: 'Progress' },
  { id: 'reports', label: 'Reports' },
]


export function CohortDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { role } = useAuth()
  const canManage = role === 'admin' || role === 'manager'
  const [tab, setTab] = useState<Tab>('overview')
  const [cohort, setCohort] = useState<Cohort | null>(null)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [progress, setProgress] = useState<Progress[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancel = false
    async function load() {
      try {
        setError(null)
        const [allCohorts, workspace] = await Promise.all([
          getAllCohorts(),
          cohortRequest<{enrollments:Enrollment[];attendance:Attendance[];progress:Progress[]}>('/api/cohorts/'+id+'/students'),
        ])
        if(cancel)return
        setCohort(allCohorts.find(c=>c.id===id)??null)
        setEnrollments(workspace.enrollments)
        setAttendance(workspace.attendance)
        setProgress(workspace.progress)
      } catch (err: any) {
        if (!cancel) setError(err?.message || 'Failed to load cohort details')
      }
    }

    load()
    return () => {
      cancel = true
    }
  }, [id])

  // Classify historical students by this enrollment, not their current course status.
  const allStudents = useMemo(() => {
    const map = new Map<string, Student>()
    for (const e of enrollments) {
      if (e.students) map.set(e.students.id, {...e.students,full_name:safeText(e.students.full_name)||'Unnamed student',status:cohortStudentStatus(e.students.status,e.completion_status)})
    }

    return Array.from(map.values())
  }, [enrollments])

  const current = allStudents.filter((s) => !isPast(s.status))
  const past = allStudents.filter((s) => isPast(s.status))
  const pct = (sid: string) => progress.filter((p) => p.student_id === sid).at(-1)?.progress_percent ?? 0
  const attendancePct = (sid: string) => {
    const rows = attendance.filter((a) => a.student_id === sid)
    return rows.length ? Math.round((rows.filter((a) => a.status === 'present' || a.status === 'late').length / rows.length) * 100) : 0
  }
  const average = allStudents.length ? Math.round(allStudents.reduce((sum, s) => sum + pct(s.id), 0) / allStudents.length) : 0

  const shown = useMemo(() => {
    const source = tab === 'past' ? past : current
    return source.filter((s) => {
      const text = !query || searchText(s.full_name).includes(searchText(query))
      const normalized = searchText(labelStatus(s.status))
      return text && (filter === 'all' || normalized === filter)
    })
  }, [tab, past, current, query, filter])

  if (!cohort) {
    return <Card className="p-6 text-sm text-[var(--color-ink-500)]">{error ?? 'Loading cohort…'}</Card>
  }

  const course = cohort.course_name || 'Course'
  const stat = (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Mini label="Current students" value={String(current.length)} icon={Users} />
      <Mini label="Past students" value={String(past.length)} icon={Users} />
      <Mini label="Attendance" value={`${allStudents.length ? Math.round(allStudents.reduce((s, x) => s + attendancePct(x.id), 0) / allStudents.length) : 0}%`} icon={ClipboardCheck} />
      <Mini label="Average progress" value={`${average}%`} icon={BookOpen} />
    </div>
  )

  const handleDeleteCohort = async () => {
    if (!cohort) return
    setDeleting(true)
    const { error: err } = await deleteCohort(cohort.id, cohort.name)
    setDeleting(false)
    if (err) {
      setError(`Could not remove cohort: ${err}`)
      setShowDeleteModal(false)
    } else {
      navigate('/cohorts')
    }
  }

  return (
    <div>
      <Link to="/cohorts" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]">
        <ArrowLeft size={15} /> Back to cohorts
      </Link>
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-harbor-600)]">{course}</p>
            <h1 className="mt-1 font-display text-2xl font-semibold">{cohort.name}</h1>
            <p className="mt-2 flex flex-wrap gap-4 text-sm text-[var(--color-ink-500)]">
              <span className="flex items-center gap-1">
                <CalendarDays size={15} /> Start: {date(cohort.starts_on)}
              </span>
              <span>End: {date(cohort.ends_on)}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={cohort.ends_on && new Date(cohort.ends_on) < new Date() ? 'neutral' : 'success'}>
              {cohort.ends_on && new Date(cohort.ends_on) < new Date() ? 'Completed' : 'Active'}
            </Badge>
            {canManage && (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-danger-600)] hover:text-[var(--color-danger-700)] hover:bg-[var(--color-danger-50)] border border-[var(--color-danger-200)] px-2.5 py-1.5 rounded-[var(--radius-md)] transition-colors cursor-pointer"
                title="Remove this cohort"
              >
                <Trash2 size={14} />
                <span>Remove Cohort</span>
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Confirmation Modal for Deleting Cohort */}
      {showDeleteModal && (
        <Modal title="Remove Cohort" onClose={() => !deleting && setShowDeleteModal(false)}>
          <div className="space-y-4">
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900 space-y-2">
              <p className="font-semibold text-base">
                Are you sure you want to remove &quot;{cohort.name}&quot;?
              </p>
              <p className="text-xs text-red-700 leading-relaxed">
                This will unenroll all active students from this cohort and remove associated schedules, attendance logs, and sessions. This action cannot be undone.
              </p>
              {allStudents.length > 0 && (
                <p className="text-xs font-medium text-red-800">
                  ⚠️ {allStudents.length} student{allStudents.length === 1 ? ' is' : 's are'} associated with this cohort.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
                className="px-3.5 py-2 rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm font-medium text-[var(--color-ink-700)] hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteCohort}
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
      <div className="mt-5 overflow-x-auto border-b border-[var(--color-line)]">
        <div className="flex min-w-max gap-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setTab(item.id)
                setQuery('')
                setFilter('all')
              }}
              className={`border-b-2 px-3 py-2 text-sm font-medium ${
                tab === item.id ? 'border-[var(--color-harbor-500)] text-[var(--color-harbor-600)]' : 'border-transparent text-[var(--color-ink-500)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5">
        {tab === 'overview' && (
          <>
            <SectionHeading eyebrow="Cohort overview" title="Training performance" />
            {stat}
            <Card className="mt-5 p-5">
              <SectionHeading title="Completion summary" />
              <p className="text-sm text-[var(--color-ink-600)]">
                {past.filter((s) => labelStatus(s.status) === 'Completed').length} completed, {past.filter((s) => labelStatus(s.status) === 'Inactive').length} inactive and{' '}
                {past.filter((s) => s.status === 'withdrawn').length} withdrawn students remain available in Past Students.
              </p>
            </Card>
          </>
        )}
        {(tab === 'students' || tab === 'past') && (
          <>
            <SectionHeading eyebrow={tab === 'past' ? 'Historical learners' : 'Current learners'} title={tab === 'past' ? 'Past Students' : 'Students'} />
            <div className="mb-4 flex flex-wrap gap-3">
              <input className="input max-w-xs" placeholder="Search students" value={query} onChange={(e) => setQuery(e.target.value)} />
              <select className="input max-w-xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">All statuses</option>
                {tab === 'past' ? (
                  <>
                    <option value="completed">Completed</option>
                    <option value="withdrawn">Withdrawn</option>
                    <option value="inactive">Inactive</option>
                  </>
                ) : (
                  <>
                    <option value="active">Active</option>
                    <option value="at risk">At Risk</option>
                  </>
                )}
              </select>
            </div>
            <Card className="overflow-hidden">
              <ul className="divide-y divide-[var(--color-line)]">
                {shown.length ? (
                  shown.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 p-4">
                      <Link to={`/students/${s.id}`} className="min-w-0">
                        <p className="font-medium text-[var(--color-ink-900)]">{s.full_name}</p>
                        <p className="text-sm text-[var(--color-ink-500)]">
                          {course} · Attendance {attendancePct(s.id)}% · Progress {pct(s.id)}%
                        </p>
                      </Link>
                      <Badge tone={isPast(s.status) || s.status==='unknown' ? 'neutral' : 'success'}>{labelStatus(s.status)}</Badge>
                    </li>
                  ))
                ) : (
                  <li className="p-8 text-center text-sm text-[var(--color-ink-400)]">No students match this filter.</li>
                )}
              </ul>
            </Card>
          </>
        )}
        {tab === 'sessions' && <CohortLink label="Training Sessions" href="/sessions" text="View upcoming and completed sessions, or create a session for this cohort." />}
        {tab === 'attendance' && <CohortLink label="Attendance" href="/attendance" text="Record attendance by training session. Saved records contribute to each student and cohort summary." />}
        {tab === 'assignments' && <CohortLink label="Assignments" href="/assignments" text="Create, publish and review cohort assignments." />}
        {tab === 'assessments' && <CohortLink label="Assessments" href="/assessments" text="Create assessments and review results for this cohort." />}
        {tab === 'progress' && (
          <>
            <SectionHeading title="Student progress" />
            {stat}
            <Card className="mt-5 p-5">
              <ProgressRing value={average} size={88} />
              <p className="mt-3 text-sm text-[var(--color-ink-500)]">Average progress across this cohort.</p>
            </Card>
          </>
        )}
        {tab === 'reports' && <CohortLink label="Reports" href="/reports" text="Review participation, attendance, assessment, progress and completion reports for students in this cohort." />}
      </div>
    </div>
  )
}
function Mini({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
  return (
    <Card className="p-4">
      <Icon size={18} className="text-[var(--color-harbor-600)]" />
      <p className="mt-2 text-xs text-[var(--color-ink-500)]">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
    </Card>
  )
}
function CohortLink({ label, href, text }: { label: string; href: string; text: string }) {
  return (
    <Card className="p-5">
      <SectionHeading title={label} />
      <p className="text-sm text-[var(--color-ink-600)]">{text}</p>
      <Link to={href} className="mt-4 inline-block text-sm font-semibold text-[var(--color-harbor-600)]">
        Open {label}
      </Link>
    </Card>
  )
}
function date(v: string | null) {
  return v ? new Date(v).toLocaleDateString() : 'Not set'
}
