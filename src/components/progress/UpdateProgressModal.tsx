import { useState } from 'react'
import { X, Save } from 'lucide-react'
import type {
  CohortProgressOverviewData,
  ProgressHistoryItem,
} from '@/lib/progress'

interface UpdateProgressModalProps {
  isOpen: boolean
  onClose: () => void
  cohortData: CohortProgressOverviewData
  initialStudentId?: string
  onSave: (updatedData: CohortProgressOverviewData) => void
}

export function UpdateProgressModal({
  isOpen,
  onClose,
  cohortData,
  initialStudentId,
  onSave,
}: UpdateProgressModalProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudentId || cohortData.students[0]?.id || ''
  )

  const activeStudent =
    cohortData.students.find((s) => s.id === selectedStudentId) || cohortData.students[0]

  // Form state initialized from active student
  const [overallProgress, setOverallProgress] = useState<number>(activeStudent?.overallProgress ?? 85)
  const [attendanceRate, setAttendanceRate] = useState<number>(activeStudent?.attendanceRate ?? 90)
  const [status, setStatus] = useState<'On Track' | 'At Risk' | 'Completed'>(
    activeStudent?.status ?? 'On Track'
  )
  const [assignCompleted, setAssignCompleted] = useState<number>(
    activeStudent?.assignmentsCount.completed ?? 9
  )
  const [assignTotal, setAssignTotal] = useState<number>(
    activeStudent?.assignmentsCount.total ?? 10
  )
  const [projCompleted, setProjCompleted] = useState<number>(
    activeStudent?.projectsCount.completed ?? 4
  )
  const [projTotal, setProjTotal] = useState<number>(
    activeStudent?.projectsCount.total ?? 5
  )
  const [asmtCompleted, setAsmtCompleted] = useState<number>(
    activeStudent?.assessmentsCount.completed ?? 5
  )
  const [asmtTotal, setAsmtTotal] = useState<number>(
    activeStudent?.assessmentsCount.total ?? 6
  )

  // New milestone / history update
  const [addMilestone, setAddMilestone] = useState(false)
  const [milestoneWeek, setMilestoneWeek] = useState(5)
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [milestoneDetails, setMilestoneDetails] = useState('')

  if (!isOpen || !activeStudent) return null

  const handleStudentChange = (id: string) => {
    setSelectedStudentId(id)
    const s = cohortData.students.find((std) => std.id === id)
    if (s) {
      setOverallProgress(s.overallProgress)
      setAttendanceRate(s.attendanceRate)
      setStatus(s.status)
      setAssignCompleted(s.assignmentsCount.completed)
      setAssignTotal(s.assignmentsCount.total)
      setProjCompleted(s.projectsCount.completed)
      setProjTotal(s.projectsCount.total)
      setAsmtCompleted(s.assessmentsCount.completed)
      setAsmtTotal(s.assessmentsCount.total)
    }
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()

    // Calculate updated percentage scores
    const assignPct = Math.round((assignCompleted / Math.max(1, assignTotal)) * 100)
    const projPct = Math.round((projCompleted / Math.max(1, projTotal)) * 100)
    const asmtPct = Math.round((asmtCompleted / Math.max(1, asmtTotal)) * 100)

    // Build updated student object
    const updatedWeeklyPoints = [...activeStudent.weeklyProgressPoints]
    const currentWeekIdx = updatedWeeklyPoints.findIndex((p) => p.week === 5)
    if (currentWeekIdx >= 0) {
      updatedWeeklyPoints[currentWeekIdx] = { week: 5, progress: overallProgress }
    } else {
      updatedWeeklyPoints.push({ week: 5, progress: overallProgress })
    }

    const updatedHistory: ProgressHistoryItem[] = [...activeStudent.history]
    if (addMilestone && milestoneTitle.trim()) {
      updatedHistory.unshift({
        id: `hist-custom-${Date.now()}`,
        studentId: activeStudent.id,
        week: milestoneWeek,
        title: milestoneTitle.trim(),
        details: milestoneDetails.trim() || `Progress milestone registered at ${overallProgress}%.`,
        progressPercentage: overallProgress,
        recordedAt: new Date().toISOString().split('T')[0],
      })
    }

    const updatedStudents = cohortData.students.map((s) => {
      if (s.id === activeStudent.id) {
        return {
          ...s,
          overallProgress,
          attendanceRate,
          status,
          assignmentsProgress: assignPct,
          projectsProgress: projPct,
          assessmentsProgress: asmtPct,
          assignmentsCount: { completed: assignCompleted, total: assignTotal },
          projectsCount: { completed: projCompleted, total: projTotal },
          assessmentsCount: { completed: asmtCompleted, total: asmtTotal },
          weeklyProgressPoints: updatedWeeklyPoints,
          history: updatedHistory,
        }
      }
      return s
    })

    // Also update cohort week 5 progress to match the new student average
    const newCohortAvg = Math.round(
      updatedStudents.reduce((acc, s) => acc + s.overallProgress, 0) / updatedStudents.length
    )
    const updatedWeeks = cohortData.weeks.map((w) => {
      if (w.week === 5) {
        return { ...w, overallProgress: newCohortAvg }
      }
      return w
    })

    const newOverviewData: CohortProgressOverviewData = {
      ...cohortData,
      weeks: updatedWeeks,
      students: updatedStudents,
      overallProgress: newCohortAvg,
      studentsOnTrack: updatedStudents.filter((s) => s.status === 'On Track').length,
      studentsAtRisk: updatedStudents.filter((s) => s.status === 'At Risk').length,
      completed: updatedStudents.filter((s) => s.status === 'Completed').length,
    }

    onSave(newOverviewData)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--color-ink-900)]">
              Update Student Progress
            </h2>
            <p className="mt-0.5 text-xs text-[var(--color-ink-500)]">
              Authorize progress updates and milestones for {cohortData.cohortName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--color-ink-400)] hover:bg-[var(--color-paper)] hover:text-[var(--color-ink-700)]"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          {/* Student Selector */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-ink-700)] uppercase tracking-wider mb-1.5">
              Select Student
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => handleStudentChange(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm text-[var(--color-ink-900)] font-medium focus:border-[var(--color-harbor-500)] focus:outline-none"
            >
              {cohortData.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.studentName} ({s.status} · Current: {s.overallProgress}%)
                </option>
              ))}
            </select>
          </div>

          {/* Metric adjustments */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink-700)] uppercase tracking-wider mb-1">
                Overall Progress (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                required
                value={overallProgress}
                onChange={(e) => setOverallProgress(Number(e.target.value))}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink-700)] uppercase tracking-wider mb-1">
                Attendance Rate (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                required
                value={attendanceRate}
                onChange={(e) => setAttendanceRate(Number(e.target.value))}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-none"
              />
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-ink-700)] uppercase tracking-wider mb-1.5">
              Performance Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['On Track', 'At Risk', 'Completed'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatus(st)}
                  className={`rounded-[var(--radius-md)] border py-2 px-2 text-center text-xs font-semibold transition-all ${
                    status === st
                      ? st === 'On Track'
                        ? 'border-[var(--color-success-600)] bg-[var(--color-success-100)] text-[var(--color-success-700)] font-bold'
                        : st === 'At Risk'
                        ? 'border-[var(--color-danger-600)] bg-[var(--color-danger-100)] text-[var(--color-danger-700)] font-bold'
                        : 'border-[var(--color-harbor-600)] bg-[var(--color-harbor-100)] text-[var(--color-harbor-700)] font-bold'
                      : 'border-[var(--color-line)] bg-white text-[var(--color-ink-600)] hover:bg-[var(--color-paper)]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Breakdown counts */}
          <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-paper)]/50 p-3 space-y-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink-700)] block">
              Component Counts
            </span>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label className="text-[var(--color-ink-600)] block mb-1">Assignments</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max={assignTotal}
                    value={assignCompleted}
                    onChange={(e) => setAssignCompleted(Number(e.target.value))}
                    className="w-12 rounded border border-[var(--color-line)] bg-white px-1.5 py-1 text-center font-bold"
                  />
                  <span>/ {assignTotal}</span>
                </div>
              </div>

              <div>
                <label className="text-[var(--color-ink-600)] block mb-1">Projects</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max={projTotal}
                    value={projCompleted}
                    onChange={(e) => setProjCompleted(Number(e.target.value))}
                    className="w-12 rounded border border-[var(--color-line)] bg-white px-1.5 py-1 text-center font-bold"
                  />
                  <span>/ {projTotal}</span>
                </div>
              </div>

              <div>
                <label className="text-[var(--color-ink-600)] block mb-1">Assessments</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max={asmtTotal}
                    value={asmtCompleted}
                    onChange={(e) => setAsmtCompleted(Number(e.target.value))}
                    className="w-12 rounded border border-[var(--color-line)] bg-white px-1.5 py-1 text-center font-bold"
                  />
                  <span>/ {asmtTotal}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Add History Milestone toggle */}
          <div className="border-t border-[var(--color-line)] pt-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--color-ink-800)]">
                Record Progress History Event
              </label>
              <input
                type="checkbox"
                id="addMilestoneCheck"
                checked={addMilestone}
                onChange={(e) => setAddMilestone(e.target.checked)}
                className="rounded border-[var(--color-line)] text-[var(--color-harbor-600)] focus:ring-[var(--color-harbor-500)]"
              />
            </div>

            {addMilestone && (
              <div className="mt-2.5 space-y-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--color-ink-600)]">Week:</span>
                  <select
                    value={milestoneWeek}
                    onChange={(e) => setMilestoneWeek(Number(e.target.value))}
                    className="rounded border border-[var(--color-line)] px-2 py-1 text-xs"
                  >
                    {[1, 2, 3, 4, 5].map((w) => (
                      <option key={w} value={w}>
                        Week {w}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Milestone title (e.g. Completed Network Security Assignment)"
                  value={milestoneTitle}
                  onChange={(e) => setMilestoneTitle(e.target.value)}
                  className="w-full rounded border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-ink-900)] focus:outline-none"
                />
                <textarea
                  rows={2}
                  placeholder="Details and trainer notes..."
                  value={milestoneDetails}
                  onChange={(e) => setMilestoneDetails(e.target.value)}
                  className="w-full rounded border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-ink-900)] focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 border-t border-[var(--color-line)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-paper)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-harbor-600)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-harbor-700)] shadow-xs"
            >
              <Save size={16} />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
