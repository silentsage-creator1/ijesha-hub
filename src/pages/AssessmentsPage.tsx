import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, BookOpen, Clock, Award, HelpCircle } from 'lucide-react'
import { Card, Badge } from '@/components/ui/primitives'
import { useAuth } from '@/app/auth'
import {
  getStoredAssessments,
  saveStoredAssessments,
  getStoredAttempts,
} from '@/lib/assessments'
import type { Assessment, AssessmentAttempt } from '@/types'
import { AddAssessmentModal } from '@/components/assessments/AddAssessmentModal'
import { getAllCohorts } from '@/lib/cohorts'

interface CohortSummary {
  id: string
  name: string
  course_id: string
  course_name: string
}

export function AssessmentsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { role, profile, session } = useAuth()
  const isStaff = ['admin', 'manager', 'trainer'].includes(role ?? '')
  const isStudent = role === 'student'

  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [cohorts, setCohorts] = useState<CohortSummary[]>([])
  const [selectedCohortId, setSelectedCohortId] = useState<string>('')
  const [showAddModal, setShowAddModal] = useState<boolean>(() => searchParams.get('create') === '1')

  useEffect(() => {
    const list = getStoredAssessments()
    setAssessments(list)
  }, [])

  useEffect(() => {
    let active = true
    const loadCohorts = async () => {
      const list = await getAllCohorts()
      if (!active) return
      const mapped = list.map(({ id, name, course_id, course_name }) => ({ id, name, course_id, course_name }))
      setCohorts(mapped)
      setSelectedCohortId((current) => mapped.some((cohort) => cohort.id === current) ? current : '')
    }
    void loadCohorts()
    window.addEventListener('cohorts-updated', loadCohorts)
    return () => { active = false; window.removeEventListener('cohorts-updated', loadCohorts) }
  }, [])

  // Currently selected cohort & auto-derived course
  const selectedCohort = useMemo(() => {
    return cohorts.find((c) => c.id === selectedCohortId) ?? null
  }, [cohorts, selectedCohortId])

  // Filter assessments for selected cohort
  // If student, filter only Published assessments in their cohort
  const cohortAssessments = useMemo(() => {
    if (!selectedCohort) return []
    return assessments.filter((asmt) => {
      const matchCohort =
        asmt.cohort_id === selectedCohortId ||
        asmt.cohort_name?.toLowerCase() === selectedCohort.name.toLowerCase()
      if (isStudent) {
        return matchCohort && asmt.status === 'Published'
      }
      return matchCohort
    })
  }, [assessments, selectedCohortId, selectedCohort, isStudent])

  // Group assessments by training week (1, 2, 3...)
  const weeklyGroups = useMemo(() => {
    const groups: {
      week: number
      items: Assessment[]
      publishedCount: number
      draftCount: number
      closedCount: number
    }[] = []

    const map = new Map<number, Assessment[]>()
    for (const item of cohortAssessments) {
      const w = item.training_week || 1
      if (!map.has(w)) {
        map.set(w, [])
      }
      map.get(w)!.push(item)
    }

    // Sort weeks in ascending order
    const sortedWeeks = Array.from(map.keys()).sort((a, b) => a - b)
    for (const week of sortedWeeks) {
      const items = map.get(week) || []
      const publishedCount = items.filter((i) => i.status === 'Published').length
      const draftCount = items.filter((i) => i.status === 'Draft').length
      const closedCount = items.filter((i) => i.status === 'Closed').length
      groups.push({
        week,
        items,
        publishedCount,
        draftCount,
        closedCount,
      })
    }

    return groups
  }, [cohortAssessments])

  // For students, check attempt status per assessment
  const studentAttempts = useMemo(() => {
    if (!isStudent) return {}
    const map: Record<string, AssessmentAttempt | undefined> = {}
    for (const asmt of assessments) {
      const attempts = getStoredAttempts(asmt.id)
      const myAttempt = attempts.find(
        (a) =>
          a.student_id === profile?.id ||
          a.student_email?.toLowerCase() === session?.user?.email?.toLowerCase()
      )
      map[asmt.id] = myAttempt
    }
    return map
  }, [isStudent, assessments, profile?.id, session?.user?.email])

  // Handle newly created assessment
  const handleAssessmentCreated = (newAsmt: Assessment) => {
    const updated = [newAsmt, ...assessments]
    setAssessments(updated)
    saveStoredAssessments(updated)
    setShowAddModal(false)
    navigate(`/assessments/${newAsmt.id}`)
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink-900)]">
            Assessments
          </h1>
          <p className="mt-1 text-sm text-[var(--color-ink-500)]">
            Create, manage, and evaluate student assessments.
          </p>
        </div>

        {isStaff && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            disabled={cohorts.length === 0}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-600)] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} /> Add Assessment
          </button>
        )}
      </div>

      {/* Cohort Selector & Course Auto-Display */}
      <Card className="p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 items-center">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-ink-600)] uppercase tracking-wider mb-1.5">
              Select Cohort
            </label>
            <select
              value={selectedCohortId}
              onChange={(e) => setSelectedCohortId(e.target.value)}
              disabled={cohorts.length === 0}
              className="w-full sm:max-w-md rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-hidden"
            >
              <option value="">{cohorts.length === 0 ? 'No cohorts available' : 'Select a cohort'}</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.course_name})
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-[var(--radius-md)] bg-[var(--color-paper)] border border-[var(--color-line)] p-3">
            <span className="block text-xs font-semibold text-[var(--color-ink-400)] uppercase tracking-wider">
              Assigned Course
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <BookOpen size={16} className="text-[var(--color-harbor-600)]" />
              <span className="text-base font-bold text-[var(--color-ink-900)]">
                {selectedCohort ? `Course: ${selectedCohort.course_name}` : '—'}
              </span>
            </div>
            <span className="block text-[11px] text-[var(--color-ink-400)] italic mt-1">
              Automatically displayed and cannot be manually changed.
            </span>
          </div>
        </div>
      </Card>

      {/* Weekly Assessments List */}
      <div className="space-y-6">
        {weeklyGroups.length === 0 ? (
          <Card className="p-12 text-center">
            <HelpCircle
              size={36}
              className="mx-auto text-[var(--color-ink-300)] mb-3"
            />
            <p className="text-base font-medium text-[var(--color-ink-700)]">
              {selectedCohort ? `No assessments found for ${selectedCohort.name}.` : 'No cohort has been created yet.'}
            </p>
            <p className="text-xs text-[var(--color-ink-400)] mt-1">
              {!selectedCohort
                ? 'Create a course and cohort before adding assessments.'
                : isStaff
                ? 'Click "Add Assessment" above to create an evaluation for this cohort.'
                : 'No published assessments are currently scheduled for your cohort.'}
            </p>
          </Card>
        ) : (
          weeklyGroups.map((group) => (
            <div key={group.week} className="space-y-3">
              {/* Week Heading */}
              <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-2">
                <div className="flex items-baseline gap-3">
                  <h2 className="text-lg font-bold text-[var(--color-ink-900)]">
                    Week {group.week}
                  </h2>
                  <span className="text-xs font-medium text-[var(--color-ink-500)]">
                    {group.items.length}{' '}
                    {group.items.length === 1 ? 'Assessment' : 'Assessments'}
                    {isStaff && (
                      <>
                        {' · '}
                        {group.publishedCount} Published
                        {group.draftCount > 0 && ` · ${group.draftCount} Draft`}
                        {group.closedCount > 0 &&
                          ` · ${group.closedCount} Closed`}
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Assessment Cards in this Week */}
              <div className="grid gap-3 sm:grid-cols-2">
                {group.items.map((asmt) => {
                  const myAttempt = studentAttempts[asmt.id]
                  const attemptStatus = myAttempt?.status || 'Not Started'
                  const isCompleted = attemptStatus === 'Completed'

                  let badgeTone: 'success' | 'warning' | 'neutral' | 'harbor' = 'harbor'
                  if (asmt.status === 'Draft') badgeTone = 'warning'
                  else if (asmt.status === 'Closed') badgeTone = 'neutral'
                  else if (asmt.status === 'Published') badgeTone = 'success'

                  return (
                    <Card
                      key={asmt.id}
                      className="p-5 flex flex-col justify-between hover:border-[var(--color-harbor-300)] transition-all shadow-2xs"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <Badge tone={badgeTone}>{asmt.status}</Badge>
                          <span className="text-xs font-medium text-[var(--color-ink-500)]">
                            {asmt.assessment_type}
                          </span>
                        </div>

                        <h3 className="mt-3 text-base font-bold text-[var(--color-ink-900)] line-clamp-1">
                          {asmt.title}
                        </h3>

                        <p className="mt-1 text-xs text-[var(--color-ink-500)] font-medium">
                          {asmt.course_name} · {asmt.cohort_name}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--color-ink-600)]">
                          <span className="inline-flex items-center gap-1">
                            <HelpCircle size={13} className="text-[var(--color-harbor-500)]" />
                            {asmt.questions.length} Questions
                          </span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <Award size={13} className="text-[var(--color-harbor-500)]" />
                            {asmt.total_marks} Marks
                          </span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock size={13} className="text-[var(--color-harbor-500)]" />
                            {asmt.time_limit_minutes} Mins
                          </span>
                        </div>

                        {/* Student specific status chip */}
                        {isStudent && (
                          <div className="mt-3.5 flex items-center justify-between rounded-[var(--radius-md)] bg-[var(--color-paper)] p-2 text-xs">
                            <span className="text-[var(--color-ink-500)]">
                              Status:
                            </span>
                            <span
                              className={`font-semibold ${
                                isCompleted
                                  ? 'text-[var(--color-success-700)]'
                                  : attemptStatus === 'In Progress'
                                  ? 'text-[var(--color-warning-700)]'
                                  : 'text-[var(--color-ink-700)]'
                              }`}
                            >
                              {attemptStatus}
                            </span>
                            {isCompleted && myAttempt?.score !== null && (
                              <span className="font-bold text-[var(--color-harbor-700)]">
                                {myAttempt?.score}/{asmt.total_marks} (
                                {myAttempt?.percentage}%)
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-5 pt-3 border-t border-[var(--color-line)] flex items-center justify-between">
                        <span className="text-xs text-[var(--color-ink-400)]">
                          Pass: {asmt.settings.passing_score}%
                        </span>

                        <button
                          type="button"
                          onClick={() => navigate(`/assessments/${asmt.id}`)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-harbor-600)] hover:text-[var(--color-harbor-700)] hover:underline"
                        >
                          {isStudent && !isCompleted
                            ? 'Start Assessment'
                            : 'View Assessment'}
                          →
                        </button>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Assessment Modal */}
      {showAddModal && (
        <AddAssessmentModal
          initialCohortId={selectedCohortId}
          onClose={() => setShowAddModal(false)}
          onCreated={handleAssessmentCreated}
        />
      )}
    </div>
  )
}
