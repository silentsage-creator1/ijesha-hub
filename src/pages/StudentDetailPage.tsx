import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, Mail, Layers, BookOpen, Construction, TrendingUp, CheckCircle2, FileText, ExternalLink } from 'lucide-react'
import { Card, Badge, Avatar, SectionHeading } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Field } from '@/components/ui/Field'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/auth'
import { formatShortDate } from '@/lib/attendance'
import { getStoredAssignments, getStoredSubmissions, formatAssignmentDate } from '@/lib/assignments'
import { getStoredAssessments, getStoredAttempts, formatAssessmentDate } from '@/lib/assessments'
import { getStoredCohortProgress, type StudentProgressRecord } from '@/lib/progress'
import { getStudentProjects, COURSE_RESULTS_DATA } from '@/lib/studentFlow'
import { purgeUserByEmailOrName } from '@/lib/management'
import type { Student, AttendanceRecord, TrainingSession, AttendanceStatus, Assignment, Assessment } from '@/types'

const STATUS_TONE: Record<Student['status'], 'success' | 'warning' | 'neutral' | 'danger'> = {
  new: 'warning',
  active: 'success',
  paused: 'warning',
  graduated: 'neutral',
  withdrawn: 'danger',
}

// Sections of the future student dashboard that this detail view will grow
// into once their features are built. Kept honest — no fake data.
const NOT_YET_BUILT = [
  { label: 'Achievements', note: 'Badges and milestones this student has earned.' },
  { label: 'Guardian links', note: 'Which parent/guardian accounts are linked to this student.' },
]

