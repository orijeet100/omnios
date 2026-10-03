import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { getApiAdapter } from '@/api'
import { ArrowLeft, Monitor, Stethoscope } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_authenticated/handoff/$patientId')({
  component: HandoffPage,
})

function HandoffPage() {
  const { patientId } = Route.useParams()

  const { data, isLoading } = useQuery({
    queryKey: ['handoff', patientId],
    queryFn: () => getApiAdapter().getSplitScreenData(patientId),
  })

  if (isLoading || !data || !data.patient) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-8 w-64' />
        <Skeleton className='h-96' />
      </div>
    )
  }

  const { patient, ehr } = data as typeof data & {
    patient: NonNullable<typeof data.patient>
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-4'>
        <Link to='/patients/$patientId' params={{ patientId }}>
          <ArrowLeft className='h-5 w-5 text-muted-foreground hover:text-foreground' />
        </Link>
        <div>
          <h1 className='text-2xl font-bold'>Care Handoff</h1>
          <p className='text-sm text-muted-foreground'>
            OmniOS to EHR — {patient.patient.name}
          </p>
        </div>
        <Badge variant='secondary' className='ml-auto text-xs'>
          Synthetic data
        </Badge>
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <Monitor className='h-4 w-4' />
              <CardTitle>OmniOS Platform</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              <div className='grid gap-2 md:grid-cols-3'>
                <div>
                  <p className='text-xs text-muted-foreground'>Risk Score</p>
                  <p className='text-lg font-bold'>{patient.risk.score}</p>
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>Confidence</p>
                  <p className='text-lg font-bold capitalize'>
                    {patient.confidence.level}
                  </p>
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>Status</p>
                  <p className='text-lg font-bold capitalize'>
                    {patient.worklist.status.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
              <Separator />
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  What changed
                </p>
                <p className='text-sm'>
                  {patient.insight?.what_changed ?? 'No significant changes'}
                </p>
              </div>
              <Separator />
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Suggestion
                </p>
                <p className='text-sm font-medium text-blue-600'>
                  {patient.insight?.suggestion ?? 'Flag for clinician review'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <Stethoscope className='h-4 w-4' />
              <CardTitle>EHR Mockup</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {ehr.chart ? (
              <div className='space-y-4'>
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Patient
                  </p>
                  <p className='text-sm'>
                    {ehr.chart.name} — {ehr.chart.age}y {ehr.chart.sex}
                  </p>
                </div>
                <Separator />
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Conditions
                  </p>
                  <div className='flex flex-wrap gap-1'>
                    {ehr.chart.conditions.map((c) => (
                      <Badge key={c} variant='outline' className='text-xs'>
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Medications
                  </p>
                  {ehr.chart.medications.map((m, i) => (
                    <p key={i} className='text-sm'>
                      {m.label}
                    </p>
                  ))}
                </div>
                <Separator />
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Recent Labs
                  </p>
                  {ehr.chart.labs.map((l, i) => (
                    <p key={i} className='text-sm'>
                      {l.name}: {l.value} {l.unit}
                    </p>
                  ))}
                </div>
                <Separator />
                <div className='rounded-lg bg-blue-50 p-3'>
                  <p className='text-sm font-medium text-blue-800'>
                    OmniOS Notification
                  </p>
                  <p className='mt-1 text-xs text-blue-600'>
                    {patient.insight?.suggestion ?? 'Flag for clinician review'}
                  </p>
                </div>
              </div>
            ) : (
              <p className='text-sm text-muted-foreground'>
                No EHR data available
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
