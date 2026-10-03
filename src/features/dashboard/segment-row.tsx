import { Link } from '@tanstack/react-router'
import type { SegmentId } from '@/contracts'
import {
  Activity,
  ChevronRight,
  Droplet,
  Gauge,
  Minus,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { SegmentCardData } from './segments'

const ICONS: Partial<Record<SegmentId, LucideIcon>> = {
  bp_off: Gauge,
  glucose_off: Droplet,
  recovery_off: Activity,
}

const TRENDS: Record<
  SegmentCardData['trend'],
  { Icon: LucideIcon; label: string }
> = {
  up: { Icon: TrendingUp, label: 'Worsening' },
  down: { Icon: TrendingDown, label: 'Improving' },
  flat: { Icon: Minus, label: 'Steady' },
}

export function SegmentRow({ segment }: { segment: SegmentCardData }) {
  const Icon = ICONS[segment.id] ?? Activity
  const { Icon: TrendIcon, label: trendLabel } = TRENDS[segment.trend]

  return (
    <Link
      to='/segments/$segmentId'
      params={{ segmentId: segment.id }}
      className='group block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
    >
      <Card className='px-5 py-4 transition-colors group-hover:bg-accent'>
        <div className='flex items-center gap-4'>
          <div className='flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
            <Icon className='size-6' aria-hidden />
          </div>
          <span className='min-w-0 flex-1 text-start font-semibold'>
            {segment.label}
          </span>
          <span className='flex items-center gap-1.5 text-sm text-muted-foreground'>
            <TrendIcon className='size-4' aria-hidden />
            {trendLabel}
          </span>
          <span className='flex w-24 items-baseline justify-end gap-1.5'>
            <span className='text-3xl font-bold tabular-nums'>
              {segment.count}
            </span>
            <span className='text-xs text-muted-foreground'>patients</span>
          </span>
          <ChevronRight
            className='size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5'
            aria-hidden
          />
        </div>
      </Card>
    </Link>
  )
}
