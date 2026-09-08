import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  Target,
  BookOpen,
  FileText,
  ChevronRight,
  ListChecks,
  Activity,
  FolderKanban,
} from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, SectionHeading, ProgressRing, StreakChip } from '@/components/ui/primitives'
import { useAuth } from '@/app/auth'
import { supabase } from '@/lib/supabase'

export function StudentDashboard() {
  const { user, profile } = useAuth()
  const [progressPercent, setProgressPercent] = useState<number>(85)
  const [trackName, setTrackName] = useState<string>('Frontend Development')

  useEffect(() => {
    async function loadData() {
      if (!profile?.id) return
      try {
        const { data: st } = await supabase
          .from('students')
          .select('id, track')
          .eq('profile_id', profile.id)
          .maybeSingle()

        if (st?.track) setTrackName(st.track)

        if (st?.id) {
          const { data: prog } = await supabase
            .from('student_progress')
            .select('progress_percent')
            .eq('student_id', st.id)
            .maybeSingle()
          if (prog?.progress_percent) setProgressPercent(Number(prog.progress_percent))
        }
      } catch {
        // Ignore
      }
    }
    loadData()
  }, [profile?.id])

  return (
    <div>
      <PageHeader
        title={`Hey ${user?.name.split(' ')[0] ?? ''}, ready for today?`}
        subtitle={`${trackName} Track · Active Student`}
        actions={<StreakChip days={1} />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <SectionHeading eyebrow="Learning" title="What should I do today?" />
          <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-6 text-center">
            <BookOpen className="mx-auto text-[var(--color-harbor-600)] mb-2" size={24} />
            <p className="text-sm font-medium text-[var(--color-ink-800)]">Active Classwork & Tasks</p>
            <p className="text-xs text-[var(--color-ink-500)] mt-1 max-w-md mx-auto">
              Check your pending classwork, download study resources, submit your deliverables, and review trainer grades.
            </p>
            <Link
              to="/classwork"
              className="mt-4 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-600)] transition-colors"
            >
              <FileText size={14} />
              Open Classwork
              <ChevronRight size={14} />
            </Link>
          </div>
        </Card>

        <Card className="flex flex-col items-center justify-center p-5 text-center">
          <SectionHeading title="How far have I come?" />
          <ProgressRing value={progressPercent} size={92} tone="ember" />
          <p className="mt-3 text-sm text-[var(--color-ink-500)]">{trackName} — {progressPercent}% complete</p>
        </Card>
      </div>

      {/* Core Student Pathways: Grades & Feedback, Results, Projects / Portfolio */}
      <div className="mt-6 space-y-3">
        <SectionHeading eyebrow="My Learning Hub" title="Academic Evaluation & Portfolio" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Grades & Feedback */}
          <Card className="p-5 flex flex-col justify-between hover:border-[var(--color-harbor-400)] transition-all group">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-full bg-[var(--color-harbor-100)] text-[var(--color-harbor-600)] flex items-center justify-center">
                <ListChecks size={20} />
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase text-[var(--color-harbor-600)]">Trainer Feedback</span>
                <h3 className="font-display text-base font-bold text-[var(--color-ink-900)] mt-0.5 group-hover:text-[var(--color-harbor-600)] transition-colors">
                  Grades & Feedback
                </h3>
                <p className="text-xs text-[var(--color-ink-500)] mt-1 leading-relaxed">
                  &quot;What did my trainer say about my work?&quot; View scores, rubrics, improvement notes, and request resubmissions.
                </p>
              </div>
            </div>
            <Link
              to="/grades-feedback"
              className="mt-4 pt-3 border-t border-[var(--color-line)] flex items-center justify-between text-xs font-semibold text-[var(--color-harbor-600)] group-hover:translate-x-0.5 transition-transform"
            >
              <span>View Grades & Feedback</span>
              <ChevronRight size={14} />
            </Link>
          </Card>

          {/* 2. Results */}
          <Card className="p-5 flex flex-col justify-between hover:border-[var(--color-harbor-400)] transition-all group">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-full bg-[var(--color-success-100)] text-[var(--color-success-600)] flex items-center justify-center">
                <Activity size={20} />
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase text-[var(--color-success-700)]">Overall Standing</span>
                <h3 className="font-display text-base font-bold text-[var(--color-ink-900)] mt-0.5 group-hover:text-[var(--color-harbor-600)] transition-colors">
                  Results
                </h3>
                <p className="text-xs text-[var(--color-ink-500)] mt-1 leading-relaxed">
                  &quot;How am I performing overall?&quot; Track your cumulative GPA, course mastery, and exam / lab breakdowns.
                </p>
              </div>
            </div>
            <Link
              to="/results"
              className="mt-4 pt-3 border-t border-[var(--color-line)] flex items-center justify-between text-xs font-semibold text-[var(--color-harbor-600)] group-hover:translate-x-0.5 transition-transform"
            >
              <span>View Results Overview</span>
              <ChevronRight size={14} />
            </Link>
          </Card>

          {/* 3. Projects / Portfolio */}
          <Card className="p-5 flex flex-col justify-between hover:border-[var(--color-harbor-400)] transition-all group">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-full bg-[var(--color-ember-100)] text-[var(--color-ember-600)] flex items-center justify-center">
                <FolderKanban size={20} />
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase text-[var(--color-ember-700)]">Showcase & Capstones</span>
                <h3 className="font-display text-base font-bold text-[var(--color-ink-900)] mt-0.5 group-hover:text-[var(--color-harbor-600)] transition-colors">
                  Projects / Portfolio
                </h3>
                <p className="text-xs text-[var(--color-ink-500)] mt-1 leading-relaxed">
                  &quot;What have I built and what can I showcase?&quot; Manage milestone phases and curate your public portfolio.
                </p>
              </div>
            </div>
            <Link
              to="/portfolio"
              className="mt-4 pt-3 border-t border-[var(--color-line)] flex items-center justify-between text-xs font-semibold text-[var(--color-harbor-600)] group-hover:translate-x-0.5 transition-transform"
            >
              <span>Open Projects & Portfolio</span>
              <ChevronRight size={14} />
            </Link>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeading eyebrow="Goals" title="What am I trying to achieve?" />
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-harbor-100)] text-[var(--color-harbor-600)]">
              <Target size={16} />
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--color-ink-900)]">Complete {trackName} Course</p>
              <p className="text-xs text-[var(--color-ink-400)]">Work through syllabus modules and project assignments</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeading eyebrow="Schedule" title="Upcoming class sessions" />
          <div className="flex items-center gap-3 text-sm text-[var(--color-ink-600)]">
            <CalendarClock size={16} className="text-[var(--color-ink-400)]" />
            Check your cohort calendar for live session times and announcements.
          </div>
        </Card>
      </div>
    </div>
  )
}
