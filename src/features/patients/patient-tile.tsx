import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { formatValue, shortLabel, type PatientListItem } from './data'
import { Sparkline } from './sparkline'

/**
 * A square, clickable patient card with a small trend line per measurement.
 * The whole tile is one button; it shifts color on hover to show it opens.
 */
export function PatientTile({
  patient,
  badge,
  onSelect,
}: {
  patient: PatientListItem
  badge?: ReactNode
  onSelect: () => void
}) {
  return (
    <button
      type='button'
      onClick={onSelect}
      className='flex aspect-square flex-col gap-3 rounded-xl border bg-card p-4 text-start text-card-foreground shadow-sm transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50'
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <div className='truncate font-semibold'>{patient.name}</div>
          <div className='text-xs text-muted-foreground'>
            {patient.age} · {patient.sex}
          </div>
        </div>
        {badge}
      </div>
      <ul className='flex flex-1 flex-col justify-center gap-3'>
        {patient.series.map((series) => (
          <li
            key={series.metric}
            className='grid grid-cols-[4rem_1fr_auto] items-center gap-2'
          >
            <span className='truncate text-xs text-muted-foreground'>
              {shortLabel(series.metric)}
            </span>
            <Sparkline series={series} className='text-muted-foreground' />
            <span
              className={cn(
                'text-xs font-medium tabular-nums',
                series.abnormalNow && 'text-destructive'
              )}
            >
              {formatValue(series.latest, series.unit)}
            </span>
          </li>
        ))}
      </ul>
    </button>
  )
}
