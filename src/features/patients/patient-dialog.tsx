import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { getApiAdapter } from '@/api'
import {
  Calendar,
  Edit3,
  FileText,
  Minus,
  Save,
  Send,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
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
import { ViolationsList } from './violations-list'

const TIER_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-red-100 text-red-800',
  watch: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
}

export function PatientDialog({
  patient,
  onClose,
}: {
  patient: PatientListItem | undefined
  onClose: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [lastShown, setLastShown] = useState(patient)
  if (patient && patient !== lastShown) setLastShown(patient)
  const shown = patient ?? lastShown

  const { data: patientData } = useQuery({
    queryKey: ['patient-detail', shown?.id],
    queryFn: () => (shown ? getApiAdapter().getPatient(shown.id) : null),
    enabled: !!shown,
  })

  const { data: insight } = useQuery({
    queryKey: ['insight', shown?.id],
    queryFn: () => (shown ? getApiAdapter().getInsight(shown.id) : null),
    enabled: !!shown,
  })

  const [editing, setEditing] = useState(false)
  const [editSuggestion, setEditSuggestion] = useState('')
  const [editPrescriptions, setEditPrescriptions] = useState('')

  const devices = shown ? getDeviceGroups(shown.id) : []
  const firstAbnormal = devices.find((d) => d.hasAbnormal) ?? devices[0]
  const [tab, setTab] = useState<string>(
    firstAbnormal?.source ?? devices[0]?.source ?? ''
  )
  const risk = patientData?.risk
  const confidence = patientData?.confidence

  const startEditing = () => {
    setEditSuggestion(insight?.suggestion ?? '')
    setEditPrescriptions('')
    setEditing(true)
  }

  const saveNote = () => {
    if (shown) {
      getApiAdapter().updateInsightNote(
        shown.id,
        editSuggestion,
        editPrescriptions
      )
      toast.success('Note updated.')
      setEditing(false)
    }
  }

  const handleSendToDoctor = () => {
    if (!shown) return
    getApiAdapter().routePatient(shown.id, 'cm-001')
    toast.success('Sent to doctor — notification created in EHR.')
    queryClient.invalidateQueries({ queryKey: ['worklist'] })
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
    onClose()
    navigate({ to: `/ehr/prescriptions/${shown.id}` })
  }

  const trendIcon = (trend: string) => {
    if (trend === 'up') return <TrendingUp className='h-3 w-3 text-red-500' />
    if (trend === 'down')
      return <TrendingDown className='h-3 w-3 text-blue-500' />
    return <Minus className='h-3 w-3 text-gray-500' />
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

              {risk && (
                <div className='mt-3 flex flex-wrap items-center justify-center gap-4'>
                  <div className='flex items-center gap-1'>
                    {trendIcon(risk.trend)}
                    <span className='text-xs capitalize'>
                      {risk.trend} trend
                    </span>
                  </div>
                  <Badge className={cn('text-xs', TIER_COLORS[risk.tier])}>
                    Risk: {risk.score}/100 · {risk.tier}
                  </Badge>
                  {confidence && (
                    <Badge variant='outline' className='text-xs'>
                      Confidence: {confidence.level} (
                      {Math.round(confidence.score * 100)}%)
                    </Badge>
                  )}
                </div>
              )}
            </DialogHeader>

            <div className='min-h-0 flex-1 overflow-y-auto'>
              <div className='p-6'>
                <Tabs
                  key={shown.id}
                  value={tab}
                  onValueChange={setTab}
                  className='w-full'
                >
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

                {insight && (
                  <Card className='mt-6 border border-blue-200 bg-blue-50'>
                    <CardHeader className='pb-3'>
                      <div className='flex items-center justify-between'>
                        <CardTitle className='text-sm font-medium'>
                          Insight Note
                        </CardTitle>
                        {editing ? (
                          <div className='flex gap-1'>
                            <Button size='sm' onClick={saveNote}>
                              <Save className='mr-1 h-3 w-3' />
                              Save
                            </Button>
                            <Button
                              size='sm'
                              variant='ghost'
                              onClick={() => setEditing(false)}
                            >
                              <X className='h-3 w-3' />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size='sm'
                            variant='ghost'
                            onClick={startEditing}
                          >
                            <Edit3 className='h-3 w-3' />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className='space-y-3 pt-0'>
                      {!editing ? (
                        <>
                          <div>
                            <p className='mb-1 text-xs text-muted-foreground'>
                              Suggestion
                            </p>
                            <p className='text-sm font-medium text-blue-700'>
                              {insight.suggestion}
                            </p>
                          </div>
                          <div>
                            <p className='mb-1 text-xs text-muted-foreground'>
                              What changed
                            </p>
                            <p className='text-xs text-blue-600'>
                              {insight.what_changed}
                            </p>
                          </div>
                          {insight.confidence && (
                            <div>
                              <p className='mb-1 text-xs text-muted-foreground'>
                                Confidence
                              </p>
                              <p className='text-xs text-blue-600'>
                                {insight.confidence}
                              </p>
                            </div>
                          )}
                          {insight.sources && (
                            <div>
                              <p className='mb-1 text-xs text-muted-foreground'>
                                Sources
                              </p>
                              <p className='text-xs text-blue-600'>
                                {insight.sources}
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className='space-y-3'>
                          <div>
                            <p className='mb-1 text-xs text-muted-foreground'>
                              CM Suggestion (editable)
                            </p>
                            <Textarea
                              value={editSuggestion}
                              onChange={(e) =>
                                setEditSuggestion(e.target.value)
                              }
                              placeholder='Enter suggestion for clinician...'
                              rows={3}
                              className='text-sm'
                            />
                          </div>
                          <div>
                            <p className='mb-1 text-xs text-muted-foreground'>
                              Prescription suggestions (for Photon integration)
                            </p>
                            <Textarea
                              value={editPrescriptions}
                              onChange={(e) =>
                                setEditPrescriptions(e.target.value)
                              }
                              placeholder='Enter structured prescription suggestions...'
                              rows={3}
                              className='text-sm'
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {shown && (
                  <ViolationsList
                    patientId={shown.id}
                    maxVisible={3}
                    onSelect={(metric) => {
                      const owner = devices.find((d) =>
                        d.series.some((s) => s.metric === metric)
                      )
                      if (owner) setTab(owner.source)
                    }}
                  />
                )}

                {patientData && patientData.worklist && (
                  <Card className='mt-6'>
                    <CardHeader className='pb-3'>
                      <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                        <FileText className='h-4 w-4' />
                        Worklist Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-2'>
                          <Badge
                            className={cn(
                              'text-xs capitalize',
                              TIER_COLORS[patientData.worklist.risk_tier] ??
                                'bg-gray-100 text-gray-800'
                            )}
                          >
                            {patientData.worklist.risk_tier}
                          </Badge>
                          <span className='text-sm text-muted-foreground'>
                            Status:{' '}
                            {String(patientData.worklist.status).replace(
                              /_/g,
                              ' '
                            )}
                          </span>
                        </div>
                        {patientData.worklist.routed_at && (
                          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                            <Calendar className='h-3 w-3' />
                            Routed:{' '}
                            {new Date(
                              patientData.worklist.routed_at
                            ).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            <div className='border-t px-6 py-4'>
              <div className='flex items-center justify-end gap-3'>
                <Button variant='outline' onClick={onClose}>
                  <X className='mr-1 h-4 w-4' />
                  Dismiss
                </Button>
                <Button
                  onClick={handleSendToDoctor}
                  className='bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                >
                  <Send className='mr-2 h-4 w-4' />
                  Send to doctor
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