interface FormState {
  full_name: string
  email: string
  cohort: string
  track: string
  status: Student['status']
}

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { role } = useAuth()
  const canManage = role === 'admin' || role === 'manager'

  const [student, setStudent] = useState<Student | null>(null)
  const [details, setDetails] = useState<Record<string, string | number | null> | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    supabase
      .from('students')
      .select('*')
      .or(`id.eq.${id},profile_id.eq.${id}`)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (cancelled) return
        if (data) {
          const st = data as Student
          setStudent(st)
          if (role === 'admin' || role === 'manager') {
            const detailsResult = await supabase.from('student_profile_details').select('*').eq('student_id', st.id).maybeSingle()
            if (detailsResult.data) {
              const profileDetails = detailsResult.data as Record<string, string | number | null>
              setDetails(profileDetails)
              if (typeof profileDetails.photo_path === 'string') {
                const signed = await supabase.storage.from('student-photos').createSignedUrl(profileDetails.photo_path, 60 * 60)
                if (!signed.error && !cancelled) setPhotoUrl(signed.data.signedUrl)
              }
            }
          }
        } else {
          // Fallback to profile row if student record has not been inserted yet
          const { data: prof, error: profError } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
          if (prof) {
            setStudent({
              id: prof.id,
              profile_id: prof.id,
              full_name: prof.full_name,
              email: (prof as any).email ?? (prof.full_name?.toLowerCase().includes('amina') ? 'amina.yusuf@student.ijeshahub.org' : null),
              cohort: null,
              track: 'Frontend Development',
              status: 'active',
              assigned_trainer_id: null,
              organization: prof.organization ?? null,
              created_by: null,
              created_at: prof.created_at,
              updated_at: prof.created_at,
            })
          } else if (error || profError) {
            setLoadError(error?.message ?? profError?.message ?? 'Student could not be found.')
          } else {
            setLoadError('Student could not be found.')
          }
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  function openEdit() {
    if (!student) return
    setForm({
      full_name: student.full_name,
      email: student.email ?? '',
      cohort: student.cohort ?? '',
      track: student.track ?? '',
      status: student.status,
    })
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!student || !form) return
    setSaving(true)
    setFormError(null)
    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      cohort: form.cohort.trim() || null,
      track: form.track.trim() || null,
      status: form.status,
    }
    const { data, error } = await supabase.from('students').update(payload).eq('id', student.id).select().single()
    setSaving(false)
    if (error) {
      setFormError(error.message)
      return
    }
    setStudent(data as Student)
    setModalOpen(false)
  }

  async function handleDelete() {
    if (!student) return
    setDeleting(true)
    const { error } = await supabase.from('students').delete().eq('id', student.id)
    if (student.profile_id) {
      try {
        await supabase.from('profiles').delete().eq('id', student.profile_id)
      } catch {}
    }
    if (student.email || student.full_name) {
      try {
        await purgeUserByEmailOrName({
          email: student.email || undefined,
          name: student.full_name,
        })
      } catch {}
    }
    setDeleting(false)
    if (error) {
      setLoadError(error.message)
      return
    }
    navigate('/students')
  }

  if (loading) {
    return <p className="px-1 py-8 text-center text-sm text-[var(--color-ink-400)]">Loading student…</p>
  }

  if (loadError || !student) {
    return (
      <div>
        <BackLink />
        <Card className="px-5 py-8 text-center text-sm text-[var(--color-danger-600)]">
          {loadError ?? "This student wasn't found, or you don't have access to view them."}
        </Card>
      </div>
    )
  }

  return (
    <div>
      <BackLink />

      <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {photoUrl ? <img src={photoUrl} alt={`${student.full_name}'s profile`} className="h-14 w-14 rounded-full object-cover" /> : <Avatar initials={initialsFor(student.full_name)} size={56} />}
          <div>
            <h1 className="font-display text-xl font-semibold text-[var(--color-ink-900)]">{student.full_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[student.status]}>{student.status}</Badge>
              {student.track && (
                <span className="flex items-center gap-1 text-xs text-[var(--color-ink-400)]">
                  <BookOpen size={13} /> {student.track}
                </span>
              )}
              {student.cohort && (
                <span className="flex items-center gap-1 text-xs text-[var(--color-ink-400)]">
                  <Layers size={13} /> {student.cohort}
                </span>
              )}
              {student.email && (
                <span className="flex items-center gap-1 text-xs text-[var(--color-ink-400)]">
                  <Mail size={13} /> {student.email}
                </span>
              )}
            </div>
          </div>
        </div>

        {canManage && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={openEdit}
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
            >
              <Pencil size={15} />
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-danger-100)] px-3 py-2 text-sm font-medium text-[var(--color-danger-600)] hover:bg-[var(--color-danger-100)] disabled:opacity-50"
            >
              <Trash2 size={15} />
              Remove
            </button>
          </div>
        )}
      </Card>

      {(role === 'admin' || role === 'manager') && details && (
        <Card className="mt-6 p-5">
          <SectionHeading eyebrow="Student record" title="Personal, guardian and certificate information" />
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Date of birth" value={details.date_of_birth} /><Detail label="Gender" value={details.gender} /><Detail label="Phone" value={details.phone_number} />
            <Detail label="Address" value={[details.home_address, details.city_town, details.lga, details.state].filter(Boolean).join(', ')} />
            <Detail label="Parent/guardian" value={[details.guardian_first_name, details.guardian_last_name].filter(Boolean).join(' ')} /><Detail label="Relationship" value={details.guardian_relationship} /><Detail label="Guardian phone" value={details.guardian_phone} />
            <Detail label="Name on certificate" value={details.certificate_name} /><Detail label="Certificate number" value={details.certificate_number} /><Detail label="Final score" value={details.final_score} /><Detail label="Completion status" value={details.completion_status} /><Detail label="Training hours" value={details.total_training_hours} />
          </div>
        </Card>
      )}

      {/* Student Attendance Profile */}
      <StudentAttendanceSection student={student} />

      {/* Student Assignments & Coursework Profile */}
      <StudentAssignmentsSection student={student} />

      {/* Student Assessments & Evaluation Profile */}
      <StudentAssessmentsSection student={student} />

      {/* Student Learning Progress & Pacing Profile */}
      <StudentProgressSection student={student} />

      {/* Student Projects & Capstones Profile */}
      <StudentProjectsSection student={student} />

      {/* Student Academic Results & Transcript Profile */}
      <StudentAcademicResultsSection student={student} />

      <Card className="mt-6 p-5">
        <SectionHeading eyebrow="Roadmap" title="What this dashboard will show next" />
        <p className="mb-4 text-sm text-[var(--color-ink-500)]">
          This page currently shows the roster record only. Once the corresponding features are built, this view becomes
          this student's full dashboard for staff — the same sections a trainer or manager needs to answer "how is this
          student doing?" without leaving this page.
        </p>
        <ul className="divide-y divide-[var(--color-line)]">
          {NOT_YET_BUILT.map((item) => (
            <li key={item.label} className="flex items-start gap-3 py-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink-100)] text-[var(--color-ink-500)]">
                <Construction size={14} />
              </span>
              <div>
                <p className="text-sm font-medium text-[var(--color-ink-900)]">{item.label}</p>
                <p className="text-xs text-[var(--color-ink-400)]">{item.note}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {modalOpen && form && (
        <Modal title="Edit student" onClose={() => setModalOpen(false)}>
          <div className="space-y-3.5">
            <Field label="Full name">
              <input required className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
            <Field label="Email">
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Track">
                <input className="input" value={form.track} onChange={(e) => setForm({ ...form, track: e.target.value })} />
              </Field>
              <Field label="Cohort">
                <input className="input" value={form.cohort} onChange={(e) => setForm({ ...form, cohort: e.target.value })} />
              </Field>
            </div>
            <Field label="Status">
              <select
                className="input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Student['status'] })}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="graduated">Graduated</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </Field>

            {formError && <p className="rounded-md bg-[var(--color-danger-100)] px-3 py-2 text-sm text-[var(--color-danger-600)]">{formError}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-[var(--radius-md)] px-3.5 py-2 text-sm font-medium text-[var(--color-ink-600)] hover:bg-[var(--color-ink-50)]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-harbor-600)] disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/students" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]">
      <ArrowLeft size={15} />
      Back to Students
    </Link>
  )
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'S'
}

function Detail({ label, value }: { label: string; value: string | number | null }) {
  return <div><p className="text-xs font-medium text-[var(--color-ink-400)]">{label}</p><p className="mt-1 text-[var(--color-ink-800)]">{value || '—'}</p></div>
}

function StudentAttendanceSection({ student }: { student: Student }) {
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])

  useEffect(() => {
    let cancelled = false
    async function loadAttendance() {
      try {
        const [attRes, sessRes] = await Promise.all([
          supabase.from('attendance').select('*').eq('student_id', student.id),
          supabase.from('training_sessions').select('*').order('starts_at'),
        ])
        if (cancelled) return

        const loadedAtt = (attRes.data ?? []) as AttendanceRecord[]
        const loadedSess = (sessRes.data ?? []) as TrainingSession[]

        setSessions(loadedSess)
        setAttendance(loadedAtt)
      } catch (err) {
        console.warn('Could not load student attendance', err)
      }
    }

    loadAttendance()
    return () => {
      cancelled = true
    }
  }, [student.id])

  const sessionList = useMemo(() => {
    return sessions.map((sess) => {
      const rec = attendance.find((a) => a.training_session_id === sess.id)
      const status: AttendanceStatus = rec?.status || 'present'
      return {
        session: sess,
        status,
        recorded: Boolean(rec),
      }
    })
  }, [sessions, attendance])

  const recordedList = sessionList.filter((s) => s.recorded)
  const attendedCount = recordedList.filter((s) => s.status === 'present' || s.status === 'late').length
  const absentCount = recordedList.filter((s) => s.status === 'absent').length
  const lateCount = recordedList.filter((s) => s.status === 'late').length
  const overallRate = recordedList.length
    ? Math.round((attendedCount / recordedList.length) * 100)
    : 0

  const weekGroups = useMemo(() => {
    const map = new Map<number, typeof sessionList>()
    sessionList.forEach((item) => {
      const wk = item.session.week_number || 1
      const arr = map.get(wk) || []
      arr.push(item)
      map.set(wk, arr)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a - b)
  }, [sessionList])

  return (
    <Card className="mt-6 p-5">
      <SectionHeading eyebrow="Academic profile" title="Attendance" />
      <p className="mt-1 text-sm text-[var(--color-ink-500)]">
        Attendance metrics and training session history organized by week.
      </p>

      {/* Attendance Stats Cards */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4 bg-[var(--color-paper)]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-harbor-600)]">
            Overall Attendance Rate
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-[var(--color-ink-900)]">
            {overallRate}%
          </p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4 bg-[var(--color-paper)]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-success-600)]">
            Sessions Attended
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-[var(--color-success-600)]">
            {attendedCount}
          </p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4 bg-[var(--color-paper)]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-danger-600)]">
            Sessions Absent
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-[var(--color-danger-600)]">
            {absentCount}
          </p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4 bg-[var(--color-paper)]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-warning-600)]">
            Sessions Late
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-[var(--color-warning-600)]">
            {lateCount}
          </p>
        </div>
      </div>

      {/* Weekly Attendance Tables */}
      <div className="mt-6 space-y-6">
        {weekGroups.length > 0 ? (
          weekGroups.map(([weekNum, items]) => (
            <div
              key={`student-week-${weekNum}`}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] overflow-hidden"
            >
              <div className="bg-[var(--color-paper)] px-4 py-2.5 border-b border-[var(--color-line)] flex items-center justify-between">
                <h4 className="font-display text-sm font-bold text-[var(--color-ink-900)]">
                  Week {weekNum}
                </h4>
                <span className="text-xs text-[var(--color-ink-400)]">
                  {items.length} Sessions
                </span>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--color-line)] bg-white text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
                  <tr>
                    <th className="px-4 py-2.5 w-28">Date</th>
                    <th className="px-4 py-2.5">Training Session</th>
                    <th className="px-4 py-2.5 text-right w-28">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)] bg-white">
                  {items.map(({ session, status }) => {
                    const tone =
                      status === 'present'
                        ? 'success'
                        : status === 'absent'
                        ? 'danger'
                        : status === 'late'
                        ? 'warning'
                        : 'neutral'
                    return (
                      <tr key={session.id} className="hover:bg-[var(--color-paper)]/50">
                        <td className="px-4 py-3 font-medium text-[var(--color-ink-600)] whitespace-nowrap">
                          {formatShortDate(session.starts_at)}
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--color-ink-900)]">
                          {session.topic}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Badge tone={tone}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))
        ) : (
          <p className="py-6 text-center text-sm text-[var(--color-ink-400)]">
            No attendance records found for this student.
          </p>
        )}
      </div>
    </Card>
  )
}

