import { METRICS, type Metric, type MetricDeviation } from '@/contracts'
import { ArrowDown, ArrowUp } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatValue, offMetrics } from './data'

const MAX_ROWS = 6
const MIN_CHANGE_PCT = 10

/**
 * The flagged measurements first, then the biggest other moves; small wobbles
 * are left out.
 */
function notableChanges(deviations: MetricDeviation[], flagged: Metric[]) {
  const isFlagged = (d: MetricDeviation) => flagged.includes(d.metric)
  return deviations
    .filter((d) => isFlagged(d) || Math.abs(d.delta_pct) >= MIN_CHANGE_PCT)
    .sort(
      (a, b) =>
        Number(isFlagged(b)) - Number(isFlagged(a)) ||
        Math.abs(b.delta_pct) - Math.abs(a.delta_pct)
    )
    .slice(0, MAX_ROWS)
}

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
  const rows = notableChanges(deviations, offMetrics(patientId))
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
