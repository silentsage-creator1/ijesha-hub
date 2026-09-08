import { useEffect, useState } from 'react'
import { BarChart3, BookOpen, GraduationCap, Users } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, SectionHeading } from '@/components/ui/primitives'
import { StatCard } from '@/components/dashboard/blocks'
import { supabase } from '@/lib/supabase'

interface SponsorRow {
  course_name: string
  cohort_name: string
  student_name: string
  photo_path: string | null
  photo_url?: string | null
  progress_percent: number | null
  average_score: number | null
  attendance_percent: number | null
  completion_status: string
}

export function SponsorDashboard() {
  const [rows, setRows] = useState<SponsorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('sponsor_dashboard').then(async ({ data, error: rpcError }) => {
      if (cancelled) return
      if (rpcError) setError(rpcError.message)
      else {
        const initialRows = (data ?? []) as SponsorRow[]
        const paths = initialRows.map(row => row.photo_path).filter((path): path is string => !!path)
        const signed = paths.length ? await supabase.storage.from('student-photos').createSignedUrls(paths, 60 * 60) : { data: [], error: null }
        const urls = new Map((signed.data ?? []).map(item => [item.path, item.signedUrl]))
        setRows(initialRows.map(row => ({ ...row, photo_url: row.photo_path ? urls.get(row.photo_path) ?? null : null })))
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const courses = new Set(rows.map((row) => `${row.course_name}|${row.cohort_name}`))
  const average = (key: 'progress_percent' | 'average_score' | 'attendance_percent') => {
    const values = rows.map((row) => row[key]).filter((value): value is number => value !== null)
    return values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : 0
  }

  return (
    <div>
      <PageHeader title="Sponsored learning" subtitle="Academic outcomes for your authorized courses and cohorts." />
      {error && <Card className="mb-5 border-[var(--color-danger-100)] p-4 text-sm text-[var(--color-danger-600)]">{error}</Card>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sponsored cohorts" value={String(courses.size)} icon={BookOpen} />
        <StatCard label="Sponsored students" value={String(rows.length)} icon={Users} />
        <StatCard label="Average progress" value={`${average('progress_percent')}%`} icon={BarChart3} />
        <StatCard label="Average score" value={`${average('average_score')}%`} icon={GraduationCap} />
      </div>
      <Card className="mt-6 p-5">
        <SectionHeading eyebrow="Authorized academic data" title="Student performance" />
        {loading ? <p className="text-sm text-[var(--color-ink-400)]">Loading sponsored outcomes…</p> : rows.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-400)]">No sponsored student records are available yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-[var(--color-line)] text-xs text-[var(--color-ink-400)]">
                <tr><th className="pb-2 font-medium">Student</th><th className="pb-2 font-medium">Course / cohort</th><th className="pb-2 font-medium">Progress</th><th className="pb-2 font-medium">Average score</th><th className="pb-2 font-medium">Attendance</th><th className="pb-2 font-medium">Completion</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {rows.map((row, index) => <tr key={`${row.student_name}-${index}`}><td className="py-3 font-medium text-[var(--color-ink-900)]"><span className="flex items-center gap-2">{row.photo_url ? <img src={row.photo_url} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-harbor-100)] text-xs text-[var(--color-harbor-700)]">{row.student_name.slice(0,1)}</span>}{row.student_name}</span></td><td className="py-3 text-[var(--color-ink-600)]">{row.course_name} · {row.cohort_name}</td><td className="py-3">{row.progress_percent ?? 0}%</td><td className="py-3">{row.average_score ?? 0}%</td><td className="py-3">{row.attendance_percent ?? 0}%</td><td className="py-3 capitalize">{row.completion_status}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
