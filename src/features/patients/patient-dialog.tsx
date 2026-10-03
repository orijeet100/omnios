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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BodyScanPanel } from './body-scan/body-scan-panel'
import { VisualizeLogo } from './body-scan/visualize-logo'
import {
  allIndicators,
  formatValue,
  getDeviceGroups,
  sexLabel,
  type PatientListItem,
} from './data'
import { DeviceLogo } from './device-logo'
import { Indicators } from './indicators'
import { PatientAvatar } from './patient-avatar'
import { TrendChart } from './trend-chart'

/**
 * The one patient modal, used from every page. Header: who the patient is and
 * their arrows. Body: one tab per device, each with charts of its
 * measurements (out-of-range ones first, in red). Send to doctor is a
 * placeholder for now and does nothing.
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

  const devices = shown ? getDeviceGroups(shown.id) : []
  const firstAbnormal = devices.find((d) => d.hasAbnormal) ?? devices[0]

  return (
    <Dialog open={!!patient} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='sm:max-w-3xl'>
        {shown && (
          <>
            <DialogHeader className='items-center text-center'>
              <PatientAvatar
                id={shown.id}
                sex={shown.sex}
                className='size-16'
              />
              <DialogTitle>{shown.name}</DialogTitle>
              <DialogDescription>
                {shown.age} · {sexLabel(shown.sex)}
              </DialogDescription>
              <Indicators items={allIndicators(shown.id)} className='pt-1' />
            </DialogHeader>

            {firstAbnormal && (
              <Tabs key={shown.id} defaultValue={firstAbnormal.source}>
                <TabsList className='h-auto w-full flex-wrap'>
                  {devices.map((device) => (
                    <TabsTrigger key={device.source} value={device.source}>
                      <DeviceLogo source={device.source} />
                      {device.hasAbnormal && (
                        <span
                          role='img'
                          aria-label='Out of range'
                          className='size-1.5 rounded-full bg-destructive'
                        />
                      )}
                    </TabsTrigger>
                  ))}
                  <TabsTrigger value='visualize'>
                    <VisualizeLogo />
                  </TabsTrigger>
                </TabsList>
                {devices.map((device) => (
                  <TabsContent
                    key={device.source}
                    value={device.source}
                    className='grid gap-6 pt-4 sm:grid-cols-2'
                  >
                    {device.series.map((series) => (
                      <section key={series.metric} className='space-y-2'>
                        <div className='flex items-baseline justify-between gap-2'>
                          <h3 className='text-sm font-medium'>
                            {series.label}
                          </h3>
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
                  </TabsContent>
                ))}
                <TabsContent value='visualize' className='pt-4'>
                  <BodyScanPanel patientId={shown.id} sex={shown.sex} />
                </TabsContent>
              </Tabs>
            )}
          </>
        )}

        <DialogFooter className='sm:justify-center'>
          <Button variant='outline' onClick={onClose}>
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
