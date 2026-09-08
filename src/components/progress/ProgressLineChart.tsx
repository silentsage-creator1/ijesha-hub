import { useState, useId } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { getProgressTrend, type ProgressTrend } from '@/lib/progress'

export interface ProgressDataPoint {
  week: number
  weekLabel?: string
  progress: number
  note?: string
}

interface ProgressLineChartProps {
  title?: string
  data: ProgressDataPoint[]
  height?: number
  showTrendBadge?: boolean
  targetGoal?: number // e.g. 75% or 80% benchmark line
}

export function ProgressLineChart({
  title = 'Training Progress',
  data,
  height = 280,
  showTrendBadge = true,
  targetGoal = 75,
}: ProgressLineChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<ProgressDataPoint | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const gradientId = useId()

  const trendInfo = getProgressTrend(
    data.map((d) => ({ week: d.week, overallProgress: d.progress }))
  )

  // Chart coordinate space
  const chartWidth = 700
  const chartHeight = 220
  const paddingLeft = 50
  const paddingRight = 40
  const paddingTop = 20
  const paddingBottom = 40

  const plotWidth = chartWidth - paddingLeft - paddingRight
  const plotHeight = chartHeight - paddingTop - paddingBottom

  // Axis values
  const yTicks = [0, 25, 50, 75, 100]

  // Calculate coordinates for points
  const points = data.map((d, index) => {
    const x =
      data.length === 1
        ? paddingLeft + plotWidth / 2
        : paddingLeft + (index / (data.length - 1)) * plotWidth
    const y = paddingTop + plotHeight - (d.progress / 100) * plotHeight
    return { ...d, x, y }
  })

  // SVG path definition
  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`
  }, '')

  // Area path for subtle gradient fill
  const areaD =
    points.length > 0
      ? `${pathD} L ${points[points.length - 1].x},${paddingTop + plotHeight} L ${points[0].x},${
          paddingTop + plotHeight
        } Z`
      : ''

  // Trend styling
  const trendConfig: Record<
    ProgressTrend,
    { label: string; icon: typeof TrendingUp; color: string; bg: string; border: string }
  > = {
    Increasing: {
      label: 'Increasing Progress',
      icon: TrendingUp,
      color: 'text-[var(--color-success-700)]',
      bg: 'bg-[var(--color-success-100)]',
      border: 'border-[var(--color-success-500)]/30',
    },
    'Staying the same': {
      label: 'Steady Progress',
      icon: Minus,
      color: 'text-[var(--color-ink-700)]',
      bg: 'bg-[var(--color-ink-100)]',
      border: 'border-[var(--color-ink-300)]',
    },
    'Falling behind': {
      label: 'Falling Behind',
      icon: TrendingDown,
      color: 'text-[var(--color-danger-700)]',
      bg: 'bg-[var(--color-danger-100)]',
      border: 'border-[var(--color-danger-500)]/30',
    },
  }

  const TrendIcon = trendConfig[trendInfo.trend].icon

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold text-[var(--color-ink-900)]">
            {title}
          </h3>
          <p className="text-xs text-[var(--color-ink-500)]">
            X-axis: Training Week · Y-axis: Progress %
          </p>
        </div>

        {showTrendBadge && (
          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${trendConfig[trendInfo.trend].bg} ${trendConfig[trendInfo.trend].color} ${trendConfig[trendInfo.trend].border}`}
          >
            <TrendIcon size={14} className="stroke-[2.5]" />
            <span>
              {trendConfig[trendInfo.trend].label}{' '}
              {trendInfo.delta !== 0 && `(${trendInfo.delta > 0 ? '+' : ''}${trendInfo.delta}%)`}
            </span>
          </div>
        )}
      </div>

      {/* SVG Chart Frame */}
      <div className="relative w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3 shadow-xs">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-auto w-full select-none"
          style={{ maxHeight: height }}
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-harbor-500)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--color-harbor-500)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal gridlines and Y-axis labels */}
          {yTicks.map((val) => {
            const y = paddingTop + plotHeight - (val / 100) * plotHeight
            return (
              <g key={val}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="var(--color-line)"
                  strokeWidth="1"
                  strokeDasharray={val === 0 ? undefined : '3 3'}
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fontWeight="500"
                  fill="var(--color-ink-400)"
                >
                  {val}%
                </text>
              </g>
            )
          })}

          {/* Benchmark target line if requested */}
          {targetGoal && (
            <g>
              <line
                x1={paddingLeft}
                y1={paddingTop + plotHeight - (targetGoal / 100) * plotHeight}
                x2={chartWidth - paddingRight}
                y2={paddingTop + plotHeight - (targetGoal / 100) * plotHeight}
                stroke="var(--color-ember-400)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity="0.6"
              />
              <text
                x={chartWidth - paddingRight - 4}
                y={paddingTop + plotHeight - (targetGoal / 100) * plotHeight - 4}
                textAnchor="end"
                fontSize="9"
                fontWeight="600"
                fill="var(--color-ember-600)"
              >
                Benchmark ({targetGoal}%)
              </text>
            </g>
          )}

          {/* Area gradient under line */}
          {areaD && <path d={areaD} fill={`url(#${gradientId})`} />}

          {/* Main line path */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="var(--color-harbor-600)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data points & X-axis labels */}
          {points.map((pt) => {
            const isHovered = hoveredPoint?.week === pt.week
            return (
              <g key={pt.week}>
                {/* X-axis label */}
                <text
                  x={pt.x}
                  y={paddingTop + plotHeight + 22}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="var(--color-ink-700)"
                >
                  Week {pt.week}
                </text>

                {/* Point value label above node */}
                <text
                  x={pt.x}
                  y={pt.y - 12}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="var(--color-harbor-700)"
                >
                  {pt.progress}%
                </text>

                {/* Outer ring for node */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 7 : 5}
                  fill="white"
                  stroke="var(--color-harbor-600)"
                  strokeWidth="3"
                  className="transition-all duration-150 cursor-pointer"
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    setHoveredPoint(pt)
                    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top })
                  }}
                />
              </g>
            )
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredPoint && tooltipPos && (
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md bg-[var(--color-ink-950)] px-3 py-1.5 text-xs text-white shadow-lg"
            style={{ left: tooltipPos.x, top: tooltipPos.y - 8 }}
          >
            <p className="font-semibold">Week {hoveredPoint.week}</p>
            <p className="text-[var(--color-ember-400)] font-bold">
              Progress: {hoveredPoint.progress}%
            </p>
            {hoveredPoint.note && (
              <p className="mt-0.5 text-[11px] text-gray-300">{hoveredPoint.note}</p>
            )}
          </div>
        )}
      </div>

      {/* Legend & quick indicators */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[var(--color-ink-500)]">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-harbor-600)]" />
            <span>Weekly Progress Percentage</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3 bg-[var(--color-ember-500)] border-t border-dashed border-[var(--color-ember-600)]" />
            <span>Target Benchmark ({targetGoal}%)</span>
          </span>
        </div>
        <span className="font-medium text-[var(--color-ink-600)]">
          Current Progress: <strong className="text-[var(--color-harbor-700)]">{data[data.length - 1]?.progress ?? 0}%</strong>
        </span>
      </div>
    </div>
  )
}
