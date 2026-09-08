import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/primitives'
import { clsx } from '@/lib/clsx'

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  tone = 'neutral',
}: {
  label: string
  value: string
  icon: LucideIcon
  trend?: string
  tone?: 'neutral' | 'success' | 'warning'
}) {
  const trendColor =
    tone === 'success' ? 'text-[var(--color-success-600)]' : tone === 'warning' ? 'text-[var(--color-warning-600)]' : 'text-[var(--color-ink-400)]'

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-400)]">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-harbor-100)] text-[var(--color-harbor-600)]">
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold text-[var(--color-ink-900)]">{value}</p>
      {trend && <p className={clsx('mt-1 text-xs font-medium', trendColor)}>{trend}</p>}
    </Card>
  )
}

export interface AttentionRow {
  id: string
  name: string
  meta: string
  reason: string
  severity: 'high' | 'medium'
}

export function AttentionList({ rows }: { rows: AttentionRow[] }) {
  if (rows.length === 0) {
    return <p className="px-1 py-6 text-center text-sm text-[var(--color-ink-400)]">Nobody needs attention right now — nice work.</p>
  }
  return (
    <ul className="divide-y divide-[var(--color-line)]">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--color-ink-900)]">{row.name}</p>
            <p className="truncate text-xs text-[var(--color-ink-400)]">{row.meta}</p>
          </div>
          <span
            className={clsx(
              'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
              row.severity === 'high'
                ? 'bg-[var(--color-danger-100)] text-[var(--color-danger-600)]'
                : 'bg-[var(--color-warning-100)] text-[var(--color-warning-600)]',
            )}
          >
            {row.reason}
          </span>
        </li>
      ))}
    </ul>
  )
}

export interface ActivityRow {
  id: string
  text: string
  time: string
}

export function ActivityFeed({ rows }: { rows: ActivityRow[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id} className="flex gap-3">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-harbor-400)]" />
          <div>
            <p className="text-sm text-[var(--color-ink-800)]">{row.text}</p>
            <p className="text-xs text-[var(--color-ink-400)]">{row.time}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
