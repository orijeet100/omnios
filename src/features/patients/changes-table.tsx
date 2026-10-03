import { METRICS, type MetricDeviation } from '@/contracts'
import { ArrowDown, ArrowUp } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatValue, notableChanges } from './data'

/** What moved: the usual level (before) against the last few days (after). */
export function ChangesTable({
  patientId,
  deviations,
  emptyText,
  className,
}: {
  patientId: string
  deviations: MetricDeviation[]
  /** Shown when nothing moved; without it the table simply does not render. */
  emptyText?: string
  className?: string
}) {
  const rows = notableChanges(patientId, deviations)
  if (rows.length === 0) {
    return emptyText ? (
      <p className='text-sm text-muted-foreground'>{emptyText}</p>
    ) : null
  }

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          <TableHead>Measure</TableHead>
          <TableHead className='text-end'>Before</TableHead>
          <TableHead className='text-end'>After</TableHead>
          <TableHead className='w-12 text-center'>
            <span className='sr-only'>Change</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const Arrow = row.delta_abs > 0 ? ArrowUp : ArrowDown
          return (
            <TableRow key={row.metric}>
              <TableCell className='font-medium'>
                {METRICS[row.metric].label}
              </TableCell>
              <TableCell className='text-end text-muted-foreground tabular-nums'>
                {formatValue(row.baseline_median, row.unit)}
              </TableCell>
              <TableCell className='text-end tabular-nums'>
                {formatValue(row.current, row.unit)}
              </TableCell>
              <TableCell>
                <Arrow
                  className='mx-auto size-4 text-muted-foreground'
                  aria-label={row.delta_abs > 0 ? 'Up' : 'Down'}
                />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
