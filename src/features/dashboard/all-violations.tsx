import { useState } from 'react'
import { ChevronDown, ChevronUp, ListChecks } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SEGMENTS } from '@/contracts'
import { getAllViolations } from './segments'

const TIE_LABEL: Record<string, string> = {
  contract_measure: 'Contract measure',
  er_early_warning: 'ER early warning',
  data_quality: 'Data quality',
}

function TrendPill({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') {
    return (
      <Badge variant='destructive' className='text-xs'>
        Worsening
      </Badge>
    )
  }
  if (trend === 'down') {
    return <Badge variant='success' className='text-xs'>Improving</Badge>
  }
  return (
    <Badge variant='secondary' className='text-xs'>
      Steady
    </Badge>
  )
}

/**
 * The three rows above are the headline signals. This is the full list of
 * violations we track, with the counts and rule thresholds taken from the
 * weekly check itself.
 */
export function AllViolations() {
  const [open, setOpen] = useState(false)
  const rows = getAllViolations()
  const totalOff = rows.reduce((sum, r) => sum + r.offCount, 0)

  if (!open) {
    return (
      <Button variant='outline' className='w-full' onClick={() => setOpen(true)}>
        <ListChecks className='h-4 w-4' />
        See all {rows.length} tracked violations
        <ChevronDown className='h-4 w-4' />
      </Button>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-base'>
          <ListChecks className='h-4 w-4' />
          All tracked violations
          <Badge variant='secondary' className='text-xs'>
            {rows.length} checks
          </Badge>
        </CardTitle>
        <CardDescription>
          Every check we run each week, with the rule that produced the count.
          Totals {totalOff} flagged patients across all checks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Violation</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Rule</TableHead>
              <TableHead className='text-right'>Off</TableHead>
              <TableHead className='text-right'>Prev</TableHead>
              <TableHead>Trend</TableHead>
              <TableHead className='text-right'>No data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className='font-medium'>
                  {row.label}
                  {row.unit && (
                    <span className='text-muted-foreground'> ({row.unit})</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className='flex flex-col gap-0.5'>
                    <span className='text-sm'>
                      {SEGMENTS[row.segment].label}
                    </span>
                    <span className='text-xs text-muted-foreground'>
                      {TIE_LABEL[row.tiesTo]}
                    </span>
                  </div>
                </TableCell>
                <TableCell className='text-muted-foreground'>
                  {row.thresholdLabel}
                </TableCell>
                <TableCell className='text-right font-semibold tabular-nums'>
                  {row.offCount}
                </TableCell>
                <TableCell className='text-right tabular-nums text-muted-foreground'>
                  {row.prevOffCount}
                </TableCell>
                <TableCell>
                  <TrendPill trend={row.trend} />
                </TableCell>
                <TableCell className='text-right tabular-nums text-muted-foreground'>
                  {row.insufficientCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Button
          variant='ghost'
          size='sm'
          className='mt-3 w-full'
          onClick={() => setOpen(false)}
        >
          <ChevronUp className='h-4 w-4' />
          Show fewer
        </Button>
      </CardContent>
    </Card>
  )
}