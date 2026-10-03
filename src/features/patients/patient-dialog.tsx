import { useState } from 'react'
import { Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatValue, seriesFor, type PatientListItem } from './data'
import { TrendChart } from './trend-chart'

/**
 * The charts for the measurements that look off, with the two actions.
 * Send to doctor and Dismiss are placeholders for now and do nothing.
 */
export function PatientDialog({
  patient,
  onClose,
}: {
  patient: PatientListItem | undefined
  onClose: () => void
}) {
  // Keep showing the last patient while the dialog animates closed.
  const [lastShown, setLastShown] = useState(patient)
  if (patient && patient !== lastShown) setLastShown(patient)
  const shown = patient ?? lastShown
  const charts = shown ? seriesFor(shown.id, shown.modalMetrics) : []

  return (
    <Dialog open={!!patient} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{shown?.name}</DialogTitle>
          <DialogDescription>
            {shown && `${shown.age} · ${shown.sex}`}
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn('grid gap-6', charts.length > 1 && 'sm:grid-cols-2')}
        >
          {charts.map((series) => (
            <section key={series.metric} className='space-y-2'>
              <div className='flex items-baseline justify-between gap-2'>
                <h3 className='text-sm font-medium'>{series.label}</h3>
                <span
                  className={cn(
                    'text-sm font-medium whitespace-nowrap tabular-nums',
                    series.abnormalNow && 'text-destructive'
                  )}
                >
                  {formatValue(series.latest, series.unit)}
                </span>
              </div>
              <TrendChart series={series} />
            </section>
          ))}
        </div>

        <DialogFooter>
          <Button variant='outline'>
            <X />
            Dismiss
          </Button>
          <Button>
            <Send />
            Send to doctor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
