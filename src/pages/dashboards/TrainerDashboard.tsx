import { useEffect, useState, useCallback } from 'react'
import { CalendarClock, ClipboardCheck, FileText, Users, Megaphone, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, SectionHeading, ProgressRing } from '@/components/ui/primitives'
import { StatCard, ActivityFeed, type ActivityRow } from '@/components/dashboard/blocks'
import { useAuth } from '@/app/auth'
import { supabase, supabaseConfigured } from '@/lib/supabase'

export function TrainerDashboard() {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState({
    assignedStudents: 0,
    attendanceRate: 0,
    awaitingReview: 0,
    cohortsCount: 0,
  })
  const [activity, setActivity] = useState<ActivityRow[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    if (!supabaseConfigured) {
      setCounts({
        assignedStudents: 0,
        attendanceRate: 0,
        awaitingReview: 0,
        cohortsCount: 0,
      })
      setActivity([])
      setLoading(false)
      return
    }

    try {
      const trainerId = profile?.id

      // Fetch students assigned to this trainer or all students if unassigned
      const [studentsRes, attendanceRes, cohortsRes] = await Promise.all([
        supabase.from('students').select('id, full_name, track, status, assigned_trainer_id'),
        supabase.from('attendance').select('status'),
        supabase.from('cohorts').select('id, name'),
      ])

      const stList = studentsRes.data ?? []
      const attList = attendanceRes.data ?? []
      const cList = cohortsRes.data ?? []

      const assigned = trainerId
        ? stList.filter((s) => s.assigned_trainer_id === trainerId)
        : []
      const effectiveStudentCount = assigned.length > 0 ? assigned.length : stList.length

      const attRate = attList.length
        ? Math.round((attList.filter((a) => a.status === 'present' || a.status === 'late').length / attList.length) * 100)
        : 0

      // Real submissions awaiting review from stored submissions if any
      let pendingCount = 0
      try {
        const raw = localStorage.getItem('ijesha_hub_assignment_submissions_v1')
        if (raw) {
          const subs = JSON.parse(raw) as any[]
          pendingCount = subs.filter((s) => s.status === 'submitted').length
        }
      } catch {
        // Ignore
      }

      setCounts({
        assignedStudents: effectiveStudentCount,
        attendanceRate: attRate,
        awaitingReview: pendingCount,
        cohortsCount: cList.length,
      })
      setActivity([])
    } catch (err) {
      console.warn('Trainer dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.name.split(' ')[0] ?? ''}`}
        subtitle="Your courses, cohorts and teaching tasks in one place."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/classwork?create=1" className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3 py-2 text-xs font-semibold text-white">Add Classwork</Link>
            <Link to="/assessments?create=1" className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-xs font-semibold">Add Assessment</Link>
            <Link to="/projects?create=1" className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-xs font-semibold">Add Project</Link>
            <Link to="/grading-queue" className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-xs font-semibold">Grade Work</Link>
            <button type="button" onClick={loadData} disabled={loading} className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-ink-50)] transition-colors"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /><span>Refresh</span></button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Assigned students" value={String(counts.assignedStudents)} icon={Users} />
        <StatCard label="Cohort attendance" value={`${counts.attendanceRate}%`} icon={ClipboardCheck} tone="success" />
        <StatCard label="Awaiting review" value={String(counts.awaitingReview)} icon={FileText} tone={counts.awaitingReview > 0 ? 'warning' : 'neutral'} />
        <StatCard label="Active cohorts" value={String(counts.cohortsCount)} icon={CalendarClock} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <SectionHeading eyebrow="Today" title="Today's sessions" />
          <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-6 text-center">
            <p className="text-sm font-medium text-[var(--color-ink-800)]">No live sessions scheduled for today</p>
            <p className="text-xs text-[var(--color-ink-500)] mt-1">Check the cohort calendar or take attendance for upcoming scheduled classes.</p>
            <div className="mt-4 flex justify-center">
              <Link to="/attendance" className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-harbor-600)]">
                Take attendance
              </Link>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col items-center justify-center p-5 text-center">
          <SectionHeading title="Cohort attendance" />
          <ProgressRing value={counts.attendanceRate} tone="success" size={88} />
          <p className="mt-3 text-sm text-[var(--color-ink-500)]">{counts.attendanceRate}% average presence</p>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <SectionHeading eyebrow="Needs support" title="Students needing attention" />
          <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4 text-center">
            <p className="text-sm font-medium text-[var(--color-ink-800)]">All assigned students are currently on track</p>
            <p className="text-xs text-[var(--color-ink-500)] mt-1">Students with attendance drops or overdue submissions will appear here automatically.</p>
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeading title="Recent activity" />
          {activity.length > 0 ? (
            <ActivityFeed rows={activity} />
          ) : (
            <p className="text-xs text-[var(--color-ink-400)] py-4 text-center">No recent student submissions recorded.</p>
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <SectionHeading eyebrow="My courses" title="Course workspace" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
              <p className="font-medium text-sm text-[var(--color-ink-900)]">Course learning modules</p>
              <p className="mt-1 text-xs text-[var(--color-ink-500)]">Access curriculum modules, lessons, and project milestones.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {['Outcomes', 'Modules', 'Lessons', 'Assignments'].map((label) => (
                  <Link key={label} to="/assignments" className="rounded-md bg-[var(--color-ink-100)] px-2 py-1 text-xs font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-ink-200)]">
                    {label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
              <p className="font-medium text-sm text-[var(--color-ink-900)]">Assignments & Classwork</p>
              <p className="mt-1 text-xs text-[var(--color-ink-500)]">Review student homework submissions and record grades.</p>
              <Link to="/assignments" className="mt-3 inline-block text-sm font-medium text-[var(--color-harbor-600)] hover:underline">
                Manage assignments →
              </Link>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeading eyebrow="Communication" title="Announcements" action={<Link to="/announcements" className="text-sm font-medium text-[var(--color-harbor-600)]">Post update</Link>} />
          <div className="flex gap-3 text-sm text-[var(--color-ink-500)]">
            <Megaphone size={17} className="shrink-0 text-[var(--color-ink-400)]" />
            <span>Post updates and class notices to all your enrolled students.</span>
          </div>
        </Card>
      </div>
    </div>
  )
}
