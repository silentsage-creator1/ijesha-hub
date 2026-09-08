import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Download,
  Edit3,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowLeft,
  Layers,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  FolderKanban,
  ListChecks,
  UserCheck,
} from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, Badge, SectionHeading } from '@/components/ui/primitives'
import { useAuth } from '@/app/auth'
import {
  getStoredCohortProgress,
  saveCohortProgress,
  type CohortProgressOverviewData,
} from '@/lib/progress'
import { ProgressLineChart } from '@/components/progress/ProgressLineChart'
import { DownloadReportModal } from '@/components/progress/DownloadReportModal'
import { UpdateProgressModal } from '@/components/progress/UpdateProgressModal'
import { getAllCohorts, type Cohort } from '@/lib/cohorts'

export function ProgressPage() {
  const { role, profile, session } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const isStaff = ['admin', 'manager', 'trainer'].includes(role ?? '')
  const isStudent = role === 'student'
  const isParent = role === 'parent'

  // Data state
  const [cohortData, setCohortData] = useState<CohortProgressOverviewData>(getStoredCohortProgress())
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [selectedCohort, setSelectedCohort] = useState<string>('')

  // Modals state
  const [downloadModalOpen, setDownloadModalOpen] = useState(false)
  const [updateModalOpen, setUpdateModalOpen] = useState(false)
  const [updateTargetStudentId, setUpdateTargetStudentId] = useState<string | undefined>(undefined)

  // Expandable weeks state
  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({
    1: true,
    2: true,
  })

  // Student filtering state
  const [studentSearch, setStudentSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'On Track' | 'At Risk' | 'Completed'>('all')

  useEffect(() => {
    let active = true
    const loadCohorts = async () => {
      const available = await getAllCohorts()
      if (!active) return
      setCohorts(available)
      setSelectedCohort((current) => available.some((cohort) => cohort.id === current) ? current : '')
    }
    void loadCohorts()
    window.addEventListener('cohorts-updated', loadCohorts)
    return () => { active = false; window.removeEventListener('cohorts-updated', loadCohorts) }
  }, [])

  const activeCohort = useMemo(
    () => cohorts.find((cohort) => cohort.id === selectedCohort) ?? null,
    [cohorts, selectedCohort],
  )
  const activeWeek = cohortData.weeks.length ? Math.max(...cohortData.weeks.map((week) => week.week)) : null

  // Selected student for single student drill-down view
  const studentParam = searchParams.get('student')

  // For students and parents: automatically focus on their own record
  const currentLearner = useMemo(() => {
    if (isStudent || isParent) {
      const email = session?.user?.email?.toLowerCase() || ''
      const name = profile?.full_name?.toLowerCase() || ''
      return (
        cohortData.students.find(
          (s) =>
            s.studentName.toLowerCase() === name ||
            (s.studentEmail && s.studentEmail.toLowerCase() === email) ||
            s.studentName.toLowerCase().includes('david')
        ) || cohortData.students[0]
      )
    }
    if (studentParam) {
      return (
        cohortData.students.find((s) => s.id === studentParam) ||
        cohortData.students.find((s) => s.studentName.toLowerCase() === studentParam.toLowerCase()) ||
        null
      )
    }
    return null
  }, [isStudent, isParent, session, profile, cohortData.students, studentParam])

  // Save changes handler
  const handleSaveProgress = (newData: CohortProgressOverviewData) => {
    saveCohortProgress(newData)
    setCohortData(newData)
  }

  // Toggle week expansion
  const toggleWeek = (week: number) => {
    setExpandedWeeks((prev) => ({ ...prev, [week]: !prev[week] }))
  }

  // Filtered students list for cohort view
  const filteredStudents = useMemo(() => {
    return cohortData.students.filter((s) => {
      const matchesSearch =
        !studentSearch || s.studentName.toLowerCase().includes(studentSearch.toLowerCase())
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [cohortData.students, studentSearch, statusFilter])

  // Format line chart data for cohort
  const cohortChartData = useMemo(() => {
    return cohortData.weeks.map((w) => ({
      week: w.week,
      progress: w.overallProgress,
      note: w.keyMilestone,
    }))
  }, [cohortData.weeks])

  // ==========================================
  // VIEW 1: Individual Student Progress Page
  // ==========================================
  if (currentLearner) {
    const studentChartData = currentLearner.weeklyProgressPoints.map((p) => ({
      week: p.week,
      progress: p.progress,
      note: `Week ${p.week} Milestone`,
    }))

    return (
      <div className="space-y-6">
        {/* Navigation Breadcrumb back to Cohort (for staff and sponsor) */}
        {!isStudent && !isParent && (
          <button
            onClick={() => setSearchParams({})}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] transition-colors"
          >
            <ArrowLeft size={14} />
            Back to {cohortData.cohortName} Progress
          </button>
        )}

        {/* Student Progress Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-line)] pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink-900)]">
                {currentLearner.studentName}
              </h1>
              <Badge
                tone={
                  currentLearner.status === 'On Track'
                    ? 'success'
                    : currentLearner.status === 'At Risk'
                    ? 'danger'
                    : 'neutral'
                }
              >
                {currentLearner.status}
              </Badge>
            </div>

            {/* Course, Cohort, Status Info */}
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[var(--color-ink-600)]">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <BookOpen size={15} className="text-[var(--color-harbor-500)]" />
                <span>
                  Course: <strong className="text-[var(--color-ink-900)]">{cohortData.courseName}</strong>
                </span>
              </span>
              <span className="text-[var(--color-line)]">•</span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Layers size={15} className="text-[var(--color-harbor-500)]" />
                <span>
                  Cohort: <strong className="text-[var(--color-ink-900)]">{cohortData.cohortName}</strong>
                </span>
              </span>
              <span className="text-[var(--color-line)]">•</span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <CheckCircle2 size={15} className="text-[var(--color-success-600)]" />
                <span>
                  Status: <strong className="text-[var(--color-ink-900)]">Active</strong>
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setUpdateTargetStudentId(currentLearner.id)
                setDownloadModalOpen(true)
              }}
              disabled={!activeCohort}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--color-ink-700)] shadow-xs hover:bg-[var(--color-paper)] transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={15} />
              <span>Download Progress Report</span>
            </button>

            {isStaff && (
              <button
                onClick={() => {
                  setUpdateTargetStudentId(currentLearner.id)
                  setUpdateModalOpen(true)
                }}
                disabled={!activeCohort}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-600)] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-700)] transition-all disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Edit3 size={15} />
                <span>Update Progress</span>
              </button>
            )}
          </div>
        </div>

        {/* Individual Student Progress Graph */}
        <Card className="p-5">
          <ProgressLineChart
            title="Student Progress"
            data={studentChartData}
            targetGoal={80}
            height={260}
          />
        </Card>

        {/* Progress Metrics Below Graph */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Card className="p-4 bg-[var(--color-harbor-100)]/40 border-[var(--color-harbor-200)]">
            <span className="text-xs font-semibold text-[var(--color-harbor-700)] uppercase tracking-wider block">
              Overall Progress
            </span>
            <span className="mt-1 font-display text-2xl font-bold text-[var(--color-harbor-700)]">
              {currentLearner.overallProgress}%
            </span>
          </Card>

          <Card className="p-4">
            <span className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wider block">
              Attendance
            </span>
            <span className="mt-1 font-display text-2xl font-bold text-[var(--color-ink-900)]">
              {currentLearner.attendanceRate}%
            </span>
          </Card>

          <Card className="p-4">
            <span className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wider block">
              Assignments
            </span>
            <span className="mt-1 font-display text-2xl font-bold text-[var(--color-ink-900)]">
              {currentLearner.assignmentsProgress}%
            </span>
          </Card>

          <Card className="p-4">
            <span className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wider block">
              Projects
            </span>
            <span className="mt-1 font-display text-2xl font-bold text-[var(--color-ink-900)]">
              {currentLearner.projectsProgress}%
            </span>
          </Card>

          <Card className="p-4">
            <span className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wider block">
              Assessments
            </span>
            <span className="mt-1 font-display text-2xl font-bold text-[var(--color-ink-900)]">
              {currentLearner.assessmentsProgress}%
            </span>
          </Card>

          <Card className="p-4">
            <span className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wider block">
              Training Sessions
            </span>
            <span className="mt-1 font-display text-2xl font-bold text-[var(--color-ink-900)]">
              {currentLearner.trainingSessionsProgress}%
            </span>
          </Card>
        </div>

        {/* Progress Breakdown & Progress History Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Progress Breakdown */}
          <Card className="p-5">
            <SectionHeading eyebrow="Components" title="Progress Breakdown" />
            <p className="mt-1 text-xs text-[var(--color-ink-500)] mb-4">
              Detailed tracking across sessions, coursework, projects, and assessments.
            </p>

            <div className="space-y-4">
              {/* Training Sessions */}
              <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-paper)]/40 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-[var(--color-harbor-600)]" />
                    <span className="text-sm font-semibold text-[var(--color-ink-900)]">
                      Training Sessions
                    </span>
                  </div>
                  <span className="text-sm font-bold text-[var(--color-ink-800)]">
                    {currentLearner.trainingSessionsCount.completed} / {currentLearner.trainingSessionsCount.total} completed
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--color-line)]">
                  <div
                    className="h-full bg-[var(--color-harbor-600)] rounded-full transition-all"
                    style={{ width: `${currentLearner.trainingSessionsProgress}%` }}
                  />
                </div>
              </div>

              {/* Assignments */}
              <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-paper)]/40 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-[var(--color-harbor-600)]" />
                    <span className="text-sm font-semibold text-[var(--color-ink-900)]">
                      Assignments
                    </span>
                  </div>
                  <span className="text-sm font-bold text-[var(--color-ink-800)]">
                    {currentLearner.assignmentsCount.completed} / {currentLearner.assignmentsCount.total} completed
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--color-line)]">
                  <div
                    className="h-full bg-[var(--color-harbor-600)] rounded-full transition-all"
                    style={{ width: `${currentLearner.assignmentsProgress}%` }}
                  />
                </div>
              </div>

              {/* Projects */}
              <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-paper)]/40 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderKanban size={16} className="text-[var(--color-harbor-600)]" />
                    <span className="text-sm font-semibold text-[var(--color-ink-900)]">
                      Projects
                    </span>
                  </div>
                  <span className="text-sm font-bold text-[var(--color-ink-800)]">
                    {currentLearner.projectsCount.completed} / {currentLearner.projectsCount.total} completed
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--color-line)]">
                  <div
                    className="h-full bg-[var(--color-harbor-600)] rounded-full transition-all"
                    style={{ width: `${currentLearner.projectsProgress}%` }}
                  />
                </div>
              </div>

              {/* Assessments */}
              <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-paper)]/40 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListChecks size={16} className="text-[var(--color-harbor-600)]" />
                    <span className="text-sm font-semibold text-[var(--color-ink-900)]">
                      Assessments
                    </span>
                  </div>
                  <span className="text-sm font-bold text-[var(--color-ink-800)]">
                    {currentLearner.assessmentsCount.completed} / {currentLearner.assessmentsCount.total} completed
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--color-line)]">
                  <div
                    className="h-full bg-[var(--color-harbor-600)] rounded-full transition-all"
                    style={{ width: `${currentLearner.assessmentsProgress}%` }}
                  />
                </div>
              </div>

              {/* Attendance */}
              <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-paper)]/40 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck size={16} className="text-[var(--color-harbor-600)]" />
                    <span className="text-sm font-semibold text-[var(--color-ink-900)]">
                      Attendance Rate
                    </span>
                  </div>
                  <span className="text-sm font-bold text-[var(--color-ink-800)]">
                    {currentLearner.attendanceRate}%
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--color-line)]">
                  <div
                    className="h-full bg-[var(--color-success-500)] rounded-full transition-all"
                    style={{ width: `${currentLearner.attendanceRate}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Progress History */}
          <Card className="p-5">
            <SectionHeading eyebrow="Timeline" title="Progress History" />
            <p className="mt-1 text-xs text-[var(--color-ink-500)] mb-4">
              Chronological history of important progress updates and milestones.
            </p>

            <div className="relative border-l-2 border-[var(--color-harbor-200)] ml-3 pl-4 space-y-6">
              {currentLearner.history.map((item) => (
                <div key={item.id} className="relative group">
                  {/* Dot indicator */}
                  <div className="absolute -left-[23px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-[var(--color-harbor-600)] shadow-xs" />

                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-bold text-[var(--color-harbor-700)]">
                      Week {item.week}
                    </span>
                    <span className="text-[11px] font-medium text-[var(--color-ink-400)]">
                      {item.recordedAt}
                    </span>
                  </div>

                  <h4 className="mt-1 text-sm font-semibold text-[var(--color-ink-900)]">
                    {item.title}
                  </h4>
                  <p className="mt-0.5 text-xs text-[var(--color-ink-600)] leading-relaxed">
                    {item.details}
                  </p>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-harbor-600)]">
                    <span>Progress updated to</span>
                    <span className="rounded bg-[var(--color-harbor-100)] px-1.5 py-0.5 text-[var(--color-harbor-700)] font-bold">
                      {item.progressPercentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Modals */}
        <DownloadReportModal
          isOpen={downloadModalOpen}
          onClose={() => setDownloadModalOpen(false)}
          cohortData={cohortData}
          selectedStudentId={currentLearner.id}
          userRole={role ?? undefined}
          currentUserName={profile?.full_name}
        />

        {isStaff && (
          <UpdateProgressModal
            isOpen={updateModalOpen}
            onClose={() => setUpdateModalOpen(false)}
            cohortData={cohortData}
            initialStudentId={currentLearner.id}
            onSave={handleSaveProgress}
          />
        )}
      </div>
    )
  }

  // ==========================================
  // VIEW 2: Cohort Overview & Main Progress Page
  // ==========================================
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Progress"
        subtitle="Track student learning progress, completion, and performance throughout the training program."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setUpdateTargetStudentId(undefined)
                setDownloadModalOpen(true)
              }}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--color-ink-700)] shadow-xs hover:bg-[var(--color-paper)] transition-all"
            >
              <Download size={15} />
              <span>Download Progress Report</span>
            </button>

            {isStaff && (
              <button
                onClick={() => {
                  setUpdateTargetStudentId(undefined)
                  setUpdateModalOpen(true)
                }}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-600)] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-700)] transition-all"
              >
                <Edit3 size={15} />
                <span>Update Progress</span>
              </button>
            )}
          </div>
        }
      />

      {/* Cohort Selector & Auto Course Display */}
      <Card className="p-4 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-ink-700)] mb-1">
                Select Cohort
              </label>
              <select
                value={selectedCohort}
                onChange={(e) => setSelectedCohort(e.target.value)}
                disabled={cohorts.length === 0}
                className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-2 text-sm font-semibold text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-none min-w-[200px]"
              >
                <option value="">{cohorts.length === 0 ? 'No cohorts available' : 'Select a cohort'}</option>
                {cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}
              </select>
            </div>

            {/* Automatically Displayed Course */}
            <div className="border-l border-[var(--color-line)] pl-4">
              <span className="block text-xs font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-1">
                Course
              </span>
              <div className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-harbor-100)]/50 border border-[var(--color-harbor-200)] px-3.5 py-1.5 text-sm font-bold text-[var(--color-harbor-700)]">
                <BookOpen size={16} />
                <span>{activeCohort?.course_name || '—'}</span>
              </div>
            </div>
          </div>

          <div className="text-xs text-[var(--color-ink-500)]">
            Active Term: <strong className="text-[var(--color-ink-800)]">{activeCohort && activeWeek ? `Weeks 1–${activeWeek}` : '—'}</strong> · Active Week:{' '}
            <strong className="text-[var(--color-harbor-700)]">{activeWeek ? `Week ${activeWeek}` : '—'}</strong>
          </div>
        </div>
      </Card>

      {/* Progress Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Overall Progress: 78% */}
        <Card className="p-4 bg-[var(--color-harbor-100)]/40 border-[var(--color-harbor-200)]">
          <span className="text-xs font-semibold text-[var(--color-harbor-700)] uppercase tracking-wider block">
            Overall Progress
          </span>
          <span className="mt-1 font-display text-3xl font-bold text-[var(--color-harbor-700)]">
            {cohortData.overallProgress}%
          </span>
          <span className="mt-1 block text-xs text-[var(--color-harbor-600)]">
            Target benchmark: 75%
          </span>
        </Card>

        {/* Students on Track: 20 */}
        <Card className="p-4">
          <span className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wider block">
            Students on Track
          </span>
          <span className="mt-1 font-display text-3xl font-bold text-[var(--color-success-600)]">
            {cohortData.studentsOnTrack}
          </span>
          <span className="mt-1 block text-xs text-[var(--color-ink-400)]">
            Meeting or exceeding targets
          </span>
        </Card>

        {/* Students At Risk: 3 */}
        <Card className="p-4">
          <span className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wider block">
            Students At Risk
          </span>
          <span className="mt-1 font-display text-3xl font-bold text-[var(--color-danger-600)]">
            {cohortData.studentsAtRisk}
          </span>
          <span className="mt-1 block text-xs text-[var(--color-ink-400)]">
            Requires tutor intervention
          </span>
        </Card>

        {/* Completed: 2 */}
        <Card className="p-4">
          <span className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wider block">
            Completed
          </span>
          <span className="mt-1 font-display text-3xl font-bold text-[var(--color-ink-800)]">
            {cohortData.completed}
          </span>
          <span className="mt-1 block text-xs text-[var(--color-ink-400)]">
            All milestones satisfied
          </span>
        </Card>

        {/* Average Attendance: 86% */}
        <Card className="p-4">
          <span className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wider block">
            Average Attendance
          </span>
          <span className="mt-1 font-display text-3xl font-bold text-[var(--color-ink-900)]">
            {cohortData.averageAttendance}%
          </span>
          <span className="mt-1 block text-xs text-[var(--color-ink-400)]">
            Across 15 completed sessions
          </span>
        </Card>
      </div>

      {/* Progress Graph (Main Feature) */}
      <Card className="p-5">
        <ProgressLineChart
          title="Training Progress"
          data={cohortChartData}
          targetGoal={75}
          height={260}
        />
      </Card>

      {/* Weekly Progress Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <SectionHeading eyebrow="Curriculum timeline" title="Weekly Progress" />
            <p className="text-xs text-[var(--color-ink-500)]">
              Expand and inspect training deliverables, attendance, and evaluation rates by week.
            </p>
          </div>
          <button
            onClick={() => {
              const allExpanded = Object.keys(expandedWeeks).length === cohortData.weeks.length
              if (allExpanded) {
                setExpandedWeeks({})
              } else {
                const all: Record<number, boolean> = {}
                cohortData.weeks.forEach((w) => {
                  all[w.week] = true
                })
                setExpandedWeeks(all)
              }
            }}
            className="text-xs font-semibold text-[var(--color-harbor-600)] hover:underline"
          >
            {Object.keys(expandedWeeks).length === cohortData.weeks.length
              ? 'Collapse All'
              : 'Expand All'}
          </button>
        </div>

        <div className="space-y-3">
          {cohortData.weeks.map((weekItem) => {
            const isExpanded = !!expandedWeeks[weekItem.week]

            return (
              <Card
                key={weekItem.week}
                className="overflow-hidden border border-[var(--color-line)] transition-all"
              >
                {/* Week Header Row */}
                <div
                  onClick={() => toggleWeek(weekItem.week)}
                  className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4 bg-white hover:bg-[var(--color-paper)]/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-harbor-100)] text-sm font-bold text-[var(--color-harbor-700)]">
                      W{weekItem.week}
                    </span>
                    <div>
                      <h3 className="font-display text-sm font-bold text-[var(--color-ink-900)]">
                        Week {weekItem.week}
                      </h3>
                      <p className="text-xs text-[var(--color-ink-500)]">
                        {weekItem.keyMilestone}
                      </p>
                    </div>
                  </div>

                  {/* Summary Indicators */}
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="rounded bg-[var(--color-harbor-100)] px-2.5 py-1 text-[var(--color-harbor-700)]">
                      Overall Progress: {weekItem.overallProgress}%
                    </span>
                    <span className="hidden sm:inline text-[var(--color-ink-600)]">
                      Sessions: {weekItem.trainingSessions.completed}/{weekItem.trainingSessions.total}
                    </span>
                    <span className="hidden sm:inline text-[var(--color-ink-600)]">
                      Attendance: {weekItem.attendanceRate}%
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleWeek(weekItem.week)
                      }}
                      className="inline-flex items-center gap-1 rounded border border-[var(--color-line)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-harbor-600)] hover:bg-[var(--color-paper)]"
                    >
                      <span>{isExpanded ? 'Collapse' : 'View Week'}</span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Collapsible Details Body */}
                {isExpanded && (
                  <div className="border-t border-[var(--color-line)] bg-[var(--color-paper)]/30 p-4 animate-in fade-in duration-200">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 text-xs">
                      {/* Training Sessions */}
                      <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3">
                        <span className="text-[var(--color-ink-400)] font-medium block mb-1">
                          Training Sessions
                        </span>
                        <span className="font-display text-base font-bold text-[var(--color-ink-900)]">
                          {weekItem.trainingSessions.completed} / {weekItem.trainingSessions.total}
                        </span>
                      </div>

                      {/* Attendance Rate */}
                      <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3">
                        <span className="text-[var(--color-ink-400)] font-medium block mb-1">
                          Attendance
                        </span>
                        <span className="font-display text-base font-bold text-[var(--color-ink-900)]">
                          {weekItem.attendanceRate}%
                        </span>
                      </div>

                      {/* Assignments */}
                      <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3">
                        <span className="text-[var(--color-ink-400)] font-medium block mb-1">
                          Assignments
                        </span>
                        <span className="font-display text-base font-bold text-[var(--color-ink-900)]">
                          {weekItem.assignments.completed} / {weekItem.assignments.total} completed
                        </span>
                      </div>

                      {/* Projects */}
                      <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3">
                        <span className="text-[var(--color-ink-400)] font-medium block mb-1">
                          Projects
                        </span>
                        <span className="font-display text-base font-bold text-[var(--color-ink-900)]">
                          {weekItem.projects.completed} / {weekItem.projects.total} completed
                        </span>
                      </div>

                      {/* Assessments */}
                      <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3">
                        <span className="text-[var(--color-ink-400)] font-medium block mb-1">
                          Assessments
                        </span>
                        <span className="font-display text-base font-bold text-[var(--color-ink-900)]">
                          {weekItem.assessments.completed} / {weekItem.assessments.total} completed
                        </span>
                      </div>
                    </div>

                    {/* Topics covered */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-[var(--color-ink-600)]">Topics:</span>
                      {weekItem.topicsCovered.map((topic, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-white border border-[var(--color-line)] px-2.5 py-0.5 text-[var(--color-ink-700)]"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>

      {/* Student Progress Section */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] pb-4">
          <div>
            <SectionHeading eyebrow="Roster" title="Student Progress" />
            <p className="text-xs text-[var(--color-ink-500)]">
              Click any student to view their detailed individual progress graph, breakdown, and history.
            </p>
          </div>

          {/* Search and status filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]"
              />
              <input
                type="text"
                placeholder="Search student..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="h-8 w-44 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white pl-8 pr-3 text-xs text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-none"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-8 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-2.5 text-xs text-[var(--color-ink-800)] font-medium focus:border-[var(--color-harbor-500)] focus:outline-none"
            >
              <option value="all">All Statuses ({cohortData.students.length})</option>
              <option value="On Track">On Track (20)</option>
              <option value="At Risk">At Risk (3)</option>
              <option value="Completed">Completed (2)</option>
            </select>
          </div>
        </div>

        {/* Student Cards Grid / Table */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map((std) => (
            <div
              key={std.id}
              onClick={() => setSearchParams({ student: std.id })}
              className="group flex flex-col justify-between rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4 shadow-xs transition-all hover:border-[var(--color-harbor-400)] hover:shadow-sm cursor-pointer"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-display text-sm font-bold text-[var(--color-ink-900)] group-hover:text-[var(--color-harbor-600)] transition-colors">
                      {std.studentName}
                    </h4>
                    <span className="text-[11px] text-[var(--color-ink-400)]">
                      {cohortData.courseName} · {cohortData.cohortName}
                    </span>
                  </div>
                  <Badge
                    tone={
                      std.status === 'On Track'
                        ? 'success'
                        : std.status === 'At Risk'
                        ? 'danger'
                        : 'neutral'
                    }
                  >
                    {std.status}
                  </Badge>
                </div>

                {/* Metrics Breakdown */}
                <div className="mt-3.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-ink-500)]">Overall Progress:</span>
                    <strong className="text-[var(--color-harbor-700)] font-bold">
                      {std.overallProgress}%
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-ink-500)]">Attendance:</span>
                    <strong className="text-[var(--color-ink-800)]">{std.attendanceRate}%</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-ink-500)]">Assignments:</span>
                    <strong className="text-[var(--color-ink-800)]">
                      {std.assignmentsProgress}%
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-ink-500)]">Projects:</span>
                    <strong className="text-[var(--color-ink-800)]">
                      {std.projectsProgress}%
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-ink-500)]">Assessments:</span>
                    <strong className="text-[var(--color-ink-800)]">
                      {std.assessmentsProgress}%
                    </strong>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--color-line)] flex items-center justify-end">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-harbor-600)] group-hover:underline">
                  View Progress →
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Download & Update Modals */}
      <DownloadReportModal
        isOpen={downloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
        cohortData={cohortData}
        selectedStudentId={updateTargetStudentId}
        userRole={role ?? undefined}
        currentUserName={profile?.full_name}
      />

      {isStaff && (
        <UpdateProgressModal
          isOpen={updateModalOpen}
          onClose={() => setUpdateModalOpen(false)}
          cohortData={cohortData}
          initialStudentId={updateTargetStudentId}
          onSave={handleSaveProgress}
        />
      )}
    </div>
  )
}
