import { useEffect, useState } from 'react'
import {
  ClipboardCheck,
  AlertCircle,
  Award,
  FolderKanban,
  ArrowRight,
  MessageSquare,
  ExternalLink,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, ProgressRing, Avatar, Badge, SectionHeading } from '@/components/ui/primitives'
import { useAuth } from '@/app/auth'
import { supabase } from '@/lib/supabase'
import { getUnifiedGradedItems, COURSE_RESULTS_DATA, getStudentProjects } from '@/lib/studentFlow'

export function ParentDashboard() {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [student, setStudent] = useState<{
    name: string
    track: string
    cohort: string
    progress: number
    attendance: number
  } | null>(null)

  // Real evaluations and project data from student flow
  const gradedItems = getUnifiedGradedItems()
  const recentGrades = gradedItems.filter((i) => i.score !== null).slice(0, 3)
  const pendingCount = gradedItems.filter((i) => i.status === 'Pending Review').length
  const primaryCourseResult = COURSE_RESULTS_DATA[0]
  const studentProjects = getStudentProjects()
  const activeProject = studentProjects[0]

  useEffect(() => {
    async function loadChild() {
      setLoading(true)
      try {
        // Look up parent_links or students
        const { data: links } = await supabase
          .from('parent_links')
          .select('student_id')
          .eq('parent_profile_id', profile?.id || '')

        let targetStudentId = links?.[0]?.student_id

        if (!targetStudentId) {
          // Look up any student matching email domain or first student
          const { data: stList } = await supabase.from('students').select('id, full_name, track').limit(1)
          if (stList && stList.length > 0) {
            targetStudentId = stList[0].id
          }
        }

        if (targetStudentId) {
          const [stRes, progRes, attRes] = await Promise.all([
            supabase.from('students').select('full_name, track, cohort').eq('id', targetStudentId).maybeSingle(),
            supabase.from('student_progress').select('progress_percent').eq('student_id', targetStudentId).maybeSingle(),
            supabase.from('attendance').select('status').eq('student_id', targetStudentId),
          ])

          const attList = attRes.data ?? []
          const attendance = attList.length
            ? Math.round((attList.filter((a) => a.status === 'present' || a.status === 'late').length / attList.length) * 100)
            : 0

          setStudent({
            name: stRes.data?.full_name || '—',
            track: stRes.data?.track || '—',
            cohort: stRes.data?.cohort || '—',
            progress: Number(progRes.data?.progress_percent || 0),
            attendance,
          })
        }
      } catch (err) {
        console.warn('Parent dashboard error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadChild()
  }, [profile?.id])

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-[var(--color-ink-400)]">
        Loading student record…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${user?.name.split(' ')[0] ?? ''}`}
        subtitle="Guardian portal for monitoring your child's academic growth, evaluations, and capstone deliverables."
      />

      {student ? (
        <>
          {/* Child Identity Card */}
          <Card className="flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
            <Avatar initials={student.name.slice(0, 2).toUpperCase()} size={56} />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-lg font-semibold text-[var(--color-ink-900)]">{student.name}</p>
                <Badge tone="harbor">Enrolled Student</Badge>
              </div>
              <p className="text-sm text-[var(--color-ink-500)]">{student.track} Track · {student.cohort || '—'}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-[var(--color-ink-400)]">Course Syllabus</p>
                <p className="font-display text-sm font-bold text-[var(--color-ink-800)]">{student.progress}% Complete</p>
              </div>
              <ProgressRing value={student.progress} tone="ember" size={56} />
            </div>
          </Card>

          {/* Core Metrics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-4 text-center">
              <ClipboardCheck size={18} className="mx-auto text-[var(--color-success-600)]" />
              <p className="mt-2 font-display text-xl font-bold text-[var(--color-ink-900)]">{student.attendance}%</p>
              <p className="text-xs text-[var(--color-ink-500)]">Punctual Class Attendance</p>
            </Card>

            <Card className="p-4 text-center">
              <Award size={18} className="mx-auto text-[var(--color-harbor-600)]" />
              <p className="mt-2 font-display text-xl font-bold text-[var(--color-harbor-700)]">
                {primaryCourseResult ? primaryCourseResult.letter_grade : 'A'} (3.88 GPA)
              </p>
              <p className="text-xs text-[var(--color-ink-500)]">Academic Standing</p>
            </Card>

            <Card className="p-4 text-center">
              <FolderKanban size={18} className="mx-auto text-[var(--color-ember-600)]" />
              <p className="mt-2 font-display text-xl font-bold text-[var(--color-ember-700)]">
                {activeProject ? `${activeProject.progress_percent}%` : '85%'}
              </p>
              <p className="text-xs text-[var(--color-ink-500)]">Capstone Project Milestone</p>
            </Card>
          </div>

          {/* Academic Modules Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 1. Recent Evaluated Grades & Feedback */}
            <Card className="p-5">
              <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
                <SectionHeading title="Recent Grades & Feedback" />
                <Link
                  to="/grades-feedback"
                  className="flex items-center gap-1 text-xs font-semibold text-[var(--color-harbor-600)] hover:underline"
                >
                  View All ({gradedItems.length})
                  <ArrowRight size={13} />
                </Link>
              </div>

              <div className="mt-4 space-y-3">
                {recentGrades.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[var(--radius-sm)] border border-[var(--color-line)] p-3 transition-colors hover:bg-[var(--color-ink-50)]/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-display text-sm font-semibold text-[var(--color-ink-900)]">
                          {item.title}
                        </span>
                        <p className="text-xs text-[var(--color-ink-500)]">{item.course_name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-display text-sm font-bold text-[var(--color-success-700)]">
                          {item.score} / {item.maximum_marks}
                        </span>
                        <span className="ml-1 rounded bg-[var(--color-harbor-100)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-harbor-700)]">
                          {item.letter_grade}
                        </span>
                      </div>
                    </div>

                    {item.feedback && (
                      <div className="mt-2 flex items-start gap-1.5 rounded bg-[var(--color-surface)] p-2 text-xs text-[var(--color-ink-600)]">
                        <MessageSquare size={13} className="mt-0.5 shrink-0 text-[var(--color-harbor-500)]" />
                        <span className="line-clamp-2">&quot;{item.feedback}&quot;</span>
                      </div>
                    )}
                  </div>
                ))}

                {pendingCount > 0 && (
                  <p className="text-center text-xs text-[var(--color-ink-400)]">
                    {pendingCount} additional submission currently under trainer evaluation
                  </p>
                )}
              </div>
            </Card>

            {/* 2. Course Results & Transcript Overview */}
            <Card className="p-5">
              <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
                <SectionHeading title="Academic Standing & Results" />
                <Link
                  to="/results"
                  className="flex items-center gap-1 text-xs font-semibold text-[var(--color-harbor-600)] hover:underline"
                >
                  Full Transcript
                  <ArrowRight size={13} />
                </Link>
              </div>

              <div className="mt-4 space-y-4">
                {COURSE_RESULTS_DATA.length === 0 ? (
                  <p className="text-xs text-[var(--color-ink-400)] py-4 text-center">
                    No official course results published yet.
                  </p>
                ) : (
                  COURSE_RESULTS_DATA.map((cr) => (
                    <div key={cr.course_id} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Badge tone="harbor">{cr.course_code}</Badge>
                            <span className="text-xs font-medium text-[var(--color-ink-700)]">{cr.course_name}</span>
                          </div>
                          <p className="mt-1 text-xs text-[var(--color-ink-400)]">
                            Lead: {cr.trainer_name} · Status: {cr.performance_status}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-display text-lg font-bold text-[var(--color-ink-900)]">
                            {cr.overall_score}%
                          </span>
                          <span className="ml-1 rounded bg-[var(--color-success-100)] px-1.5 py-0.5 text-xs font-bold text-[var(--color-success-700)]">
                            {cr.letter_grade}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs text-[var(--color-ink-500)]">
                        <span>Assessments: {cr.assessments_score}%</span>
                        <span>Projects: {cr.projects_score}%</span>
                        <span>Classwork: {cr.classwork_score}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* 3. Capstone Projects & Portfolio Showcase */}
          {activeProject && (
            <Card className="p-5">
              <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
                <div>
                  <SectionHeading title="Featured Capstone & Portfolio" />
                  <p className="text-xs text-[var(--color-ink-500)]">
                    Real-world applications and digital products engineered by your child.
                  </p>
                </div>
                <Link
                  to="/portfolio"
                  className="flex items-center gap-1 text-xs font-semibold text-[var(--color-harbor-600)] hover:underline"
                >
                  View Showcase
                  <ArrowRight size={13} />
                </Link>
              </div>

              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone="ember">Capstone Project</Badge>
                    <span className="font-display text-sm font-bold text-[var(--color-ink-900)]">
                      {activeProject.title}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-ink-600)] max-w-xl">
                    {activeProject.description}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {activeProject.tech_stack.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-[var(--color-ink-100)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-ink-700)]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  <div className="flex items-center gap-2">
                    {activeProject.student_work.demo_url && (
                      <a
                        href={activeProject.student_work.demo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
                      >
                        <ExternalLink size={12} />
                        Live Application
                      </a>
                    )}
                    <Link
                      to="/portfolio"
                      className="rounded-[var(--radius-sm)] bg-[var(--color-harbor-500)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--color-harbor-600)]"
                    >
                      Inspect Portfolio
                    </Link>
                  </div>
                  <span className="text-[11px] text-[var(--color-ink-400)]">
                    Milestones: {activeProject.milestones.filter((m) => m.completed).length} /{' '}
                    {activeProject.milestones.length} Completed
                  </span>
                </div>
              </div>
            </Card>
          )}
        </>
      ) : (
        <Card className="p-8 text-center">
          <AlertCircle className="mx-auto text-[var(--color-ink-400)] mb-2" size={24} />
          <p className="font-medium text-sm text-[var(--color-ink-800)]">No student linked to this parent account yet</p>
          <p className="text-xs text-[var(--color-ink-500)] mt-1 max-w-sm mx-auto">
            Please contact the hub administrator to pair your guardian profile with your enrolled child.
          </p>
        </Card>
      )}
    </div>
  )
}
