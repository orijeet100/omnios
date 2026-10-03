import { Link } from '@tanstack/react-router'
import type { SegmentId } from '@/contracts'
import {
  Activity,
  ChevronRight,
  Droplet,
  Gauge,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { SegmentCardData } from './segments'

const ICONS: Partial<Record<SegmentId, LucideIcon>> = {
  bp_off: Gauge,
  glucose_off: Droplet,
  recovery_off: Activity,
}

/** A category of patients as one wide card: icon, name, count. Links to the patients in it. */
export function SegmentRow({ segment }: { segment: SegmentCardData }) {
  const Icon = ICONS[segment.id] ?? Activity
  return (
    <Link
      to='/segments/$segmentId'
      params={{ segmentId: segment.id }}
      className='group block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
    >
      <Card className='flex-row items-center gap-4 px-5 py-4 transition-colors group-hover:bg-accent'>
        <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground'>
          <Icon className='size-5' />
        </div>
        <div className='min-w-0 flex-1 leading-tight font-semibold'>
          {segment.label}
        </div>
        <div className='min-w-10 text-end text-3xl font-bold tabular-nums'>
          {segment.count}
        </div>
        <ChevronRight className='size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5' />
      </Card>
    </Link>
  )
}
