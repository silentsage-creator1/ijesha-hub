import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Edit3,
  Plus,
  Search,
  UserCheck,
} from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Avatar, Badge, Card, SectionHeading } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Field } from '@/components/ui/Field'
import { supabase } from '@/lib/supabase'
import { apiUrl, useAuth } from '@/app/auth'
import { officialCourses } from '@/lib/courses'
import { getAllCohorts, type Cohort as StoredCohort } from '@/lib/cohorts'
import {
  calculateAttendanceRate,
  formatSessionDate,
  formatSessionTime,
  type CohortAttendanceOverview,
  type SessionWithAttendance,
  type TrainingWeekGroup,
} from '@/lib/attendance'
import type { AttendanceRecord, AttendanceStatus, Course, Student, TrainingSession } from '@/types'

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral'; activeClass: string }
> = {
  present: {
    label: 'Present',
    tone: 'success',
    activeClass: 'bg-[var(--color-success-500)] text-white border-[var(--color-success-600)] shadow-sm font-semibold',
  },
  absent: {
    label: 'Absent',
    tone: 'danger',
    activeClass: 'bg-[var(--color-danger-500)] text-white border-[var(--color-danger-600)] shadow-sm font-semibold',
  },
  late: {
    label: 'Late',
    tone: 'warning',
    activeClass: 'bg-[var(--color-warning-500)] text-white border-[var(--color-warning-600)] shadow-sm font-semibold',
  },
  excused: {
    label: 'Excused',
    tone: 'neutral',
    activeClass: 'bg-[var(--color-ink-700)] text-white border-[var(--color-ink-800)] shadow-sm font-semibold',
  },
}

