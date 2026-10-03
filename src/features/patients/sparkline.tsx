import { cn } from '@/lib/utils'
import type { MetricSeries } from './data'

const WIDTH = 100
const HEIGHT = 24
const PADDING = 2

/**
 * A tiny trend line for cards. Plain SVG on purpose: a page can show hundreds
 * of these, so it skips a chart library. Abnormal weeks are drawn in red.
 */
export function Sparkline({
  series,
  className,
}: {
  series: MetricSeries
  className?: string
}) {
  const { points, runs } = series
  const values = points.flatMap((p) => p.value ?? [])
  if (values.length < 2) return null

  const min = Math.min(...values)
  const range = Math.max(...values) - min || 1
  const x = (index: number) => (index / (points.length - 1)) * WIDTH
  const y = (value: number) =>
    HEIGHT - PADDING - ((value - min) / range) * (HEIGHT - PADDING * 2)

  /** Path through the days with data between two day indexes (inclusive). */
  const pathBetween = (from: number, to: number) =>
    points
      .slice(from, to + 1)
      .flatMap((p, offset) =>
        p.value == null ? [] : [[x(from + offset), y(p.value)] as const]
      )
      .map(
        ([px, py], i) =>
          `${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`
      )
      .join(' ')

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio='none'
      className={cn('h-6 w-full', className)}
      aria-hidden
    >
      <path
        d={pathBetween(0, points.length - 1)}
        fill='none'
        stroke='currentColor'
        strokeWidth={1.5}
        strokeLinecap='round'
        strokeLinejoin='round'
        vectorEffect='non-scaling-stroke'
      />
      {runs.map(([start, end]) => (
        <path
          key={start}
          d={pathBetween(start, end)}
          fill='none'
          stroke='var(--destructive)'
          strokeWidth={2}
          strokeLinecap='round'
          strokeLinejoin='round'
          vectorEffect='non-scaling-stroke'
        />
      ))}
    </svg>
  )
}
