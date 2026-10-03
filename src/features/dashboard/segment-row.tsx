import { Link } from '@tanstack/react-router'
import { METRICS, type SegmentId } from '@/contracts'
import {
  Activity,
  ChevronRight,
  Droplet,
  Gauge,
  TrendingUp,
  TrendingDown,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { SegmentCardData } from './segments'

const ICONS: Partial<Record<SegmentId, LucideIcon>> = {
  bp_off: Gauge,
  glucose_off: Droplet,
  recovery_off: Activity,
}

const METRIC_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(METRICS).map(([key, m]) => [key, m.label])
)

export function SegmentRow({ segment }: { segment: SegmentCardData }) {
  const Icon = ICONS[segment.id] ?? Activity
  const TrendIcon =
    segment.trend === 'up'
      ? TrendingUp
      : segment.trend === 'down'
        ? TrendingDown
        : Activity

  const TrendColor =
    segment.trend === 'up'
      ? 'text-red-500'
      : segment.trend === 'down'
        ? 'text-emerald-500'
        : 'text-muted-foreground'

  const trendLabel =
    segment.trend === 'up'
      ? 'Worsening'
      : segment.trend === 'down'
        ? 'Improving'
        : 'Holding steady'

  const trendBadge =
    segment.trend === 'up'
      ? 'destructive'
      : segment.trend === 'down'
        ? 'success'
        : 'secondary'

  return (
    <Link
      to='/segments/$segmentId'
      params={{ segmentId: segment.id }}
      className='group block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
    >
      <Card className='relative overflow-hidden px-5 py-4 transition-all group-hover:shadow-md'>
        <div className='flex items-center gap-4'>
          <div className='flex size-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10 text-blue-600'>
            <Icon className='h-6 w-6' />
          </div>

          <div className='min-w-0 flex-1'>
            <div className='flex items-center gap-2 leading-tight font-semibold'>
              {segment.label}
              <Badge variant='secondary' className='text-xs'>
                {segment.metrics.length} metrics
              </Badge>
            </div>

            <div className='mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
              <span className='flex items-center gap-1'>
                <Users className='h-3 w-3' />
                {segment.count} patients
              </span>
              {segment.metrics.slice(0, 3).map((m) => (
                <span
                  key={m}
                  className='rounded border bg-muted/40 px-1.5 py-0.5'
                >
                  {METRIC_LABELS[m] ?? m}
                </span>
              ))}
              {segment.metrics.length > 3 && (
                <span className='text-muted-foreground'>
                  +{segment.metrics.length - 3} more
                </span>
              )}
            </div>
          </div>

          <div className='flex items-center gap-3'>
            <div className='flex items-center gap-1.5'>
              <TrendIcon className={`h-4 w-4 ${TrendColor}`} />
              <span className='text-xs font-medium text-muted-foreground'>
                {segment.prevCount} → {segment.count}
              </span>
            </div>
            <Badge variant={trendBadge} className='text-xs'>
              {trendLabel}
            </Badge>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-2xl font-bold ${
                segment.count > 5
                  ? 'text-red-600'
                  : segment.count > 0
                    ? 'text-amber-600'
                    : 'text-green-600'
              }`}
            >
              {segment.count}
            </div>
            <ChevronRight className='h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5' />
          </div>
        </div>
      </Card>
    </Link>
  )
}