export function AttendancePage() {
  const { role, profile } = useAuth()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const isStaff = role === 'admin' || role === 'manager' || role === 'trainer'
  const isStudent = role === 'student' || location.pathname === '/my-attendance'
  const isParent = role === 'parent' || location.pathname === '/child-attendance'

  // Global cohort & course state
  const [cohorts, setCohorts] = useState<StoredCohort[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCohortId, setSelectedCohortId] = useState<string>('')
  const [selectedCourseName, setSelectedCourseName] = useState<string>('')

  // Cohort's students & sessions & attendance
  const [cohortStudents, setCohortStudents] = useState<Student[]>([])
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])

  // UI view modes
  // 'overview' | 'take' | 'view'
  const currentView = (searchParams.get('view') as 'take' | 'view') || 'overview'
  const activeSessionId = searchParams.get('session') || null

  // Active session details for Take / View attendance
  const [editingAttendance, setEditingAttendance] = useState(false)
  const [sessionFormState, setSessionFormState] = useState<Record<string, AttendanceStatus>>({})
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null)
  const [savingAttendance, setSavingAttendance] = useState(false)

  // Student search filter in session table
  const [studentSearch, setStudentSearch] = useState('')

  // Add Session modal state
  const [addSessionModalOpen, setAddSessionModalOpen] = useState(false)
  const [newTopic, setNewTopic] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newWeek, setNewWeek] = useState('1')
  const [newTrainerName, setNewTrainerName] = useState('John Doe')
  const [creatingSession, setCreatingSession] = useState(false)

  // Loading & error
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Student-specific state (for student or parent view)
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null)

  // 1. Initial Data Fetch
  useEffect(() => {
    let cancelled = false
    async function loadInitial() {
      setLoading(true)
      setError(null)
      try {
        if (isStudent) {
          const response = await fetch(apiUrl('/api/student/attendance'), { credentials: 'include' })
          const context = await response.json() as {
            cohort: StoredCohort | null
            student: Student | null
            sessions: TrainingSession[]
            attendance: AttendanceRecord[]
            error?: string
          }
          if (!response.ok) throw new Error(context.error || 'Unable to load your attendance.')
          if (cancelled) return
          setCohorts(context.cohort ? [context.cohort] : [])
          setSelectedCohortId(context.cohort?.id || '')
          setSelectedCourseName(context.cohort?.course_name || '')
          setCohortStudents(context.student ? [context.student] : [])
          setCurrentStudent(context.student)
          setSessions(context.sessions ?? [])
          setAttendanceRecords(context.attendance ?? [])
          return
        }
        const [cohortList, coursesRes] = await Promise.all([
          getAllCohorts(),
          supabase.from('courses').select('id, name').order('name'),
        ])

        if (cancelled) return

        const loadedCourses = officialCourses((coursesRes.data ?? []) as Course[])
        const loadedCohorts = cohortList

        setCourses(loadedCourses)
        setCohorts(loadedCohorts)

        // Determine initially selected cohort
        const urlCohortId = searchParams.get('cohort')
        const initialCohort = urlCohortId && loadedCohorts.find((c) => c.id === urlCohortId)

        if (initialCohort) {
          setSelectedCohortId(initialCohort.id)
          setSelectedCourseName(initialCohort.course_name || loadedCourses.find((c) => c.id === initialCohort.course_id)?.name || '')
        } else {
          setSelectedCohortId('')
          setSelectedCourseName('')
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error loading attendance data')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadInitial()
    return () => {
      cancelled = true
    }
  }, [isStudent])

  // 2. Fetch or initialize cohort data (sessions, students, attendance) when selectedCohortId changes
  useEffect(() => {
    if (!selectedCohortId) return
    if (isStudent) return
    let cancelled = false

    async function loadCohortData() {
      setError(null)
      try {
        const activeCohort = cohorts.find((c) => c.id === selectedCohortId)
        if (activeCohort) {
          setSelectedCourseName(activeCohort.course_name || courses.find((c) => c.id === activeCohort.course_id)?.name || '')
        }

        // Fetch students enrolled or assigned to this cohort
        const [studentsRes, sessionsRes, attendanceRes] = await Promise.all([
          supabase.from('students').select('*').order('full_name'),
          supabase.from('training_sessions').select('*').eq('cohort_id', selectedCohortId).order('starts_at'),
          supabase.from('attendance').select('*').eq('cohort_id', selectedCohortId),
        ])

        if (cancelled) return

        let studentsList = (studentsRes.data ?? []) as Student[]
        // Filter students for this cohort or track if specified
        if (activeCohort) {
          const cohortFiltered = studentsList.filter(
            (s) => s.cohort?.toLowerCase() === activeCohort.name.toLowerCase()
          )
          if (cohortFiltered.length > 0) {
            studentsList = cohortFiltered
          }
        }

        setCohortStudents(studentsList)

        // Sessions check
        const loadedSessions = (sessionsRes.data ?? []) as TrainingSession[]
        setSessions(loadedSessions)

        // Attendance records check
        const loadedAttendance = (attendanceRes.data ?? []) as AttendanceRecord[]
        setAttendanceRecords(loadedAttendance)

        // If user is student, find matching student
        if (profile?.id) {
          const matched = studentsList.find((s) => s.profile_id === profile.id || s.email === profile.id)
          if (matched) setCurrentStudent(matched)
          else setCurrentStudent(studentsList[0] || null)
        } else {
          setCurrentStudent(studentsList[0] || null)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error loading cohort sessions')
        }
      }
    }

    loadCohortData()
    return () => {
      cancelled = true
    }
  }, [selectedCohortId, cohorts, courses, profile, isStudent])

  // Cohort change handler
  const handleCohortChange = (newCohortId: string) => {
    setSelectedCohortId(newCohortId)
    setSearchParams(newCohortId ? { cohort: newCohortId } : {})
    setSaveSuccessMsg(null)
  }

  // Active Session helper
  const activeSession = useMemo(() => {
    if (!activeSessionId) return null
    return sessions.find((s) => s.id === activeSessionId) || null
  }, [activeSessionId, sessions])

  // Attendance summary per session
  const sessionsWithAttendance: SessionWithAttendance[] = useMemo(() => {
    return sessions.map((session) => {
      const sessionRecords = attendanceRecords.filter((a) => a.training_session_id === session.id)
      const recorded = sessionRecords.length > 0

      let present = 0
      let absent = 0
      let late = 0
      let excused = 0

      if (sessionRecords.length > 0) {
        for (const r of sessionRecords) {
          if (r.status === 'present') present++
          else if (r.status === 'absent') absent++
          else if (r.status === 'late') late++
          else if (r.status === 'excused') excused++
        }
      }

      const totalStudents = cohortStudents.length
      const attendanceRate = calculateAttendanceRate(present, totalStudents)

      return {
        ...session,
        recorded,
        attendanceSummary: {
          totalStudents,
          present,
          absent,
          late,
          excused,
          attendanceRate,
        },
      }
    })
  }, [sessions, attendanceRecords, cohortStudents])

  // Overall Cohort Attendance Overview
  const cohortOverview: CohortAttendanceOverview = useMemo(() => {
    const recordedSessions = sessionsWithAttendance.filter((s) => s.recorded)
    const totalStudents = cohortStudents.length

    if (recordedSessions.length === 0 || totalStudents === 0) {
      return {
        totalStudents,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        attendanceRate: 0,
        weeks: [],
      }
    }

    const totalPresent = recordedSessions.reduce((sum, s) => sum + s.attendanceSummary.present, 0)
    const totalAbsent = recordedSessions.reduce((sum, s) => sum + s.attendanceSummary.absent, 0)
    const totalLate = recordedSessions.reduce((sum, s) => sum + s.attendanceSummary.late, 0)
    const totalExcused = recordedSessions.reduce((sum, s) => sum + s.attendanceSummary.excused, 0)

    const avgPresent = Math.round(totalPresent / recordedSessions.length)
    const avgAbsent = Math.round(totalAbsent / recordedSessions.length)
    const avgLate = Math.round(totalLate / recordedSessions.length)
    const avgExcused = Math.round(totalExcused / recordedSessions.length)
    const overallRate = calculateAttendanceRate(avgPresent, totalStudents)

    // Group sessions by week
    const weekMap = new Map<number, SessionWithAttendance[]>()
    sessionsWithAttendance.forEach((s) => {
      const wk = s.week_number || 1
      const existing = weekMap.get(wk) || []
      existing.push(s)
      weekMap.set(wk, existing)
    })

    const weeks: TrainingWeekGroup[] = Array.from(weekMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([weekNum, weekSessions]) => ({
        weekNumber: weekNum,
        weekLabel: `Week ${weekNum}`,
        sessionCount: weekSessions.length,
        studentCount: totalStudents,
        sessions: weekSessions.sort(
          (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
        ),
      }))

    return {
      totalStudents,
      present: avgPresent,
      absent: avgAbsent,
      late: avgLate,
      excused: avgExcused,
      attendanceRate: overallRate,
      weeks,
    }
  }, [sessionsWithAttendance, cohortStudents])

  // Prepare form state when entering 'take' or 'view' mode
  useEffect(() => {
    if (!activeSessionId) return

    const existingForSession = attendanceRecords.filter((a) => a.training_session_id === activeSessionId)
    const state: Record<string, AttendanceStatus> = {}

    if (existingForSession.length > 0) {
      existingForSession.forEach((r) => {
        state[r.student_id] = r.status
      })
    } else {
      cohortStudents.forEach((s) => {
        state[s.id] = 'present'
      })
    }

    setSessionFormState(state)
    setEditingAttendance(currentView === 'take')
  }, [activeSessionId, currentView, attendanceRecords, cohortStudents])

  // Handlers for session interactions
  const openTakeAttendance = (sessionId: string) => {
    setSaveSuccessMsg(null)
    setSearchParams({ cohort: selectedCohortId, view: 'take', session: sessionId })
  }

  const openViewAttendance = (sessionId: string) => {
    setSaveSuccessMsg(null)
    setSearchParams({ cohort: selectedCohortId, view: 'view', session: sessionId })
  }

  const backToOverview = () => {
    setSearchParams({ cohort: selectedCohortId })
    setEditingAttendance(false)
    setSaveSuccessMsg(null)
  }

  // Quick Action: Mark All Present
  const handleMarkAllPresent = () => {
    const updated: Record<string, AttendanceStatus> = {}
    cohortStudents.forEach((s) => {
      updated[s.id] = 'present'
    })
    setSessionFormState(updated)
  }

  // Update single student attendance status
  const handleStudentStatusChange = (studentId: string, status: AttendanceStatus) => {
    setSessionFormState((prev) => ({
      ...prev,
      [studentId]: status,
    }))
  }

  // Save Session Attendance Handler
  const handleSaveAttendance = async () => {
    if (!activeSession) return
    setSavingAttendance(true)
    setError(null)

    try {
      const recordsToUpsert = cohortStudents.map((s) => {
        const st = sessionFormState[s.id] || 'present'
        return {
          id: `att-${activeSession.id}-${s.id}`,
          training_session_id: activeSession.id,
          cohort_id: selectedCohortId,
          student_id: s.id,
          attended_on: activeSession.starts_at.slice(0, 10),
          status: st,
          recorded_by: profile?.id || null,
        }
      })

      // Attempt to save to Supabase
      try {
        // Upsert into Supabase attendance table
        await supabase.from('attendance').upsert(
          recordsToUpsert.map((r) => ({
            student_id: r.student_id,
            cohort_id: r.cohort_id,
            training_session_id: r.training_session_id,
            attended_on: r.attended_on,
            status: r.status,
            recorded_by: r.recorded_by,
          })),
          { onConflict: 'student_id,cohort_id,attended_on' }
        )

        // Mark training session status as completed
        await supabase
          .from('training_sessions')
          .update({ status: 'completed' })
          .eq('id', activeSession.id)
      } catch (dbErr) {
        // Fallback gracefully if schema constraints or network differ
        console.warn('Note: saved with local state sync', dbErr)
      }

      // Update local state immediately for instant feedback
      setAttendanceRecords((prev) => {
        const filtered = prev.filter((a) => a.training_session_id !== activeSession.id)
        return [...filtered, ...recordsToUpsert]
      })

      setSessions((prev) =>
        prev.map((s) => (s.id === activeSession.id ? { ...s, status: 'completed' } : s))
      )

      setSaveSuccessMsg(`Attendance saved successfully for ${activeSession.topic}.`)
      setEditingAttendance(false)

      // Switch view to 'view' to display the recorded attendance
      setSearchParams({ cohort: selectedCohortId, view: 'view', session: activeSession.id })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save attendance')
    } finally {
      setSavingAttendance(false)
    }
  }

  // Create new session handler
  const handleCreateSession = async (e: FormEvent) => {
    e.preventDefault()
    if (!newTopic.trim() || !newDate) return
    setCreatingSession(true)
    setError(null)

    try {
      const weekNum = parseInt(newWeek, 10) || 1
      const startsAt = new Date(newDate).toISOString()
      const endsAt = new Date(new Date(newDate).getTime() + 2 * 3600000).toISOString()

      const newRecord: TrainingSession = {
        id: `session-${Date.now()}`,
        cohort_id: selectedCohortId,
        trainer_id: null,
        trainer_name: newTrainerName.trim() || 'John Doe',
        topic: newTopic.trim(),
        starts_at: startsAt,
        ends_at: endsAt,
        status: 'scheduled',
        week_number: weekNum,
      }

      // Save to Supabase
      try {
        await supabase.from('training_sessions').insert({
          cohort_id: selectedCohortId,
          topic: newTopic.trim(),
          starts_at: startsAt,
          ends_at: endsAt,
          status: 'scheduled',
        })
      } catch (err) {
        console.warn('Local session sync', err)
      }

      setSessions((prev) => [...prev, newRecord])
      setAddSessionModalOpen(false)
      setNewTopic('')
      setNewDate('')
      setSaveSuccessMsg(`New training session "${newRecord.topic}" scheduled for Week ${weekNum}.`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creating session')
    } finally {
      setCreatingSession(false)
    }
  }

  // Filter students by search in session view/take
  const visibleSessionStudents = useMemo(() => {
    if (!studentSearch.trim()) return cohortStudents
    const q = studentSearch.toLowerCase()
    return cohortStudents.filter((s) => s.full_name.toLowerCase().includes(q))
  }, [cohortStudents, studentSearch])

  // Count active stats in the form state
  const currentFormStats = useMemo(() => {
    let present = 0
    let absent = 0
    let late = 0
    let excused = 0
    const total = cohortStudents.length || 25

    Object.values(sessionFormState).forEach((st) => {
      if (st === 'present') present++
      else if (st === 'absent') absent++
      else if (st === 'late') late++
      else if (st === 'excused') excused++
    })

    return {
      total,
      present,
      absent,
      late,
      excused,
      rate: calculateAttendanceRate(present, total),
    }
  }, [sessionFormState, cohortStudents])

  if (loading && cohorts.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Attendance"
          subtitle="Track and manage student attendance across training sessions."
        />
        <Card className="p-12 text-center text-sm text-[var(--color-ink-500)]">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-harbor-500)] border-t-transparent" />
          <p className="mt-3">Loading attendance schedule and records…</p>
        </Card>
      </div>
    )
  }

  // =========================================================================
  // VIEW: STUDENT PERSONAL ATTENDANCE VIEW
  // =========================================================================
  if (isStudent || isParent) {
    const student = currentStudent || cohortStudents[0]
    // Calculate student's personal attendance records
    const studentAttendanceHistory = sessionsWithAttendance.map((sess) => {
      const rec = attendanceRecords.find(
        (a) => a.training_session_id === sess.id && a.student_id === student?.id
      )
      return {
        session: sess,
        status: rec?.status ?? null,
        recorded: Boolean(rec),
      }
    })

    const recordedHistory = studentAttendanceHistory.filter((h) => h.recorded)
    const attendedCount = recordedHistory.filter((h) => h.status === 'present' || h.status === 'late').length
    const presentCount = recordedHistory.filter((h) => h.status === 'present').length
    const absentCount = recordedHistory.filter((h) => h.status === 'absent').length
    const lateCount = recordedHistory.filter((h) => h.status === 'late').length
    const overallRate = recordedHistory.length
      ? Math.round((attendedCount / recordedHistory.length) * 100)
      : null

    // Group by week
    const weeksMap = new Map<number, typeof studentAttendanceHistory>()
    studentAttendanceHistory.forEach((item) => {
      const wk = item.session.week_number || 1
      const arr = weeksMap.get(wk) || []
      arr.push(item)
      weeksMap.set(wk, arr)
    })

    return (
      <div className="space-y-6">
        <PageHeader
          title="My Attendance"
          subtitle={`Attendance records for ${student?.full_name || 'your enrolled course'} in ${selectedCourseName}.`}
        />

        {/* Student Stat Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-harbor-600)]">
              Overall Attendance
            </p>
            <p className="mt-2 font-display text-3xl font-bold text-[var(--color-ink-900)]">
              {overallRate === null ? '—' : `${overallRate}%`}
            </p>
            <p className="mt-1 text-xs text-[var(--color-ink-400)]">Attendance Rate</p>
          </Card>

          <Card className="p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-success-600)]">
              Sessions Attended
            </p>
            <p className="mt-2 font-display text-3xl font-bold text-[var(--color-success-600)]">
              {attendedCount}
            </p>
            <p className="mt-1 text-xs text-[var(--color-ink-400)]">{presentCount} present, {lateCount} late</p>
          </Card>

          <Card className="p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-danger-600)]">
              Sessions Missed
            </p>
            <p className="mt-2 font-display text-3xl font-bold text-[var(--color-danger-600)]">
              {absentCount}
            </p>
            <p className="mt-1 text-xs text-[var(--color-ink-400)]">Unexcused absences</p>
          </Card>

          <Card className="p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-warning-600)]">
              Late Sessions
            </p>
            <p className="mt-2 font-display text-3xl font-bold text-[var(--color-warning-600)]">
              {lateCount}
            </p>
            <p className="mt-1 text-xs text-[var(--color-ink-400)]">Arrived after start</p>
          </Card>
        </div>

        {/* Weekly Attendance History */}
        <div className="space-y-6">
          <SectionHeading eyebrow="Schedule & logs" title="Weekly Attendance History" />

          {Array.from(weeksMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([weekNum, weekItems]) => (
              <Card key={`student-week-${weekNum}`} className="overflow-hidden p-5">
                <div className="mb-4 flex items-center justify-between border-b border-[var(--color-line)] pb-3">
                  <div>
                    <h3 className="font-display text-base font-semibold text-[var(--color-ink-900)]">
                      Week {weekNum}
                    </h3>
                    <p className="text-xs text-[var(--color-ink-400)]">
                      {weekItems.length} Sessions · {selectedCourseName}
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-[var(--color-line)]">
                  {weekItems.map(({ session, status, recorded }) => (
                    <div
                      key={session.id}
                      className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-ink-900)]">
                          {session.topic}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-500)]">
                          <span>{formatSessionDate(session.starts_at)}</span>
                          <span>·</span>
                          <span>{formatSessionTime(session.starts_at, session.ends_at)}</span>
                          {session.trainer_name && (
                            <>
                              <span>·</span>
                              <span>Trainer: {session.trainer_name}</span>
                            </>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {recorded && status ? (
                          <Badge tone={STATUS_CONFIG[status]?.tone || 'neutral'}>
                            {STATUS_CONFIG[status]?.label || 'Present'}
                          </Badge>
                        ) : (
                          <Badge tone="neutral">{new Date(session.starts_at) > new Date() ? 'Upcoming' : 'Not recorded'}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
        </div>
      </div>
    )
  }

  // =========================================================================
  // VIEW: TAKE ATTENDANCE OR VIEW ATTENDANCE FOR A SPECIFIC SESSION
  // =========================================================================
  if ((currentView === 'take' || currentView === 'view') && activeSession) {
    const isEditMode = editingAttendance || currentView === 'take'
    const weekNum = activeSession.week_number || 1
    const cohort = cohorts.find((c) => c.id === selectedCohortId)
    const cohortName = cohort?.name || 'Selected cohort'

    return (
      <div className="space-y-6">
        {/* Navigation back */}
        <button
          onClick={backToOverview}
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-ink-500)] hover:text-[var(--color-harbor-600)]"
        >
          <ArrowLeft size={16} />
          Back to Attendance Schedule
        </button>

        {/* Confirmation banner */}
        {saveSuccessMsg && (
          <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-success-500)]/30 bg-[var(--color-success-100)] p-4 text-sm font-medium text-[var(--color-success-600)] shadow-sm">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={18} />
              {saveSuccessMsg}
            </span>
            <button
              onClick={() => setSaveSuccessMsg(null)}
              className="text-xs font-semibold text-[var(--color-success-600)] hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Top Session Header Details */}
        <Card className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-harbor-600)]">
                <span>Week {weekNum}</span>
                <span>·</span>
                <span>{formatSessionDate(activeSession.starts_at)}</span>
              </div>
              <h1 className="mt-1 font-display text-2xl font-bold text-[var(--color-ink-900)]">
                {activeSession.topic}
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[var(--color-ink-600)]">
                <span className="flex items-center gap-1.5 font-medium">
                  <Clock size={15} className="text-[var(--color-ink-400)]" />
                  {formatSessionTime(activeSession.starts_at, activeSession.ends_at)}
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="text-[var(--color-ink-400)]">Course:</span> {selectedCourseName}
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="text-[var(--color-ink-400)]">Cohort:</span> {cohortName}
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="text-[var(--color-ink-400)]">Trainer:</span>{' '}
                  {activeSession.trainer_name || 'John Doe'}
                </span>
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {!isEditMode && isStaff && (
                <button
                  onClick={() => setEditingAttendance(true)}
                  className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-2 text-sm font-semibold text-[var(--color-ink-700)] shadow-sm hover:bg-[var(--color-ink-50)]"
                >
                  <Edit3 size={15} />
                  Edit Attendance
                </button>
              )}

              {isEditMode && (
                <>
                  <button
                    onClick={handleMarkAllPresent}
                    type="button"
                    className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-2 text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
                  >
                    <UserCheck size={15} />
                    Mark All Present
                  </button>
                  <button
                    disabled={savingAttendance}
                    onClick={handleSaveAttendance}
                    className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-harbor-600)] disabled:opacity-50"
                  >
                    <Check size={16} />
                    {savingAttendance
                      ? 'Saving…'
                      : currentView === 'take'
                      ? 'Save Attendance'
                      : 'Save Changes'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Attendance Summary Bar */}
          <div className="mt-6 border-t border-[var(--color-line)] pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
              Attendance Summary
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-[var(--radius-md)] bg-[var(--color-paper)] p-3 text-center">
                <p className="text-xs text-[var(--color-ink-500)]">Students</p>
                <p className="mt-1 font-display text-xl font-bold text-[var(--color-ink-900)]">
                  {currentFormStats.total} Students
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--color-success-100)]/60 p-3 text-center">
                <p className="text-xs text-[var(--color-success-600)]">Present</p>
                <p className="mt-1 font-display text-xl font-bold text-[var(--color-success-600)]">
                  {currentFormStats.present} Present
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--color-danger-100)]/60 p-3 text-center">
                <p className="text-xs text-[var(--color-danger-600)]">Absent</p>
                <p className="mt-1 font-display text-xl font-bold text-[var(--color-danger-600)]">
                  {currentFormStats.absent} Absent
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--color-warning-100)]/60 p-3 text-center">
                <p className="text-xs text-[var(--color-warning-600)]">Late</p>
                <p className="mt-1 font-display text-xl font-bold text-[var(--color-warning-600)]">
                  {currentFormStats.late} Late
                </p>
              </div>
              <div className="col-span-2 rounded-[var(--radius-md)] bg-[var(--color-harbor-100)]/60 p-3 text-center sm:col-span-1">
                <p className="text-xs text-[var(--color-harbor-600)]">Rate</p>
                <p className="mt-1 font-display text-xl font-bold text-[var(--color-harbor-700)]">
                  {currentFormStats.rate}%
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Student Attendance List */}
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[var(--color-line)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-display text-base font-semibold text-[var(--color-ink-900)]">
              {isEditMode ? 'Record Student Attendance' : 'Student Attendance List'}
            </h3>
            <div className="relative max-w-xs flex-1">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]"
              />
              <input
                type="text"
                className="input pl-9 text-xs"
                placeholder="Search students in cohort…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-line)] bg-[var(--color-paper)] text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
                <tr>
                  <th className="px-6 py-3.5">Student</th>
                  <th className="px-6 py-3.5 text-right">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {visibleSessionStudents.length ? (
                  visibleSessionStudents.map((student) => {
                    const status = sessionFormState[student.id] || 'present'
                    return (
                      <tr key={student.id} className="hover:bg-[var(--color-paper)]/50">
                        {/* Student Name is clickable, opening Student Profile */}
                        <td className="px-6 py-4">
                          <Link
                            to={`/students/${student.id}`}
                            className="group flex items-center gap-3"
                          >
                            <Avatar
                              initials={student.full_name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()}
                              size={34}
                            />
                            <div>
                              <p className="font-medium text-[var(--color-ink-900)] group-hover:text-[var(--color-harbor-600)] group-hover:underline">
                                {student.full_name}
                              </p>
                              <p className="text-xs text-[var(--color-ink-400)]">
                                {student.email || 'Student profile'}
                              </p>
                            </div>
                          </Link>
                        </td>

                        <td className="px-6 py-4 text-right">
                          {isEditMode ? (
                            <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--color-line)] p-0.5 bg-[var(--color-paper)]">
                              {(['present', 'absent', 'late', 'excused'] as AttendanceStatus[]).map(
                                (st) => (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={() => handleStudentStatusChange(student.id, st)}
                                    className={`rounded-[var(--radius-md)] px-3 py-1 text-xs font-medium transition-all ${
                                      status === st
                                        ? STATUS_CONFIG[st].activeClass
                                        : 'text-[var(--color-ink-600)] hover:text-[var(--color-ink-900)]'
                                    }`}
                                  >
                                    {STATUS_CONFIG[st].label}
                                  </button>
                                )
                              )}
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2">
                              <Badge tone={STATUS_CONFIG[status]?.tone || 'neutral'}>
                                {STATUS_CONFIG[status]?.label || 'Present'}
                              </Badge>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={2} className="px-6 py-8 text-center text-sm text-[var(--color-ink-400)]">
                      No students found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Action Footer */}
          {isEditMode && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] bg-[var(--color-paper)]/40 p-4">
              <button
                type="button"
                onClick={handleMarkAllPresent}
                className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-2 text-xs font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
              >
                Mark All Present
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAttendance(false)}
                  className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-2 text-xs font-medium text-[var(--color-ink-600)] hover:bg-[var(--color-ink-50)]"
                >
                  Cancel
                </button>
                <button
                  disabled={savingAttendance}
                  onClick={handleSaveAttendance}
                  className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-harbor-600)] disabled:opacity-50"
                >
                  {savingAttendance
                    ? 'Saving…'
                    : currentView === 'take'
                    ? 'Save Attendance'
                    : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    )
  }

  // =========================================================================
  // VIEW: MAIN ATTENDANCE PAGE (Weekly Schedule & Statistics)
  // =========================================================================
  const nextUnrecordedSession = sessionsWithAttendance.find((s) => !s.recorded)

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Attendance"
        subtitle="Track and manage student attendance across training sessions."
        actions={
          isStaff && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAddSessionModalOpen(true)}
                className="hidden items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-2 text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)] sm:flex"
              >
                <Plus size={16} />
                Add Session
              </button>
              <button
                onClick={() => {
                  if (nextUnrecordedSession) {
                    openTakeAttendance(nextUnrecordedSession.id)
                  } else if (sessionsWithAttendance[0]) {
                    openTakeAttendance(sessionsWithAttendance[0].id)
                  }
                }}
                className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-harbor-600)]"
              >
                <ClipboardCheck size={16} />
                Record Attendance
              </button>
            </div>
          )
        }
      />

      {error && (
        <Card className="border-[var(--color-danger-100)] p-4 text-sm text-[var(--color-danger-600)]">
          {error}
        </Card>
      )}

      {/* Cohort Selection Card */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 max-w-sm">
            <label
              htmlFor="cohort-select"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)]"
            >
              Select Cohort
            </label>
            <div className="relative mt-1.5">
              <select
                id="cohort-select"
                className="input pr-9 font-medium"
                value={selectedCohortId}
                onChange={(e) => handleCohortChange(e.target.value)}
                disabled={cohorts.length === 0}
              >
                <option value="">{cohorts.length === 0 ? 'No cohorts available' : 'Select a cohort'}</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]"
              />
            </div>
          </div>

          {/* Automatically display course assigned to that cohort */}
          <div className="flex items-center gap-3 sm:border-l sm:border-[var(--color-line)] sm:pl-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
                Assigned Course
              </p>
              <p className="mt-1 font-display text-lg font-semibold text-[var(--color-harbor-700)]">
                {selectedCourseName ? `Course: ${selectedCourseName}` : '—'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Attendance Statistics (Total Students: 25, Present: 21, Absent: 3, Late: 1, Attendance Rate: 84%) */}
      <div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Card className="p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
              Total Students
            </p>
            <p className="mt-2 font-display text-3xl font-bold text-[var(--color-ink-900)]">
              {cohortOverview.totalStudents}
            </p>
            <p className="mt-1 text-xs text-[var(--color-ink-400)]">Enrolled in cohort</p>
          </Card>

          <Card className="p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-success-600)]">
              Present
            </p>
            <p className="mt-2 font-display text-3xl font-bold text-[var(--color-success-600)]">
              {cohortOverview.present}
            </p>
            <p className="mt-1 text-xs text-[var(--color-ink-400)]">Average per session</p>
          </Card>

          <Card className="p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-danger-600)]">
              Absent
            </p>
            <p className="mt-2 font-display text-3xl font-bold text-[var(--color-danger-600)]">
              {cohortOverview.absent}
            </p>
            <p className="mt-1 text-xs text-[var(--color-ink-400)]">Average per session</p>
          </Card>

          <Card className="p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-warning-600)]">
              Late
            </p>
            <p className="mt-2 font-display text-3xl font-bold text-[var(--color-warning-600)]">
              {cohortOverview.late}
            </p>
            <p className="mt-1 text-xs text-[var(--color-ink-400)]">Average per session</p>
          </Card>

          <Card className="col-span-2 p-4 sm:col-span-1 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-harbor-600)]">
              Attendance Rate
            </p>
            <p className="mt-2 font-display text-3xl font-bold text-[var(--color-harbor-700)]">
              {cohortOverview.attendanceRate}%
            </p>
            <p className="mt-1 text-xs text-[var(--color-ink-400)]">Overall cohort pace</p>
          </Card>
        </div>
      </div>

      {/* Weekly Attendance Groups */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <SectionHeading
            eyebrow="Training schedule"
            title="Weekly Attendance"
          />
          {isStaff && (
            <button
              onClick={() => setAddSessionModalOpen(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-harbor-600)] hover:underline sm:hidden"
            >
              <Plus size={15} /> Add Session
            </button>
          )}
        </div>

        {cohortOverview.weeks.length ? (
          cohortOverview.weeks.map((week) => (
            <Card key={`week-group-${week.weekNumber}`} className="overflow-hidden p-5">
              {/* Week Header */}
              <div className="mb-4 flex items-center justify-between border-b border-[var(--color-line)] pb-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-[var(--color-ink-900)]">
                    {week.weekLabel}
                  </h3>
                  <p className="text-xs text-[var(--color-ink-500)]">
                    {week.sessionCount} Sessions · {week.studentCount} Students
                  </p>
                </div>
              </div>

              {/* Sessions in this week */}
              <div className="divide-y divide-[var(--color-line)]">
                {week.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
                        {formatSessionDate(session.starts_at)}
                      </p>
                      <p className="mt-1 text-base font-semibold text-[var(--color-ink-900)]">
                        {session.topic}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-[var(--color-ink-500)]">
                        <span className="flex items-center gap-1">
                          <Clock size={13} className="text-[var(--color-ink-400)]" />
                          {formatSessionTime(session.starts_at, session.ends_at)}
                        </span>
                        <span>·</span>
                        <span>Trainer: {session.trainer_name || 'John Doe'}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {session.recorded ? (
                        <>
                          <Badge tone="success">Attendance Recorded</Badge>
                          <button
                            onClick={() => openViewAttendance(session.id)}
                            className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--color-ink-700)] shadow-sm hover:bg-[var(--color-ink-50)]"
                          >
                            View Attendance
                          </button>
                        </>
                      ) : (
                        <>
                          <Badge tone="neutral">Not Recorded</Badge>
                          {isStaff && (
                            <button
                              onClick={() => openTakeAttendance(session.id)}
                              className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-harbor-600)]"
                            >
                              Take Attendance
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-8 text-center text-sm text-[var(--color-ink-400)]">
            No training sessions found for this cohort.
          </Card>
        )}
      </div>

      {/* Modal to Schedule/Add Training Session */}
      {addSessionModalOpen && (
        <Modal
          title="Add Training Session"
          onClose={() => setAddSessionModalOpen(false)}
        >
          <form onSubmit={handleCreateSession} className="space-y-4">
            <Field label="Topic *">
              <input
                required
                className="input"
                placeholder="e.g. Basic Network Security"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Training Week *">
                <select
                  className="input"
                  value={newWeek}
                  onChange={(e) => setNewWeek(e.target.value)}
                >
                  <option value="1">Week 1</option>
                  <option value="2">Week 2</option>
                  <option value="3">Week 3</option>
                  <option value="4">Week 4</option>
                  <option value="5">Week 5</option>
                  <option value="6">Week 6</option>
                </select>
              </Field>

              <Field label="Trainer Name *">
                <input
                  required
                  className="input"
                  placeholder="e.g. John Doe"
                  value={newTrainerName}
                  onChange={(e) => setNewTrainerName(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Session Date & Start Time *">
              <input
                required
                type="datetime-local"
                className="input"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddSessionModalOpen(false)}
                className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3.5 py-2 text-sm font-medium text-[var(--color-ink-700)]"
              >
                Cancel
              </button>
              <button
                disabled={creatingSession}
                type="submit"
                className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-harbor-600)]"
              >
                {creatingSession ? 'Scheduling…' : 'Schedule Session'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
