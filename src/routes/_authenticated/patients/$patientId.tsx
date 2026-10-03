import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { getApiAdapter } from '@/api'
import {
  ArrowLeft,
  Send,
  AlertCircle,
  CheckCircle,
  WifiOff,
  Edit3,
  X,
  AlertTriangle,
  Activity,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'

export const Route = createFileRoute('/_authenticated/patients/$patientId')({
  component: PatientDetailPage,
})

const CONFIDENCE_ICONS: Record<string, React.ReactNode> = {
  high: <CheckCircle className='h-4 w-4 text-green-500' />,
  medium: <AlertCircle className='h-4 w-4 text-yellow-500' />,
  low: <WifiOff className='h-4 w-4 text-red-500' />,
}

const METRICS_LIST = [
  { id: 'bp_systolic', label: 'BP Systolic', color: '#ef4444' },
  { id: 'bp_diastolic', label: 'BP Diastolic', color: '#f97316' },
  { id: 'resting_hr', label: 'Resting HR', color: '#3b82f6' },
  { id: 'hrv_rmssd', label: 'HRV (rMSSD)', color: '#8b5cf6' },
  { id: 'hrv_sdnn', label: 'HRV (SDNN)', color: '#6366f1' },
  { id: 'glucose_mean', label: 'Glucose Mean', color: '#10b981' },
  { id: 'glucose_time_in_range', label: 'Glucose TIR', color: '#059669' },
  { id: 'spo2_avg', label: 'SpO2 Avg', color: '#06b6d4' },
  { id: 'resp_rate', label: 'Resp Rate', color: '#0891b2' },
  { id: 'sleep_duration', label: 'Sleep Duration', color: '#6366f1' },
  { id: 'steps', label: 'Steps', color: '#84cc16' },
  { id: 'body_fat_pct', label: 'Body Fat %', color: '#f59e0b' },
  { id: 'weight', label: 'Weight', color: '#78716c' },
]

function PatientDetailPage() {
  const { patientId } = Route.useParams()
  const [routing, setRouting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editSuggestion, setEditSuggestion] = useState('')
  const [editPrescriptions, setEditPrescriptions] = useState('')
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    'bp_systolic',
  ])

  const { data, isLoading } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => getApiAdapter().getPatient(patientId),
  })

  const { data: resolvedData } = useQuery({
    queryKey: ['resolved', patientId],
    queryFn: () => {
      const adapter = getApiAdapter()
      const end = '2026-09-27'
      const start = '2026-08-28'
      return adapter.getResolvedSeries(patientId, start, end)
    },
  })

  const { data: connections } = useQuery({
    queryKey: ['connections', patientId],
    queryFn: () => getApiAdapter().getPatientConnections(patientId),
  })

  if (isLoading || !data) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-8 w-64' />
        <Skeleton className='h-96' />
      </div>
    )
  }

  const { patient, risk, confidence, deviations, worklist } = data

  const handleRoute = () => {
    setRouting(true)
    const result = getApiAdapter().routePatient(patientId, 'cm-001')
    if (result) {
      toast.success('Request submitted (demo mode).')
    }
    setRouting(false)
  }

  const handleSaveNote = () => {
    getApiAdapter().updateInsightNote(
      patientId,
      editSuggestion,
      editPrescriptions
    )
    toast.success('Note updated.')
    setEditing(false)
  }

  const startEditing = () => {
    setEditSuggestion(data.insight?.suggestion ?? '')
    setEditPrescriptions('')
    setEditing(true)
  }

  const toggleMetric = (metricId: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(metricId)
        ? prev.filter((m) => m !== metricId)
        : [...prev, metricId]
    )
  }

  const chartData: Record<string, any>[] = []
  const allDates = new Set<string>()

  for (const series of resolvedData ?? []) {
    if (!selectedMetrics.includes(series.metric)) continue
    for (const point of series.points) {
      allDates.add(point.date)
    }
  }

  const sortedDates = [...allDates].sort()
  for (const date of sortedDates) {
    const entry: Record<string, any> = { date: date.slice(5) }
    for (const series of resolvedData ?? []) {
      if (!selectedMetrics.includes(series.metric)) continue
      const point = series.points.find((p) => p.date === date)
      if (point) {
        entry[series.metric] = point.value
      }
    }
    chartData.push(entry)
  }

  const conflictCount =
    resolvedData?.reduce(
      (count, series) => count + series.points.filter((p) => p.conflict).length,
      0
    ) ?? 0

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <Link to='/population'>
            <ArrowLeft className='h-5 w-5 text-muted-foreground hover:text-foreground' />
          </Link>
          <div>
            <h1 className='text-2xl font-bold'>{patient.name}</h1>
            <p className='text-sm text-muted-foreground'>
              {patient.age}y {patient.sex} • {patient.conditions.join(', ')}
            </p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Badge variant='secondary' className='text-xs'>
            Synthetic data
          </Badge>
          <Button
            onClick={handleRoute}
            disabled={routing || worklist.status === 'routed'}
          >
            <Send className='mr-2 h-4 w-4' />
            Export to EHR
          </Button>
        </div>
      </div>

      <div className='grid gap-4 md:grid-cols-3'>
        <Card>
          <CardContent className='pt-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium'>Risk Score</p>
                <p className='text-2xl font-bold'>{risk.score}</p>
              </div>
              <Badge className='text-xs capitalize'>{risk.tier}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium'>Confidence</p>
                <p className='text-2xl font-bold capitalize'>
                  {confidence.level}
                </p>
              </div>
              {CONFIDENCE_ICONS[confidence.level]}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium'>Status</p>
                <p className='text-2xl font-bold capitalize'>
                  {worklist.status.replace(/_/g, ' ')}
                </p>
              </div>
              <Badge className='text-xs capitalize'>{worklist.risk_tier}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-4 lg:grid-cols-3'>
        <Card className='lg:col-span-2'>
          <CardHeader>
            <CardTitle>Multi-Device Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='mb-4 flex flex-wrap gap-1'>
              {METRICS_LIST.map((m) => (
                <Button
                  key={m.id}
                  size='sm'
                  variant={
                    selectedMetrics.includes(m.id) ? 'default' : 'outline'
                  }
                  onClick={() => toggleMetric(m.id)}
                  className='text-xs'
                >
                  {m.label}
                </Button>
              ))}
            </div>
            <ResponsiveContainer width='100%' height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis dataKey='date' tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                {METRICS_LIST.filter((m) => selectedMetrics.includes(m.id)).map(
                  (m) => (
                    <Line
                      key={m.id}
                      type='monotone'
                      dataKey={m.id}
                      stroke={m.color}
                      strokeWidth={2}
                      dot={false}
                      name={m.label}
                    />
                  )
                )}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle className='text-sm'>Connected Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-2'>
                {connections?.map((conn) => (
                  <div
                    key={conn.id}
                    className='flex items-center justify-between'
                  >
                    <div className='flex items-center gap-2'>
                      <Activity className='h-3 w-3' />
                      <span className='text-sm'>
                        {conn.source_id.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <Badge
                      variant={
                        conn.status === 'connected'
                          ? 'default'
                          : conn.status === 'stale'
                            ? 'secondary'
                            : 'destructive'
                      }
                      className='text-xs'
                    >
                      {conn.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {conflictCount > 0 && (
            <Card className='border-yellow-200 bg-yellow-50'>
              <CardContent className='pt-4'>
                <div className='flex items-center gap-2'>
                  <AlertTriangle className='h-4 w-4 text-yellow-600' />
                  <p className='text-sm font-medium text-yellow-800'>
                    {conflictCount} device conflict
                    {conflictCount > 1 ? 's' : ''} detected
                  </p>
                </div>
                <p className='mt-1 text-xs text-yellow-600'>
                  Multiple sources disagree on some values
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className='text-sm'>Key Deviations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-2'>
                {deviations
                  .filter((d) => Math.abs(d.z_score) > 1)
                  .slice(0, 4)
                  .map((d) => (
                    <div
                      key={d.metric}
                      className='flex items-center justify-between'
                    >
                      <span className='text-xs'>
                        {d.metric.replace(/_/g, ' ')}
                      </span>
                      <Badge
                        variant={d.delta_abs > 0 ? 'destructive' : 'default'}
                        className='text-xs'
                      >
                        {d.delta_abs > 0 ? '+' : ''}
                        {d.delta_abs}
                      </Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle>Insight Note</CardTitle>
            <Button size='sm' variant='outline' onClick={startEditing}>
              <Edit3 className='mr-1 h-3 w-3' />
              Edit Note
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className='space-y-4'>
              <div>
                <p className='mb-2 text-sm font-medium text-muted-foreground'>
                  Suggestion (editable)
                </p>
                <Textarea
                  value={editSuggestion}
                  onChange={(e) => setEditSuggestion(e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <p className='mb-2 text-sm font-medium text-muted-foreground'>
                  Prescription Suggestions (editable)
                </p>
                <Textarea
                  value={editPrescriptions}
                  onChange={(e) => setEditPrescriptions(e.target.value)}
                  rows={3}
                  placeholder='Enter prescription suggestions for the clinician...'
                />
              </div>
              <div className='flex items-center gap-2'>
                <Button size='sm' onClick={handleSaveNote}>
                  <CheckCircle className='mr-1 h-3 w-3' />
                  Save
                </Button>
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={() => setEditing(false)}
                >
                  <X className='mr-1 h-3 w-3' />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className='space-y-4'>
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  What changed
                </p>
                <p className='text-sm'>
                  {data.insight?.what_changed ?? 'No significant changes'}
                </p>
              </div>
              <Separator />
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Versus baseline
                </p>
                <p className='text-sm'>
                  {data.insight?.versus_baseline ?? "Patient's 30-day median"}
                </p>
              </div>
              <Separator />
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Window
                </p>
                <p className='text-sm'>
                  {data.insight?.window ?? 'Last 7 days'}
                </p>
              </div>
              <Separator />
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Confidence
                </p>
                <p className='text-sm'>
                  {data.insight?.confidence ?? confidence.summary}
                </p>
              </div>
              <Separator />
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Sources
                </p>
                <p className='text-sm'>
                  {data.insight?.sources ?? 'Multiple devices'}
                </p>
              </div>
              <Separator />
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Suggestion
                </p>
                <p className='text-sm font-medium text-blue-600'>
                  {data.insight?.suggestion ?? 'Flag for clinician review'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
