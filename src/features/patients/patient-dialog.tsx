import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiAdapter } from '@/api'
import { Check, Loader2, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useIsSent } from '@/hooks/use-notifications'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BodyScanPanel } from './body-scan/body-scan-panel'
import { VisualizeLogo } from './body-scan/visualize-logo'
import { ChangesTable } from './changes-table'
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

/** True once the browser has painted, so the modal can open before the heavy part renders. */
function useAfterPaint() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let timer: number
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => setReady(true))
    })
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [])
  return ready
}

function PatientBody({ patient }: { patient: PatientListItem }) {
  const ready = useAfterPaint()
  return ready ? (
    <PatientCharts patient={patient} />
  ) : (
    <p
      role='status'
      className='flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground'
    >
      <Loader2 className='size-4 animate-spin' aria-hidden />
      Analyzing trend data…
    </p>
  )
}

function PatientCharts({ patient }: { patient: PatientListItem }) {
  const devices = useMemo(() => getDeviceGroups(patient.id), [patient.id])
  const [tab, setTab] = useState<string>(
    (devices.find((d) => d.hasAbnormal) ?? devices[0])?.source ?? ''
  )
  const { data: deviations } = useQuery({
    queryKey: ['patient-deviations', patient.id],
    queryFn: () => getApiAdapter().getDeviations(patient.id),
  })

  return (
    <>
      <Tabs value={tab} onValueChange={setTab} className='w-full'>
        <TabsList className='h-auto w-full flex-wrap'>
          {devices.map((device) => (
            <TabsTrigger key={device.source} value={device.source}>
              <DeviceLogo source={device.source} />
              <span className='text-xs text-muted-foreground'>
                {device.series.length}
              </span>
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
          </TabsContent>
        ))}
        <TabsContent value='visualize' className='pt-4'>
          <BodyScanPanel patientId={patient.id} sex={patient.sex} />
        </TabsContent>
      </Tabs>

      {deviations && (
        <ChangesTable
          className='mt-6'
          patientId={patient.id}
          deviations={deviations}
        />
      )}
    </>
  )
}

export function PatientDialog({
  patient,
  onClose,
}: {
  patient: PatientListItem | undefined
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [lastShown, setLastShown] = useState(patient)
  if (patient && patient !== lastShown) setLastShown(patient)
  const shown = patient ?? lastShown

  const alreadySent = useIsSent(shown?.id)

  const handleSendToDoctor = () => {
    if (!shown || alreadySent) return
    getApiAdapter().routePatient(shown.id, 'cm-001')
    toast.success(`Sent ${shown.name} to the physician.`)
    queryClient.invalidateQueries({ queryKey: ['worklist'] })
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
    onClose()
  }

  return (
    <Dialog open={!!patient} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden p-0 sm:max-w-6xl'>
        {shown && (
          <>
            <DialogHeader className='p-6 pb-0 text-center'>
              <div className='flex items-center justify-center gap-2'>
                <PatientAvatar
                  id={shown.id}
                  sex={shown.sex}
                  className='size-16'
                />
                <div className='text-left'>
                  <DialogTitle className='text-xl'>{shown.name}</DialogTitle>
                  <DialogDescription>
                    {shown.age} · {sexLabel(shown.sex)} ·{' '}
                    {shown.conditions.join(', ')}
                  </DialogDescription>
                </div>
              </div>
              <Indicators
                items={allIndicators(shown.id)}
                className='justify-center pt-2'
              />
            </DialogHeader>

            <div className='min-h-0 flex-1 overflow-y-auto'>
              <div className='p-6'>
                <PatientBody key={shown.id} patient={shown} />
              </div>
            </div>

            <div className='border-t px-6 py-4'>
              <div className='flex items-center justify-center gap-3'>
                <Button variant='outline' onClick={onClose}>
                  <X className='mr-1 h-4 w-4' />
                  Dismiss
                </Button>
                <Button onClick={handleSendToDoctor} disabled={alreadySent}>
                  {alreadySent ? (
                    <Check className='mr-2 h-4 w-4' />
                  ) : (
                    <Send className='mr-2 h-4 w-4' />
                  )}
                  {alreadySent ? 'Sent to doctor' : 'Send to doctor'}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
