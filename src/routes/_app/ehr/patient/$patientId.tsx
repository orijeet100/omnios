import { Link, createFileRoute } from '@tanstack/react-router'
import { getApiAdapter } from '@/api'
import { ArrowLeft, Pill } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OmniosInsightsCard } from '@/features/ehr/omnios-insights-card'
import { PatientChartCard } from '@/features/ehr/patient-chart-card'

export const Route = createFileRoute('/_app/ehr/patient/$patientId')({
  component: PatientDetails,
})

function PatientDetails() {
  const { patientId } = Route.useParams()
  const chart = getApiAdapter().getEhrChart(patientId)

  if (!chart) return <div className='p-6'>Patient not found</div>

  return (
    <div className='mx-auto w-full max-w-[110rem] space-y-6 px-4 py-6 sm:px-6'>
      <div className='flex items-center justify-between gap-4'>
        <Button asChild variant='ghost' size='sm' className='-ms-3'>
          <Link to='/ehr'>
            <ArrowLeft />
            Inbox
          </Link>
        </Button>
        <Button asChild>
          <Link to='/ehr/prescriptions/$patientId' params={{ patientId }}>
            <Pill />
            Prescribe
          </Link>
        </Button>
      </div>

      <div className='grid grid-cols-1 items-start gap-4 lg:grid-cols-3'>
        <PatientChartCard chart={chart} />
        <div className='lg:col-span-2'>
          <OmniosInsightsCard patientId={patientId} />
        </div>
      </div>
    </div>
  )
}