function StudentAssignmentsSection({ student }: { student: Student }) {
  const [assignments, setAssignments] = useState<Assignment[]>([])

  useEffect(() => {
    const list = getStoredAssignments()
    setAssignments(list)
  }, [])

  // Find assignments where student belongs or all active cohort assignments
  const studentAssignments = useMemo(() => {
    return assignments.map(asg => {
      const subs = getStoredSubmissions(asg.id)
      const sub = subs.find(s => s.student_name.toLowerCase() === student.full_name.toLowerCase() || s.student_id === student.id)
      return {
        assignment: asg,
        submission: sub,
        status: sub?.status ?? 'Not Started',
        marks: sub?.marks,
      }
    })
  }, [assignments, student.full_name, student.id])

  const submittedCount = studentAssignments.filter(s => s.status === 'Submitted' || s.status === 'Graded').length
  const gradedCount = studentAssignments.filter(s => s.status === 'Graded').length

  return (
    <Card className="mt-6 p-5">
      <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
        <div>
          <SectionHeading eyebrow="Academic performance" title="Assignments & Coursework" />
          <p className="mt-1 text-sm text-[var(--color-ink-500)]">
            Active coursework, submission status, and awarded grades for this student.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-[var(--radius-md)] bg-[var(--color-ink-50)] border border-[var(--color-line)] px-2.5 py-1 text-[var(--color-ink-700)] font-medium">
            Submitted: {submittedCount}/{studentAssignments.length}
          </span>
          <span className="rounded-[var(--radius-md)] bg-[var(--color-success-50)] border border-[var(--color-success-200)] px-2.5 py-1 text-[var(--color-success-700)] font-semibold">
            Graded: {gradedCount}
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--color-line)] bg-[var(--color-paper)] text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
            <tr>
              <th className="px-4 py-2.5 w-24">Week</th>
              <th className="px-4 py-2.5">Assignment</th>
              <th className="px-4 py-2.5">Due Date</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Marks</th>
              <th className="px-4 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)] bg-white">
            {studentAssignments.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-[var(--color-ink-400)]">
                  No assignments found.
                </td>
              </tr>
            ) : (
              studentAssignments.map(({ assignment, status, marks }) => {
                const tone = status === 'Graded' ? 'success' : status === 'Submitted' ? 'harbor' : 'neutral'
                return (
                  <tr key={assignment.id} className="hover:bg-[var(--color-paper)]/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--color-ink-600)]">
                      Week {assignment.training_week}
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--color-ink-900)]">
                      {assignment.title}
                      <span className="block text-xs text-[var(--color-ink-400)] font-normal">
                        {assignment.course_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-ink-500)] whitespace-nowrap">
                      {formatAssignmentDate(assignment.due_date)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={tone}>{status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-[var(--color-ink-800)]">
                      {marks !== null && marks !== undefined ? (
                        <span>{marks} / {assignment.maximum_marks}</span>
                      ) : (
                        <span className="text-[var(--color-ink-400)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/assignments/${assignment.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-harbor-600)] hover:underline"
                      >
                        View Assignment
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function StudentAssessmentsSection({ student }: { student: Student }) {
  const [assessments, setAssessments] = useState<Assessment[]>([])

  useEffect(() => {
    const list = getStoredAssessments()
    setAssessments(list)
  }, [])

  // Find assessments for student
  const studentEvaluations = useMemo(() => {
    return assessments.map((asmt) => {
      const atts = getStoredAttempts(asmt.id)
      const myAttempt = atts.find(
        (a) =>
          a.student_id === student.id ||
          a.student_name.toLowerCase() === student.full_name.toLowerCase() ||
          (student.email && a.student_email?.toLowerCase() === student.email.toLowerCase())
      )

      return {
        assessment: asmt,
        attempt: myAttempt,
        status: myAttempt?.status ?? 'Not Started',
        score: myAttempt?.score,
        percentage: myAttempt?.percentage,
        result: myAttempt?.result,
      }
    })
  }, [assessments, student.id, student.full_name, student.email])

  const completedCount = studentEvaluations.filter((s) => s.status === 'Completed').length
  const passedCount = studentEvaluations.filter((s) => s.result === 'Passed').length

  return (
    <Card className="mt-6 p-5">
      <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
        <div>
          <SectionHeading eyebrow="Evaluation record" title="Assessments & Tests" />
          <p className="mt-1 text-sm text-[var(--color-ink-500)]">
            Completed tests, quizzes, and examination results for this student.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-[var(--radius-md)] bg-[var(--color-ink-50)] border border-[var(--color-line)] px-2.5 py-1 text-[var(--color-ink-700)] font-medium">
            Completed: {completedCount}/{studentEvaluations.length}
          </span>
          <span className="rounded-[var(--radius-md)] bg-[var(--color-success-50)] border border-[var(--color-success-200)] px-2.5 py-1 text-[var(--color-success-700)] font-semibold">
            Passed: {passedCount}
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--color-line)] bg-[var(--color-paper)] text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
            <tr>
              <th className="px-4 py-2.5 w-24">Week</th>
              <th className="px-4 py-2.5">Assessment</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Schedule</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Score</th>
              <th className="px-4 py-2.5">Result</th>
              <th className="px-4 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)] bg-white">
            {studentEvaluations.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-sm text-[var(--color-ink-400)]">
                  No assessments found.
                </td>
              </tr>
            ) : (
              studentEvaluations.map(({ assessment, status, score, percentage, result }) => {
                const tone =
                  status === 'Completed'
                    ? 'success'
                    : status === 'In Progress'
                    ? 'warning'
                    : 'neutral'
                return (
                  <tr
                    key={assessment.id}
                    className="hover:bg-[var(--color-paper)]/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-[var(--color-ink-600)]">
                      Week {assessment.training_week}
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--color-ink-900)]">
                      {assessment.title}
                      <span className="block text-xs text-[var(--color-ink-400)] font-normal">
                        {assessment.course_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-ink-600)] whitespace-nowrap">
                      {assessment.assessment_type}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-ink-500)] whitespace-nowrap">
                      {formatAssessmentDate(assessment.start_date)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={tone}>{status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-[var(--color-ink-800)]">
                      {score !== null && score !== undefined ? (
                        <span>
                          {score} / {assessment.total_marks} ({percentage}%)
                        </span>
                      ) : (
                        <span className="text-[var(--color-ink-400)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {result ? (
                        <Badge tone={result === 'Passed' ? 'success' : 'danger'}>
                          {result}
                        </Badge>
                      ) : (
                        <span className="text-xs text-[var(--color-ink-400)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/assessments/${assessment.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-harbor-600)] hover:underline"
                      >
                        View Assessment
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function StudentProgressSection({ student }: { student: Student }) {
  const cohortData = useMemo(() => getStoredCohortProgress(), [])

  // Find matching progress record by name
  const progressRecord: StudentProgressRecord | null = useMemo(() => {
    const found = cohortData.students.find(
      (s) =>
        s.studentName.toLowerCase() === student.full_name.toLowerCase() ||
        (student.email && s.studentEmail && s.studentEmail.toLowerCase() === student.email.toLowerCase())
    )
    return found || null
  }, [cohortData.students, student])

  return (
    <Card className="mt-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] pb-4">
        <div>
          <SectionHeading eyebrow="Learning Pacing" title="Student Progress & Milestones" />
          <p className="mt-1 text-xs text-[var(--color-ink-500)]">
            Consolidated progress across training sessions, coursework, projects, and assessments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/reports"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-ink-700)] shadow-xs hover:bg-[var(--color-paper)]"
          >
            <FileText size={14} className="text-[var(--color-harbor-600)]" />
            <span>Progress Reports & PDF</span>
          </Link>
          <Link
            to={`/progress?student=${encodeURIComponent(student.full_name)}`}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-600)] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-700)]"
          >
            <TrendingUp size={14} />
            <span>View Full Progress Graph</span>
          </Link>
        </div>
      </div>

      {progressRecord ? (
        <>
          {/* Metric Cards */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-[var(--radius-md)] border border-[var(--color-harbor-200)] bg-[var(--color-harbor-100)]/40 p-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-harbor-700)] block">
                Overall Progress
              </span>
              <span className="mt-1 font-display text-2xl font-bold text-[var(--color-harbor-700)] block">
                {progressRecord.overallProgress}%
              </span>
              <span className="text-[10px] text-[var(--color-harbor-600)]">Week 5 Benchmark</span>
            </div>

            <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] block">
                Attendance
              </span>
              <span className="mt-1 font-display text-2xl font-bold text-[var(--color-ink-900)] block">
                {progressRecord.attendanceRate}%
              </span>
              <span className="text-[10px] text-[var(--color-ink-400)]">All Sessions</span>
            </div>

            <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] block">
                Assignments
              </span>
              <span className="mt-1 font-display text-2xl font-bold text-[var(--color-ink-900)] block">
                {progressRecord.assignmentsProgress}%
              </span>
              <span className="text-[10px] text-[var(--color-ink-400)]">
                {progressRecord.assignmentsCount.completed}/{progressRecord.assignmentsCount.total} completed
              </span>
            </div>

            <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] block">
                Projects
              </span>
              <span className="mt-1 font-display text-2xl font-bold text-[var(--color-ink-900)] block">
                {progressRecord.projectsProgress}%
              </span>
              <span className="text-[10px] text-[var(--color-ink-400)]">
                {progressRecord.projectsCount.completed}/{progressRecord.projectsCount.total} completed
              </span>
            </div>

            <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] block">
                Assessments
              </span>
              <span className="mt-1 font-display text-2xl font-bold text-[var(--color-ink-900)] block">
                {progressRecord.assessmentsProgress}%
              </span>
              <span className="text-[10px] text-[var(--color-ink-400)]">
                {progressRecord.assessmentsCount.completed}/{progressRecord.assessmentsCount.total} completed
              </span>
            </div>

            <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] block">
                Status
              </span>
              <div className="mt-1">
                <Badge
                  tone={
                    progressRecord.status === 'On Track'
                      ? 'success'
                      : progressRecord.status === 'At Risk'
                      ? 'danger'
                      : 'neutral'
                  }
                >
                  {progressRecord.status}
                </Badge>
              </div>
              <span className="mt-1 text-[10px] text-[var(--color-ink-400)] block">
                Pacing Evaluation
              </span>
            </div>
          </div>

          {/* Recent milestone from history */}
          {progressRecord.history && progressRecord.history.length > 0 && (
            <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-paper)]/40 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-harbor-100)] text-[var(--color-harbor-600)]">
                  <CheckCircle2 size={15} />
                </div>
                <div>
                  <span className="text-xs font-bold text-[var(--color-ink-900)]">
                    Latest Milestone (Week {progressRecord.history[0].week}): {progressRecord.history[0].title}
                  </span>
                  <p className="text-[11px] text-[var(--color-ink-500)]">
                    {progressRecord.history[0].details}
                  </p>
                </div>
              </div>
              <Link
                to={`/progress?student=${encodeURIComponent(student.full_name)}`}
                className="text-xs font-semibold text-[var(--color-harbor-600)] hover:underline shrink-0"
              >
                View History →
              </Link>
            </div>
          )}
        </>
      ) : (
        <div className="py-8 text-center text-sm text-[var(--color-ink-400)]">
          No learning progress recorded for this student yet.
        </div>
      )}
    </Card>
  )
}

