import type { HTMLAttributes, ReactNode } from 'react'
import { clsx } from '@/lib/clsx'

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

export function Avatar({ initials, size = 36, src }: { initials: string; size?: number; src?: string }) {
  if (src) return <img src={src} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-[var(--color-harbor-500)] font-display font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  )
}

type BadgeTone = 'harbor' | 'ember' | 'success' | 'warning' | 'danger' | 'neutral'

const TONE_CLASSES: Record<BadgeTone, string> = {
  harbor: 'bg-[var(--color-harbor-100)] text-[var(--color-harbor-700)]',
  ember: 'bg-[var(--color-ember-100)] text-[var(--color-ember-600)]',
  success: 'bg-[var(--color-success-100)] text-[var(--color-success-600)]',
  warning: 'bg-[var(--color-warning-100)] text-[var(--color-warning-600)]',
  danger: 'bg-[var(--color-danger-100)] text-[var(--color-danger-600)]',
  neutral: 'bg-[var(--color-ink-100)] text-[var(--color-ink-600)]',
}

export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

/** Signature motif: a compact progress ring used across every role's dashboard
 *  to represent "how far along" something is — course completion, attendance
 *  rate, cohort health — one visual language for the whole platform. */
export function ProgressRing({
  value,
  size = 56,
  stroke = 6,
  tone = 'harbor',
  label,
}: {
  value: number
  size?: number
  stroke?: number
  tone?: 'harbor' | 'ember' | 'success'
  label?: string
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(Math.max(value, 0), 100) / 100)
  const color =
    tone === 'ember' ? 'var(--color-ember-500)' : tone === 'success' ? 'var(--color-success-500)' : 'var(--color-harbor-500)'

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--color-ink-100)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <span className="absolute font-display text-sm font-semibold text-[var(--color-ink-900)]">
        {label ?? `${Math.round(value)}%`}
      </span>
    </div>
  )
}

/** Streak chip — engagement primitive, used sparingly (student surfaces only). */
export function StreakChip({ days }: { days: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-ember-100)] bg-[var(--color-ember-100)]/60 px-3 py-1 text-sm font-semibold text-[var(--color-ember-600)]">
      <span aria-hidden>🔥</span>
      {days}-day streak
    </span>
  )
}

export function SectionHeading({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-400)]">{eyebrow}</p>}
        <h2 className="font-display text-lg font-semibold text-[var(--color-ink-900)]">{title}</h2>
      </div>
      {action}
    </div>
  )
}
