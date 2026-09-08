import { useEffect, useState, useCallback } from 'react'
import { Layers, TrendingUp, Users, ClipboardCheck, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, SectionHeading, ProgressRing } from '@/components/ui/primitives'
import { StatCard, ActivityFeed, type ActivityRow } from '@/components/dashboard/blocks'
import { useAuth } from '@/app/auth'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { Link } from 'react-router-dom'

export function ManagerDashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState({
    students: 0,
    cohorts: 0,
    attendanceRate: 0,
    avgProgress: 0,
  })
  const [courseList, setCourseList] = useState<Array<{ id: string; name: string; cohorts: number; progress: number }>>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    if (!supabaseConfigured) {
      setCounts({
        students: 0,
        cohorts: 0,
        attendanceRate: 0,
        avgProgress: 0,
      })
      setCourseList([])
      setActivity([])
      setLoading(false)
      return
    }

    try {
      const [studentsRes, cohortsRes, coursesRes, attendanceRes, progressRes, profilesRes] = await Promise.all([
        supabase.from('students').select('id, status'),
        supabase.from('cohorts').select('id, name, course_id'),
        supabase.from('courses').select('id, name'),
        supabase.from('attendance').select('status'),
        supabase.from('student_progress').select('progress_percent'),
        supabase.from('profiles').select('id, full_name, role, created_at').order('created_at', { ascending: false }).limit(4),
      ])

      const stList = studentsRes.data ?? []
      const cList = cohortsRes.data ?? []
      const crsList = coursesRes.data ?? []
      const attList = attendanceRes.data ?? []
      const progList = progressRes.data ?? []
      const pList = profilesRes.data ?? []

      // Attendance rate
      const attRate = attList.length
        ? Math.round((attList.filter((a) => a.status === 'present' || a.status === 'late').length / attList.length) * 100)
        : 0

      // Avg progress
      const avgProg = progList.length
        ? Math.round(progList.reduce((sum, p) => sum + Number(p.progress_percent || 0), 0) / progList.length)
        : 0

      // Courses with cohort count
      const mappedCourses = crsList.map((c) => {
        const cohortCount = cList.filter((coh) => coh.course_id === c.id).length
        return {
          id: c.id,
          name: c.name,
          cohorts: cohortCount,
          progress: avgProg || 0,
        }
      })

      const recentActivity: ActivityRow[] = pList.map((p) => ({
        id: p.id,
        text: `${p.full_name || 'User'} (${p.role || 'student'}) joined workspace`,
        time: p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Recent',
      }))

      setCounts({
        students: stList.filter((s) => s.status !== 'withdrawn' && s.status !== 'paused').length || stList.length,
        cohorts: cList.length,
        attendanceRate: attRate,
        avgProgress: avgProg,
      })
      setCourseList(mappedCourses)
      setActivity(recentActivity)
    } catch (err) {
      console.warn('Manager dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <div>
      <PageHeader
        title={`Good to see you, ${user?.name.split(' ')[0] ?? ''}`}
        subtitle="Here's how your cohorts and courses are performing."
        actions={
          <div className="flex flex-wrap items-center gap-2">
          <Link to="/classwork?create=1" className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3 py-2 text-xs font-semibold text-white">Add Classwork</Link>
          <Link to="/assessments?create=1" className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-xs font-semibold">Add Assessment</Link>
          <Link to="/projects?create=1" className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-xs font-semibold">Add Project</Link>
          <Link to="/grading-queue" className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-xs font-semibold">Grade Work</Link>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-ink-50)] transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active students" value={String(counts.students)} icon={Users} />
        <StatCard label="Active cohorts" value={String(counts.cohorts)} icon={Layers} />
        <StatCard label="Attendance rate" value={`${counts.attendanceRate}%`} icon={ClipboardCheck} tone="success" />
        <StatCard label="Avg. progress" value={`${counts.avgProgress}%`} icon={TrendingUp} tone="success" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <SectionHeading eyebrow="Performance" title="Course performance" />
          {courseList.length > 0 ? (
            <ul className="divide-y divide-[var(--color-line)]">
              {courseList.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-ink-900)]">{c.name}</p>
                    <p className="text-xs text-[var(--color-ink-400)]">{c.cohorts} active cohort{c.cohorts === 1 ? '' : 's'}</p>
                  </div>
                  <ProgressRing value={c.progress} size={48} stroke={5} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[var(--color-ink-400)] py-4 text-center">No active courses registered.</p>
          )}
        </Card>

        <Card className="p-5">
          <SectionHeading title="Recent activity" />
          {activity.length > 0 ? (
            <ActivityFeed rows={activity} />
          ) : (
            <p className="text-xs text-[var(--color-ink-400)] py-4 text-center">No recent activity recorded.</p>
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <SectionHeading eyebrow="Attention" title="Cohorts & trainers status" />
          <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4 text-center">
            <p className="text-sm font-medium text-[var(--color-ink-800)]">All active cohorts are in good standing</p>
            <p className="text-xs text-[var(--color-ink-500)] mt-1">No attendance dips or overdue reporting alerts flagged.</p>
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeading title="Scheduled sessions" />
          <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4 text-center">
            <p className="text-xs text-[var(--color-ink-500)]">Active session schedules appear here when cohort timetables are published.</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