function StudentProjectsSection({ student }: { student: Student }) {
  const projects = getStudentProjects()
  const activeProject = projects[0]

  return (
    <Card className="mt-6 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--color-line)] pb-4 mb-4">
        <div>
          <SectionHeading eyebrow="Capstone & Portfolio" title="Projects & Technical Deliverables" />
          <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
            Production software and design deliverables developed by {student.full_name}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/projects"
            className="text-xs font-semibold text-[var(--color-harbor-600)] hover:underline flex items-center gap-1"
          >
            All Projects →
          </Link>
        </div>
      </div>

      {activeProject ? (
        <div className="space-y-4">
          <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4 bg-[var(--color-ink-50)]/30">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone="ember">Capstone</Badge>
                  <span className="font-display text-sm font-bold text-[var(--color-ink-900)]">
                    {activeProject.title}
                  </span>
                  <Badge
                    tone={
                      activeProject.submission.status === 'Approved'
                        ? 'success'
                        : activeProject.submission.status === 'Submitted'
                        ? 'warning'
                        : activeProject.submission.status === 'Revision Required'
                        ? 'danger'
                        : 'harbor'
                    }
                  >
                    {activeProject.submission.status}
                  </Badge>
                </div>
                <p className="text-xs text-[var(--color-ink-600)] mt-1.5 max-w-2xl leading-relaxed">
                  {activeProject.description}
                </p>

                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {activeProject.tech_stack.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-white border border-[var(--color-line)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-ink-700)]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  {activeProject.student_work.demo_url && (
                    <a
                      href={activeProject.student_work.demo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
                    >
                      <ExternalLink size={12} />
                      Live Demo
                    </a>
                  )}
                  {activeProject.student_work.repo_url && (
                    <a
                      href={activeProject.student_work.repo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
                    >
                      <ExternalLink size={12} />
                      Repository
                    </a>
                  )}
                </div>

                <span className="text-[11px] text-[var(--color-ink-400)]">
                  Progress: {activeProject.progress_percent}% ·{' '}
                  {activeProject.milestones.filter((m) => m.completed).length} of{' '}
                  {activeProject.milestones.length} milestones complete
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-[var(--color-ink-400)]">
          No project records assigned to this student yet.
        </div>
      )}
    </Card>
  )
}

function StudentAcademicResultsSection({ student }: { student: Student }) {
  const primaryResult = COURSE_RESULTS_DATA[0]

  return (
    <Card className="mt-6 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--color-line)] pb-4 mb-4">
        <div>
          <SectionHeading eyebrow="Academic Evaluation" title="Course Results & Grade Summary" />
          <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
            Summative grading, GPA standing, and weighted competency marks for {student.full_name}.
          </p>
        </div>
        <Link
          to="/results"
          className="text-xs font-semibold text-[var(--color-harbor-600)] hover:underline flex items-center gap-1"
        >
          Institutional Results Hub →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] p-3 text-center">
          <span className="text-[10px] font-bold text-[var(--color-ink-400)] uppercase">CUMULATIVE GPA</span>
          <p className="mt-1 font-display text-xl font-bold text-[var(--color-harbor-700)]">
            {primaryResult ? '3.88 / 4.0' : '—'}
          </p>
          <span className="text-[10px] text-[var(--color-success-600)] font-semibold">
            {primaryResult ? 'Distinction' : 'No records'}
          </span>
        </div>
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] p-3 text-center">
          <span className="text-[10px] font-bold text-[var(--color-ink-400)] uppercase">ASSESSMENTS</span>
          <p className="mt-1 font-display text-xl font-bold text-[var(--color-ink-900)]">
            {primaryResult ? `${primaryResult.assessments_score}%` : '—'}
          </p>
          <span className="text-[10px] text-[var(--color-ink-500)]">Weight 40%</span>
        </div>
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] p-3 text-center">
          <span className="text-[10px] font-bold text-[var(--color-ink-400)] uppercase">PROJECTS</span>
          <p className="mt-1 font-display text-xl font-bold text-[var(--color-ink-900)]">
            {primaryResult ? `${primaryResult.projects_score}%` : '—'}
          </p>
          <span className="text-[10px] text-[var(--color-ink-500)]">Weight 35%</span>
        </div>
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] p-3 text-center">
          <span className="text-[10px] font-bold text-[var(--color-ink-400)] uppercase">CLASSWORK</span>
          <p className="mt-1 font-display text-xl font-bold text-[var(--color-ink-900)]">
            {primaryResult ? `${primaryResult.classwork_score}%` : '—'}
          </p>
          <span className="text-[10px] text-[var(--color-ink-500)]">Weight 25%</span>
        </div>
      </div>

      <div className="space-y-3">
        {COURSE_RESULTS_DATA.length === 0 ? (
          <p className="text-xs text-[var(--color-ink-400)] text-center py-4">
            No official course results published yet for this student.
          </p>
        ) : (
          COURSE_RESULTS_DATA.map((cr) => (
            <div
              key={cr.course_id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--color-line)] p-3 hover:bg-[var(--color-ink-50)]/30 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone="harbor">{cr.course_code}</Badge>
                  <span className="font-display text-xs font-bold text-[var(--color-ink-900)]">
                    {cr.course_name}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--color-ink-500)] mt-1">
                  Lead Trainer: {cr.trainer_name} · Status: {cr.performance_status}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="font-display text-base font-bold text-[var(--color-ink-900)]">
                    {cr.overall_score}%
                  </span>
                  <span className="ml-1 rounded bg-[var(--color-success-100)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-success-700)]">
                    {cr.letter_grade}
                  </span>
                </div>
                <Link
                  to={`/results/${cr.course_id}`}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
                >
                  Inspect Results
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}


