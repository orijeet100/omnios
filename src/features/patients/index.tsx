import { useNavigate, useSearch } from '@tanstack/react-router'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { getAllPatients } from './data'
import { PatientDialog } from './patient-dialog'
import { PatientTile } from './patient-tile'

const ROUTE_ID = '/_app/patients'
const ROUTE_PATH = '/patients'

export function AllPatients() {
  const { patient: openId } = useSearch({ from: ROUTE_ID })
  const navigate = useNavigate({ from: ROUTE_PATH })
  const patients = getAllPatients()

  return (
    <>
      <AppHeader />
      <Main className='space-y-6'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-bold tracking-tight'>All patients</h1>
          <p className='text-sm text-muted-foreground'>
            {patients.length} patients
          </p>
        </div>
        <div className='grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
          {patients.map((patient) => (
            <PatientTile
              key={patient.id}
              patient={patient}
              badge={
                patient.abnormal ? (
                  <span
                    role='img'
                    aria-label='Abnormal'
                    className='mt-1.5 size-2 shrink-0 rounded-full bg-destructive'
                  />
                ) : undefined
              }
              onSelect={() => navigate({ search: { patient: patient.id } })}
            />
          ))}
        </div>
      </Main>

      <PatientDialog
        patient={patients.find((p) => p.id === openId)}
        onClose={() => navigate({ search: {} })}
      />
    </>
  )
}
