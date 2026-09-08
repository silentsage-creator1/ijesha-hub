import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Layers,
  CalendarDays,
  Users,
  BookOpen,
  FileText,
  ClipboardCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  ArrowRight,
} from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, SectionHeading, Badge, Avatar } from '@/components/ui/primitives'
import { useAuth } from '@/app/auth'
import { type Cohort } from '@/lib/cohorts'

interface Classmate {
  id: string
  full_name: string
  track: string | null
  status: string
  email?: string | null
}

export function MyCohortPage() {
  const { profile, role } = useAuth()
  const [currentCohort, setCurrentCohort] = useState<Cohort | null>(null)
  const [allCohorts, setAllCohorts] = useState<Cohort[]>([])
  const [classmates, setClassmates] = useState<Classmate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        if (role !== 'student') return
        const response = await fetch('/api/student/cohort', { credentials: 'include' })
        const context = await response.json() as { cohort: Cohort | null; classmates: Classmate[] }
        if (!response.ok) throw new Error('Unable to load your cohort.')
        if (cancelled) return
        const chosen = context.cohort
        setAllCohorts(chosen ? [chosen] : [])
        setCurrentCohort(chosen)
        setClassmates(context.classmates ?? [])
      } catch {
        if (!cancelled) { setCurrentCohort(null); setAllCohorts([]); setClassmates([]) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    const handleUpdate = () => load()
    window.addEventListener('cohorts-updated', handleUpdate)
    return () => {
      cancelled = true
      window.removeEventListener('cohorts-updated', handleUpdate)
    }
  }, [profile?.id, role])

  if (loading && !currentCohort) {
    return (
      <div>
        <PageHeader title="My Cohort" subtitle="Loading your cohort details..." />
        <Card className="p-8 text-center text-sm text-[var(--color-ink-500)]">
          Connecting to cohort training records…
        </Card>
      </div>
    )
  }

  const cohort = currentCohort

  return (
    <div className="space-y-6">
      <PageHeader
        title={cohort ? cohort.name : 'My Cohort'}
        subtitle={`${cohort ? cohort.course_name : 'Training Track'} · Official Learning Community`}
        actions={allCohorts.length > 1 ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-ink-500)] hidden sm:inline">Switch cohort:</span>
            <select
              value={cohort?.id || ''}
              onChange={(e) => {
                const found = allCohorts.find((c) => c.id === e.target.value)
                if (found) setCurrentCohort(found)
              }}
              className="input text-xs py-1.5 px-2.5 w-auto"
            >
              {allCohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.course_name})
                </option>
              ))}
            </select>
          </div>
        ) : undefined}
      />

      {cohort && (
        <>
          {/* Main Hero Card */}
          <Card className="p-6 bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-ink-50)] border-[var(--color-line)]">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="harbor">{cohort.course_name}</Badge>
                  <Badge tone={cohort.status === 'Active' ? 'success' : 'neutral'}>
                    {cohort.status}
                  </Badge>
                  <span className="text-xs text-[var(--color-ink-500)] flex items-center gap-1">
                    <Sparkles size={13} className="text-[var(--color-ember-500)]" />
                    IJESHA DIGITAL HUB
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-display font-bold text-[var(--color-ink-900)]">
                  {cohort.name}
                </h1>
                <p className="text-sm text-[var(--color-ink-600)] max-w-2xl leading-relaxed">
                  You are actively enrolled in this cohort. All course announcements, training
                  schedules, classwork assignments, and academic attendance are synced directly with your group.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 md:items-end">
                <Link
                  to={`/cohorts/${cohort.id}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-600)] transition-colors"
                >
                  <Layers size={15} />
                  Full Cohort Portal
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="mt-6 pt-5 border-t border-[var(--color-line)] grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-[var(--color-ink-400)] flex items-center gap-1">
                  <CalendarDays size={13} /> Starts On
                </p>
                <p className="text-sm font-semibold text-[var(--color-ink-800)] mt-0.5">
                  {cohort.starts_on ? new Date(cohort.starts_on).toLocaleDateString() : 'Active Now'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-ink-400)] flex items-center gap-1">
                  <Clock size={13} /> Ends On
                </p>
                <p className="text-sm font-semibold text-[var(--color-ink-800)] mt-0.5">
                  {cohort.ends_on ? new Date(cohort.ends_on).toLocaleDateString() : 'In Progress'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-ink-400)] flex items-center gap-1">
                  <Users size={13} /> Cohort Learners
                </p>
                <p className="text-sm font-semibold text-[var(--color-ink-800)] mt-0.5">
                  {classmates.length} Student{classmates.length === 1 ? '' : 's'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-ink-400)] flex items-center gap-1">
                  <CheckCircle2 size={13} className="text-[var(--color-success-600)]" /> Track
                </p>
                <p className="text-sm font-semibold text-[var(--color-ink-800)] mt-0.5">
                  {cohort.course_name}
                </p>
              </div>
            </div>
          </Card>

          {/* Connected Modules for this Cohort */}
          <div>
            <SectionHeading
              eyebrow="Integrated Learning"
              title="Cohort Activities & Study Resources"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
              <Link
                to="/classwork"
                className="group block p-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-harbor-400)] transition-all"
              >
                <div className="h-9 w-9 rounded-full bg-[var(--color-harbor-100)] text-[var(--color-harbor-600)] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <BookOpen size={18} />
                </div>
                <h3 className="font-display text-sm font-semibold text-[var(--color-ink-900)] flex items-center justify-between">
                  Classwork & Tasks
                  <ChevronRight size={14} className="text-[var(--color-ink-400)] group-hover:translate-x-0.5 transition-transform" />
                </h3>
                <p className="text-xs text-[var(--color-ink-500)] mt-1">
                  Review lecture notes, resources, and live weekly tasks.
                </p>
              </Link>

              <Link
                to="/assignments"
                className="group block p-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-harbor-400)] transition-all"
              >
                <div className="h-9 w-9 rounded-full bg-[var(--color-ember-100)] text-[var(--color-ember-600)] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <FileText size={18} />
                </div>
                <h3 className="font-display text-sm font-semibold text-[var(--color-ink-900)] flex items-center justify-between">
                  Assignments
                  <ChevronRight size={14} className="text-[var(--color-ink-400)] group-hover:translate-x-0.5 transition-transform" />
                </h3>
                <p className="text-xs text-[var(--color-ink-500)] mt-1">
                  Submit required deliverables, projects, and track grades.
                </p>
              </Link>

              <Link
                to="/my-schedule"
                className="group block p-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-harbor-400)] transition-all"
              >
                <div className="h-9 w-9 rounded-full bg-[var(--color-success-100)] text-[var(--color-success-600)] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <CalendarDays size={18} />
                </div>
                <h3 className="font-display text-sm font-semibold text-[var(--color-ink-900)] flex items-center justify-between">
                  Live Schedule
                  <ChevronRight size={14} className="text-[var(--color-ink-400)] group-hover:translate-x-0.5 transition-transform" />
                </h3>
                <p className="text-xs text-[var(--color-ink-500)] mt-1">
                  Upcoming virtual classes, trainer labs, and workshops.
                </p>
              </Link>

              <Link
                to="/my-attendance"
                className="group block p-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-harbor-400)] transition-all"
              >
                <div className="h-9 w-9 rounded-full bg-[var(--color-ink-100)] text-[var(--color-ink-600)] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <ClipboardCheck size={18} />
                </div>
                <h3 className="font-display text-sm font-semibold text-[var(--color-ink-900)] flex items-center justify-between">
                  My Attendance
                  <ChevronRight size={14} className="text-[var(--color-ink-400)] group-hover:translate-x-0.5 transition-transform" />
                </h3>
                <p className="text-xs text-[var(--color-ink-500)] mt-1">
                  Check your attendance rates and session sign-ins.
                </p>
              </Link>
            </div>
          </div>

          {/* Classmates Roster */}
          <div>
            <SectionHeading
              eyebrow="Community"
              title={`Classmates in ${cohort.name}`}
            />
            <Card className="mt-3 overflow-hidden">
              {classmates.length > 0 ? (
                <ul className="divide-y divide-[var(--color-line)]">
                  {classmates.map((student) => (
                    <li
                      key={student.id}
                      className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-[var(--color-ink-50)] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          initials={student.full_name.slice(0, 2).toUpperCase()}
                          size={36}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-[var(--color-ink-900)] truncate">
                            {student.full_name}
                            {student.id === profile?.id && (
                              <span className="ml-2 text-[11px] font-normal text-[var(--color-harbor-600)]">
                                (You)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-[var(--color-ink-500)] truncate">
                            {student.track || cohort.course_name}
                          </p>
                        </div>
                      </div>
                      <Badge tone={student.status === 'active' ? 'success' : 'neutral'}>
                        {student.status || 'Active'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-8 text-center text-sm text-[var(--color-ink-400)]">
                  No other learners are currently enrolled in this cohort.
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {!cohort && !loading && (
        <Card className="p-8 text-center">
          <h2 className="font-display text-base font-semibold text-[var(--color-ink-800)]">You are not enrolled in a cohort yet</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-500)]">An administrator must link your student account to a cohort before your schedule, attendance, and classwork can appear.</p>
        </Card>
      )}
    </div>
  )
}
