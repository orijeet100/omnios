import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { getApiAdapter } from '@/api'
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_authenticated/population/$segmentId')({
  component: SegmentPage,
})

const TREND_ICONS: Record<string, React.ReactNode> = {
  up: <TrendingUp className='h-4 w-4 text-red-500' />,
  down: <TrendingDown className='h-4 w-4 text-blue-500' />,
  flat: <Minus className='h-4 w-4 text-gray-500' />,
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  routed: 'bg-purple-100 text-purple-800',
  acknowledged: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  re_escalated: 'bg-red-100 text-red-800',
}

function SegmentPage() {
  const { segmentId } = Route.useParams()

  const { data: worklist, isLoading } = useQuery({
    queryKey: ['worklist', segmentId],
    queryFn: () => getApiAdapter().listWorklist(),
  })

  const segmentPatients = worklist?.filter((w) => {
    if (segmentId === 'data_gap') return w.data_confidence === 'low'
    if (segmentId === 'bp_off')
      return (
        w.primary_driver === 'bp_systolic' ||
        w.primary_driver === 'bp_diastolic'
      )
    if (segmentId === 'glucose_off')
      return (
        w.primary_driver === 'glucose_time_in_range' ||
        w.primary_driver === 'glucose_mean'
      )
    if (segmentId === 'recovery_off')
      return (
        w.primary_driver === 'resting_hr' ||
        w.primary_driver === 'hrv_rmssd' ||
        w.primary_driver === 'hrv_sdnn' ||
        w.primary_driver === 'resp_rate' ||
        w.primary_driver === 'spo2_avg'
      )
    return true
  })

  if (isLoading) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-8 w-64' />
        <Skeleton className='h-96' />
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-4'>
        <Link to='/population'>
          <ArrowLeft className='h-5 w-5 text-muted-foreground hover:text-foreground' />
        </Link>
        <div>
          <h1 className='text-2xl font-bold capitalize'>
            {segmentId.replace(/_/g, ' ')}
          </h1>
          <p className='text-sm text-muted-foreground'>
            {segmentPatients?.length ?? 0} patients in this segment
          </p>
        </div>
        <Badge variant='secondary' className='ml-auto text-xs'>
          Synthetic data
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Patients</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-2'>
            {segmentPatients?.map((patient) => (
              <Link
                key={patient.patient_id}
                to='/patients/$patientId'
                params={{ patientId: patient.patient_id }}
              >
                <div className='flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50'>
                  <div className='flex items-center gap-4'>
                    <div>
                      <p className='font-medium'>{patient.name}</p>
                      <p className='text-sm text-muted-foreground'>
                        {patient.age}y {patient.sex} •{' '}
                        {patient.conditions.join(', ')}
                      </p>
                    </div>
                  </div>
                  <div className='flex items-center gap-4'>
                    <div className='flex items-center gap-1'>
                      {TREND_ICONS[patient.risk_trend]}
                      <span className='text-sm capitalize'>
                        {patient.risk_trend}
                      </span>
                    </div>
                    <div className='text-right'>
                      <p className='text-lg font-bold'>{patient.risk_score}</p>
                      <p className='text-xs text-muted-foreground capitalize'>
                        {patient.risk_tier}
                      </p>
                    </div>
                    <Badge className={STATUS_COLORS[patient.status]}>
                      {patient.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
