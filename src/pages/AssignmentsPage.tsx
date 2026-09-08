import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Calendar, BookOpen } from 'lucide-react'
import { Card, Badge } from '@/components/ui/primitives'
import { useAuth } from '@/app/auth'
import {
  getStoredAssignments,
  saveStoredAssignments,
  getStoredSubmissions,
  formatAssignmentDate,
} from '@/lib/assignments'
import { AddAssignmentModal } from '@/components/assignments/AddAssignmentModal'
import type { Assignment, StudentAssignmentStatus } from '@/types'
import { getAllCohorts } from '@/lib/cohorts'

interface CohortSummary {
  id: string
  name: string
  course_name: string
}

export function AssignmentsPage() {
  const navigate = useNavigate()
  const { role, profile } = useAuth()
  const isStaff = ['admin', 'manager', 'trainer'].includes(role ?? '')
  const isStudent = role === 'student'

  const [availableCohorts, setAvailableCohorts] = useState<CohortSummary[]>([])
  const [selectedCohortId, setSelectedCohortId] = useState<string>('')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  // Load assignments
  useEffect(() => {
    const list = getStoredAssignments()
    setAssignments(list)
  }, [])

  useEffect(() => {
    const loadCohorts = async () => {
      const list = await getAllCohorts()
      const mapped = list.map(({ id, name, course_name }) => ({ id, name, course_name }))
      setAvailableCohorts(mapped)
      setSelectedCohortId((current) => mapped.some((cohort) => cohort.id === current) ? current : '')
    }
    void loadCohorts()
    window.addEventListener('cohorts-updated', loadCohorts)
    return () => window.removeEventListener('cohorts-updated', loadCohorts)
  }, [])

  // Selected cohort object & derived course
  const activeCohort = availableCohorts.find(c => c.id === selectedCohortId) ?? null
  const courseAssigned = activeCohort?.course_name ?? ''

  // Filter assignments based on cohort and role
  const cohortAssignments = useMemo(() => {
    return assignments.filter(a => {
      if (!activeCohort) return false
      const matchesCohort = a.cohort_id === selectedCohortId || a.cohort_name === activeCohort.name
      if (!matchesCohort) return false

      // If student, only show published assignments
      if (isStudent && a.status !== 'Published') return false

      return true
    })
  }, [assignments, selectedCohortId, activeCohort, isStudent])

  // Group assignments by training week
  const groupedByWeek = useMemo(() => {
    const map = new Map<number, Assignment[]>()

    // Determine weeks present or at least weeks 1 and 2
    cohortAssignments.forEach(a => {
      const wk = a.training_week || 1
      const current = map.get(wk) ?? []
      current.push(a)
      map.set(wk, current)
    })

    // Sort weeks ascending
    const sortedWeeks = Array.from(map.keys()).sort((a, b) => a - b)
    return sortedWeeks.map(weekNumber => {
      const items = map.get(weekNumber) ?? []
      const publishedCount = items.filter(i => i.status === 'Published').length
      const draftCount = items.filter(i => i.status === 'Draft').length
      return {
        weekNumber,
        items,
        publishedCount,
        draftCount,
        totalCount: items.length,
      }
    })
  }, [cohortAssignments])

  // When a new assignment is created from AddAssignmentModal
  const handleAssignmentCreated = (newAssignment: Assignment) => {
    const updated = [newAssignment, ...assignments]
    setAssignments(updated)
    saveStoredAssignments(updated)
    setIsAddModalOpen(false)
    // Navigate straight to Assignment Details
    navigate(`/assignments/${newAssignment.id}`)
  }

  // Get status for student view
  const getStudentStatusForAssignment = (assignmentId: string): StudentAssignmentStatus => {
    const subs = getStoredSubmissions(assignmentId)
    // match student by current user profile or default first record
    const found = subs.find(s => s.student_id === profile?.id) || subs[0]
    return found?.status ?? 'Not Started'
  }

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-ink-900)]">
            Assignments
          </h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-0.5">
            {isStudent
              ? 'Complete, submit, and track feedback for your course assignments.'
              : 'Create, manage, and track assignments for your students.'}
          </p>
        </div>

        {/* Add Assignment Button (Visible to staff) */}
        {isStaff && (
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            disabled={availableCohorts.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-harbor-600)] transition-colors shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} />
            Add Assignment
          </button>
        )}
      </div>

      {/* Cohort Selector & Automatically Displayed Course Section */}
      {!isStudent && (
        <Card className="p-5 bg-[var(--color-ink-50)]/30">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 items-center">
            {/* Select Cohort */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-600)] mb-1.5">
                Select Cohort
              </label>
              <select
                value={selectedCohortId}
                onChange={e => setSelectedCohortId(e.target.value)}
                disabled={availableCohorts.length === 0}
                className="input w-full bg-white font-medium text-[var(--color-ink-900)]"
              >
                <option value="">{availableCohorts.length === 0 ? 'No cohorts available' : 'Select a cohort'}</option>
                {availableCohorts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.course_name})
                  </option>
                ))}
              </select>
            </div>

            {/* Course Display */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-600)] mb-1.5">
                Course
              </label>
              <div className="flex items-center h-10 px-3.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white/90 text-sm font-semibold text-[var(--color-ink-900)]">
                {courseAssigned || '—'}
              </div>
              <span className="block mt-1 text-[11px] text-[var(--color-ink-400)] italic">
                Automatically displayed and cannot be manually changed.
              </span>
            </div>

            {/* Overview Quick Stats */}
            <div className="flex items-center justify-start sm:justify-end gap-3 text-xs text-[var(--color-ink-600)]">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-2">
                <span className="text-[var(--color-ink-400)] block">Total Tasks</span>
                <span className="text-base font-bold text-[var(--color-ink-900)]">
                  {cohortAssignments.length}
                </span>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-2">
                <span className="text-[var(--color-ink-400)] block">Published</span>
                <span className="text-base font-bold text-[var(--color-success-600)]">
                  {cohortAssignments.filter(a => a.status === 'Published').length}
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Student View Banner */}
      {isStudent && (
        <Card className="p-5 border-l-4 border-l-[var(--color-harbor-500)] bg-[var(--color-harbor-50)]/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-harbor-700)]">
                Your Cohort: {activeCohort?.name || '—'} · {courseAssigned || '—'}
              </p>
              <h2 className="font-display text-base font-semibold text-[var(--color-ink-900)] mt-0.5">
                Weekly Coursework & Practical Assignments
              </h2>
            </div>
            <span className="text-xs font-medium text-[var(--color-ink-600)]">
              Showing assignments assigned to your cohort
            </span>
          </div>
        </Card>
      )}

      {/* Weekly Grouped Assignments */}
      {groupedByWeek.length > 0 ? (
        <div className="space-y-8">
          {groupedByWeek.map(group => (
            <section key={group.weekNumber} className="space-y-4">
              {/* Week Header */}
              <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-2.5">
                <div>
                  <h2 className="font-display text-lg font-bold text-[var(--color-ink-900)]">
                    Week {group.weekNumber}
                  </h2>
                  <p className="text-xs font-medium text-[var(--color-ink-500)] mt-0.5">
                    {group.totalCount} {group.totalCount === 1 ? 'Assignment' : 'Assignments'}
                    {!isStudent && (
                      <>
                        {' · '}
                        <span className="text-[var(--color-success-600)] font-semibold">
                          {group.publishedCount} Published
                        </span>
                        {group.draftCount > 0 && (
                          <>
                            {' · '}
                            <span className="text-[var(--color-warning-600)] font-semibold">
                              {group.draftCount} Draft
                            </span>
                          </>
                        )}
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Assignments in Week */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map(asg => {
                  const studentStatus = isStudent ? getStudentStatusForAssignment(asg.id) : null

                  return (
                    <Card
                      key={asg.id}
                      className="flex flex-col justify-between p-5 hover:border-[var(--color-harbor-400)] transition-all hover:shadow-sm"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <Badge
                            tone={
                              isStudent
                                ? studentStatus === 'Graded'
                                  ? 'success'
                                  : studentStatus === 'Submitted'
                                  ? 'harbor'
                                  : 'neutral'
                                : asg.status === 'Published'
                                ? 'success'
                                : 'warning'
                            }
                          >
                            {isStudent ? studentStatus : asg.status}
                          </Badge>
                          <span className="text-[11px] font-medium text-[var(--color-ink-500)] bg-[var(--color-ink-50)] px-2 py-0.5 rounded">
                            {asg.assignment_type}
                          </span>
                        </div>

                        <div>
                          <h3 className="font-display text-base font-semibold text-[var(--color-ink-900)] leading-snug">
                            {asg.title}
                          </h3>
                          <p className="mt-1 text-xs text-[var(--color-ink-500)]">
                            {asg.course_name} · {asg.cohort_name}
                          </p>
                        </div>

                        <div className="space-y-1 text-xs text-[var(--color-ink-600)]">
                          <p className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-[var(--color-ink-400)] shrink-0" />
                            Due: {formatAssignmentDate(asg.due_date)}
                          </p>
                          <p className="text-[var(--color-ink-500)]">
                            Maximum Marks: <span className="font-semibold text-[var(--color-ink-800)]">{asg.maximum_marks}</span>
                          </p>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="mt-5 pt-3 border-t border-[var(--color-line)] flex items-center justify-between">
                        <span className="text-[11px] text-[var(--color-ink-400)] font-medium">
                          {asg.submission_type}
                        </span>

                        <button
                          type="button"
                          onClick={() => navigate(`/assignments/${asg.id}`)}
                          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-harbor-50)] hover:text-[var(--color-harbor-700)] hover:border-[var(--color-harbor-300)] transition-colors shadow-xs"
                        >
                          {isStudent ? 'Open Assignment' : 'View Assignment'}
                        </button>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <BookOpen size={36} className="mx-auto text-[var(--color-ink-300)] mb-3" />
          <h3 className="font-display text-base font-semibold text-[var(--color-ink-800)]">
            {activeCohort ? `No assignments found for ${activeCohort.name}` : 'No cohort has been created yet'}
          </h3>
          <p className="text-xs text-[var(--color-ink-500)] mt-1 max-w-sm mx-auto">
            {!activeCohort ? 'Create a course and cohort before adding assignments.' : isStaff
              ? 'Click Add Assignment above to create the first coursework task for this cohort.'
              : 'There are currently no assignments published for your cohort.'}
          </p>
          {isStaff && (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-harbor-600)] transition-colors shadow-xs"
            >
              <Plus size={14} /> Add Assignment
            </button>
          )}
        </Card>
      )}

      {/* Add Assignment Modal */}
      {isAddModalOpen && (
        <AddAssignmentModal
          preselectedCohortId={selectedCohortId}
          onClose={() => setIsAddModalOpen(false)}
          onCreated={handleAssignmentCreated}
        />
      )}
    </div>
  )
}
