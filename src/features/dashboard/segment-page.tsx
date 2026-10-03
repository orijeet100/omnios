import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { segmentIdSchema } from '@/contracts'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { NotFoundError } from '@/features/errors/not-found-error'
import { PatientDialog } from '@/features/patients/patient-dialog'
import { PatientTile } from '@/features/patients/patient-tile'
import { getSegmentDetail, type SegmentPatient } from './segments'

const ROUTE_ID = '/_app/segments/$segmentId'
const ROUTE_PATH = '/segments/$segmentId'

function WeeksBadge({ patient }: { patient: SegmentPatient }) {
  if (patient.weeksOff == null) {
    return (
      <Badge variant='outline' className='shrink-0'>
        No data
      </Badge>
    )
  }
  return (
    <Badge variant='destructive' className='shrink-0'>
      {patient.weeksOff === 1 ? 'This week' : `${patient.weeksOff} wks`}
    </Badge>
  )
}

export function SegmentPage() {
  const { segmentId } = useParams({ from: ROUTE_ID })
  const { patient: openId } = useSearch({ from: ROUTE_ID })
  const navigate = useNavigate({ from: ROUTE_PATH })

  const parsed = segmentIdSchema.safeParse(segmentId)
  if (!parsed.success) return <NotFoundError />
  const { card, patients } = getSegmentDetail(parsed.data)

  return (
    <>
      <AppHeader />
      <Main className='space-y-6'>
        <div className='space-y-3'>
          <Button asChild variant='ghost' size='sm' className='-ms-3'>
            <Link to='/'>
              <ArrowLeft />
              Back
            </Link>
          </Button>
          <div className='space-y-1'>
            <h1 className='text-2xl font-bold tracking-tight'>{card.label}</h1>
            <p className='text-sm text-muted-foreground'>
              {card.count} of {card.evaluated} patients
            </p>
          </div>
        </div>

        {patients.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            No patients this week.
          </p>
        ) : (
          <div className='grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
            {patients.map((patient) => (
              <PatientTile
                key={patient.id}
                patient={patient}
                badge={<WeeksBadge patient={patient} />}
                onSelect={() => navigate({ search: { patient: patient.id } })}
              />
            ))}
          </div>
        )}
      </Main>

      <PatientDialog
        patient={patients.find((p) => p.id === openId)}
        onClose={() => navigate({ search: {} })}
      />
    </>
  )
}
