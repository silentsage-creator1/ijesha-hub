import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  BookOpen,
  GraduationCap,
  Calendar,
  ChevronRight,
  Award,
  Layers,
} from 'lucide-react'
import { Card } from '@/components/ui/primitives'
import { PageHeader } from '@/components/shell/PageHeader'
import { useAuth } from '@/app/auth'
import { Modal } from '@/components/ui/Modal'
import { Field } from '@/components/ui/Field'
import { getAllCohorts, type Cohort } from '@/lib/cohorts'
import {
  getStoredClasswork,
  saveStoredClasswork,
  getStoredSubmissions,
  computeStudentClassworkStatus,
  formatDueDate,
  type ClassworkItem,
  type StudentClassworkStatus,
  type StudentSubmission,
} from '@/lib/classwork'

type FilterTab = 'All' | 'To Do' | 'In Progress' | 'Submitted' | 'Completed' | 'Overdue'

export function ClassworkPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { profile, session, role } = useAuth()
  const isStudent = role === 'student'
  const currentStudentId = profile?.id || session?.user?.id || ''

  const [classworkItems, setClassworkItems] = useState<ClassworkItem[]>([])
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All')
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [showCreate, setShowCreate] = useState(() => searchParams.get('create') === '1')
  const [newTitle, setNewTitle] = useState('')
  const [newInstructions, setNewInstructions] = useState('')
  const [newCohortId, setNewCohortId] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newMarks, setNewMarks] = useState('100')

  // Load classwork items and submissions
  useEffect(() => {
    const items = getStoredClasswork()
    const allSubs = getStoredSubmissions()
    setClassworkItems(items)
    setSubmissions(allSubs)
  }, [])
  useEffect(() => { void getAllCohorts().then(setCohorts) }, [])
  const createClasswork = () => {
    const cohort = cohorts.find((item) => item.id === newCohortId)
    if (!newTitle.trim() || !cohort) return
    const item: ClassworkItem = { id: `classwork-${Date.now()}`, title: newTitle.trim(), course_id: cohort.course_id, course_name: cohort.course_name, cohort_id: cohort.id, cohort_name: cohort.name, trainer_id: profile?.id ?? '', trainer_name: profile?.full_name ?? 'Trainer', assigned_date: new Date().toISOString(), due_date: newDueDate, instructions: newInstructions, submission_method: 'Both', maximum_marks: Number(newMarks) || 100, resources: [], allow_resubmission: true, status: 'Published', created_at: new Date().toISOString() }
    const next = [item, ...classworkItems]
    saveStoredClasswork(next)
    setClassworkItems(next)
    setShowCreate(false); setNewTitle(''); setNewInstructions(''); setNewCohortId(''); setNewDueDate(''); setNewMarks('100')
  }

  // Student Access Rules: Filter classwork to only those relevant to this student
  const accessibleClasswork = useMemo(() => {
    if (isStudent) {
      return classworkItems.filter((item) => {
        if (item.status !== 'Published') return false
        return true
      })
    }
    return classworkItems
  }, [classworkItems, isStudent])

  // Map each classwork item to the student's status & submission
  const classworkWithStatus = useMemo(() => {
    return accessibleClasswork.map((item) => {
      // Find current student's submission only (Strict privacy rule)
      const studentSub = submissions.find(
        (s) => s.classwork_id === item.id && s.student_id === currentStudentId
      ) || null

      const status = computeStudentClassworkStatus(item, studentSub)
      const score = studentSub?.score ?? null

      return {
        item,
        submission: studentSub,
        status,
        score,
      }
    })
  }, [accessibleClasswork, submissions, currentStudentId])

  // Compute summary card counts
  const summaryCounts = useMemo(() => {
    let toDoCount = 0
    let inProgressCount = 0
    let submittedCount = 0
    let completedCount = 0

    classworkWithStatus.forEach((cw) => {
      if (cw.status === 'To Do' || cw.status === 'Overdue') toDoCount++
      if (cw.status === 'In Progress') inProgressCount++
      if (cw.status === 'Submitted') submittedCount++
      if (cw.status === 'Completed') completedCount++
    })

    return {
      toDo: toDoCount,
      inProgress: inProgressCount,
      submitted: submittedCount,
      completed: completedCount,
      total: classworkWithStatus.length,
    }
  }, [classworkWithStatus])

  // Filter and search
  const filteredList = useMemo(() => {
    return classworkWithStatus.filter(({ item, status }) => {
      // Filter tab
      if (activeFilter === 'To Do' && status !== 'To Do') return false
      if (activeFilter === 'In Progress' && status !== 'In Progress') return false
      if (activeFilter === 'Submitted' && status !== 'Submitted') return false
      if (activeFilter === 'Completed' && status !== 'Completed') return false
      if (activeFilter === 'Overdue' && status !== 'Overdue') return false

      // Search by title
      if (
        searchQuery.trim() &&
        !item.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !item.course_name.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false
      }

      return true
    })
  }, [classworkWithStatus, activeFilter, searchQuery])

  // Helper for status badge styling
  const getStatusBadge = (status: StudentClassworkStatus) => {
    switch (status) {
      case 'To Do':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-ink-100)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-ink-700)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-ink-500)]" />
            To Do
          </span>
        )
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            In Progress
          </span>
        )
      case 'Submitted':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            <Clock className="h-3 w-3 text-amber-600" />
            Submitted
          </span>
        )
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            Completed
          </span>
        )
      case 'Overdue':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
            <AlertTriangle className="h-3 w-3 text-red-600" />
            Overdue
          </span>
        )
      default:
        return null
    }
  }

  const filterTabs: FilterTab[] = [
    'All',
    'To Do',
    'In Progress',
    'Submitted',
    'Completed',
    'Overdue',
  ]

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <PageHeader
        title={
          role === 'parent'
            ? 'Child Classwork & Tasks'
            : role === 'trainer' || role === 'manager' || role === 'admin'
            ? 'Classwork & Tasks'
            : 'Classwork'
        }
        subtitle={
          role === 'parent'
            ? "Guardian portal: Monitor your child's assigned tasks, upcoming deadlines, and submission progress."
            : role === 'trainer' || role === 'manager' || role === 'admin'
            ? 'Cohort curriculum tasks: Monitor assigned deliverables, track student turnaround, and review submissions.'
            : 'Manage your assigned tasks, monitor due dates, upload deliverables, and track grading progress.'
        }
        actions={
          role === 'trainer' || role === 'admin' || role === 'manager' ? (
            <div className="flex items-center gap-2">
              <Link
                to="/grading-queue"
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-600)] transition-colors"
              >
                <Clock className="h-3.5 w-3.5" />
                Grading Queue
              </Link>
              <button
                onClick={() => navigate('/assignments')}
                className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--color-ink-800)] shadow-xs hover:bg-[var(--color-ink-50)]"
              >
                <FileText className="h-3.5 w-3.5" />
                Manage Curriculum
              </button>
              <button onClick={() => setShowCreate(true)} disabled={cohorts.length === 0} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-harbor-500)] px-3.5 py-2 text-xs font-semibold text-[var(--color-harbor-700)] disabled:opacity-50">
                <FileText className="h-3.5 w-3.5" /> Add Classwork
              </button>
            </div>
          ) : undefined
        }
      />

      {/* 2. Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* To Do */}
        <button
          onClick={() => setActiveFilter(activeFilter === 'To Do' ? 'All' : 'To Do')}
          className={`group flex flex-col justify-between rounded-xl border p-4 text-left transition-all hover:shadow-sm ${
            activeFilter === 'To Do'
              ? 'border-[var(--color-ink-400)] bg-[var(--color-ink-50)] ring-1 ring-[var(--color-ink-400)]'
              : 'border-[var(--color-line)] bg-white hover:border-[var(--color-ink-300)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-ink-500)]">To Do</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-ink-100)] text-[var(--color-ink-600)]">
              <FileText className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="font-display text-2xl font-bold text-[var(--color-ink-900)]">
              {summaryCounts.toDo}
            </span>
            <p className="text-[11px] text-[var(--color-ink-500)]">Pending start or overdue</p>
          </div>
        </button>

        {/* In Progress */}
        <button
          onClick={() =>
            setActiveFilter(activeFilter === 'In Progress' ? 'All' : 'In Progress')
          }
          className={`group flex flex-col justify-between rounded-xl border p-4 text-left transition-all hover:shadow-sm ${
            activeFilter === 'In Progress'
              ? 'border-blue-400 bg-blue-50/50 ring-1 ring-blue-400'
              : 'border-[var(--color-line)] bg-white hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-700">In Progress</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <Clock className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="font-display text-2xl font-bold text-blue-900">
              {summaryCounts.inProgress}
            </span>
            <p className="text-[11px] text-blue-600">Saved as working draft</p>
          </div>
        </button>

        {/* Submitted */}
        <button
          onClick={() =>
            setActiveFilter(activeFilter === 'Submitted' ? 'All' : 'Submitted')
          }
          className={`group flex flex-col justify-between rounded-xl border p-4 text-left transition-all hover:shadow-sm ${
            activeFilter === 'Submitted'
              ? 'border-amber-400 bg-amber-50/50 ring-1 ring-amber-400'
              : 'border-[var(--color-line)] bg-white hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-700">Submitted</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Clock className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="font-display text-2xl font-bold text-amber-900">
              {summaryCounts.submitted}
            </span>
            <p className="text-[11px] text-amber-600">Awaiting trainer review</p>
          </div>
        </button>

        {/* Completed */}
        <button
          onClick={() =>
            setActiveFilter(activeFilter === 'Completed' ? 'All' : 'Completed')
          }
          className={`group flex flex-col justify-between rounded-xl border p-4 text-left transition-all hover:shadow-sm ${
            activeFilter === 'Completed'
              ? 'border-emerald-400 bg-emerald-50/50 ring-1 ring-emerald-400'
              : 'border-[var(--color-line)] bg-white hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-700">Completed</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="font-display text-2xl font-bold text-emerald-900">
              {summaryCounts.completed}
            </span>
            <p className="text-[11px] text-emerald-600">Graded with feedback</p>
          </div>
        </button>
      </div>

      {/* 3. Controls Bar: Filters & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink-50)] p-1">
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab
            return (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-white text-[var(--color-ink-900)] shadow-xs'
                    : 'text-[var(--color-ink-600)] hover:text-[var(--color-ink-900)]'
                }`}
              >
                {tab}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--color-ink-400)]" />
          <input
            type="text"
            placeholder="Search classwork by title…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white py-1.5 pl-9 pr-3 text-xs text-[var(--color-ink-900)] placeholder-[var(--color-ink-400)] focus:border-[var(--color-harbor-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-harbor-500)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-xs font-semibold text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 4. Classwork List */}
      <div className="space-y-3">
        {filteredList.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-ink-100)] text-[var(--color-ink-400)]">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="mt-3 font-display text-sm font-semibold text-[var(--color-ink-800)]">
              No classwork found
            </h3>
            <p className="mt-1 max-w-sm text-xs text-[var(--color-ink-500)]">
              {searchQuery || activeFilter !== 'All'
                ? `No classwork items match "${searchQuery || activeFilter}". Try adjusting your filter or search query.`
                : 'You have no classwork items assigned right now. When your trainer publishes tasks, they will appear here.'}
            </p>
            {(searchQuery || activeFilter !== 'All') && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setActiveFilter('All')
                }}
                className="mt-4 inline-flex items-center text-xs font-semibold text-[var(--color-harbor-600)] hover:underline"
              >
                Clear filters
              </button>
            )}
          </Card>
        ) : (
          filteredList.map(({ item, status, score }) => (
            <Card
              key={item.id}
              className="group relative flex flex-col justify-between gap-4 p-5 transition-all hover:border-[var(--color-harbor-300)] hover:shadow-xs sm:flex-row sm:items-center"
            >
              <div className="space-y-2 flex-1 min-w-0">
                {/* Meta tags: Course, Cohort, Trainer, Status */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded bg-[var(--color-ink-100)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-ink-700)]">
                    <BookOpen className="h-3 w-3 text-[var(--color-ink-500)]" />
                    {item.course_name}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-[var(--color-ink-50)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-ink-600)] border border-[var(--color-line)]">
                    <Layers className="h-3 w-3 text-[var(--color-ink-400)]" />
                    {item.cohort_name}
                  </span>
                  {getStatusBadge(status)}
                </div>

                {/* Title */}
                <h3 className="font-display text-base font-semibold text-[var(--color-ink-900)] group-hover:text-[var(--color-harbor-700)]">
                  <Link to={`/classwork/${item.id}`} className="hover:underline">
                    {item.title}
                  </Link>
                </h3>

                {/* Sub info: Trainer, Due date, Marks */}
                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-[var(--color-ink-500)]">
                  <span className="inline-flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-[var(--color-ink-400)]" />
                    Trainer: <strong className="font-medium text-[var(--color-ink-700)]">{item.trainer_name}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[var(--color-ink-400)]" />
                    Due: <strong className={status === 'Overdue' ? 'font-medium text-red-600' : 'font-medium text-[var(--color-ink-700)]'}>{formatDueDate(item.due_date)}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-[var(--color-ink-400)]" />
                    Max: {item.maximum_marks} marks
                  </span>
                </div>
              </div>

              {/* Right Side: Score when available & View Classwork Button */}
              <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 border-t border-[var(--color-line)] pt-3 sm:border-t-0 sm:pt-0">
                {score !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-ink-500)]">Score:</span>
                    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 font-display text-sm font-bold text-emerald-700 border border-emerald-200">
                      {score} / {item.maximum_marks}
                    </span>
                  </div>
                )}

                <Link
                  to={`/classwork/${item.id}`}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[var(--color-harbor-600)]"
                >
                  View Classwork
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Card>
          ))
        )}
      </div>
      {showCreate && <Modal title="Add Classwork" onClose={() => setShowCreate(false)}><div className="space-y-4"><Field label="Title"><input className="input" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} /></Field><Field label="Cohort"><select className="input" value={newCohortId} onChange={(event) => setNewCohortId(event.target.value)}><option value="">Select a cohort</option>{cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name} ({cohort.course_name})</option>)}</select></Field><Field label="Instructions"><textarea className="input min-h-24" value={newInstructions} onChange={(event) => setNewInstructions(event.target.value)} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Due date"><input className="input" type="date" value={newDueDate} onChange={(event) => setNewDueDate(event.target.value)} /></Field><Field label="Maximum marks"><input className="input" type="number" min="1" value={newMarks} onChange={(event) => setNewMarks(event.target.value)} /></Field></div><button disabled={!newTitle.trim() || !newCohortId} onClick={createClasswork} className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Publish Classwork</button></div></Modal>}
    </div>
  )
}
