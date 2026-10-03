import { useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { getAllPatients, matchesQuery } from './data'
import { PatientDialog } from './patient-dialog'
import { PatientTile } from './patient-tile'

const ROUTE_ID = '/_app/patients'
const ROUTE_PATH = '/patients'

export function AllPatients() {
  const { patient: openId } = useSearch({ from: ROUTE_ID })
  const navigate = useNavigate({ from: ROUTE_PATH })
  const [query, setQuery] = useState('')

  const everyone = getAllPatients()
  const patients = everyone.filter((p) => matchesQuery(p, query))

  return (
    <>
      <AppHeader />
      <Main className='space-y-6'>
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div className='space-y-1'>
            <h1 className='text-2xl font-bold tracking-tight'>All patients</h1>
            <p className='text-sm text-muted-foreground'>
              {patients.length} patients
            </p>
          </div>
          <div className='relative w-full sm:w-72'>
            <Search
              className='pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground'
              aria-hidden
            />
            <Input
              type='search'
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder='Search patients'
              aria-label='Search patients'
              className='ps-9'
            />
          </div>
        </div>

        {patients.length === 0 ? (
          <p className='text-sm text-muted-foreground'>No patients found.</p>
        ) : (
          <div className='grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
            {patients.map((patient) => (
              <PatientTile
                key={patient.id}
                patient={patient}
                onSelect={() => navigate({ search: { patient: patient.id } })}
              />
            ))}
          </div>
        )}
      </Main>

      <PatientDialog
        patient={everyone.find((p) => p.id === openId)}
        onClose={() => navigate({ search: {} })}
      />
    </>
  )
}
