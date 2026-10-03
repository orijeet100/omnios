import { Main } from '@/components/layout/main'
import { AllViolations } from './all-violations'
import { SegmentRow } from './segment-row'
import { getDashboard } from './segments'

export function Dashboard() {
  const { cards } = getDashboard()

  return (
    <Main className='space-y-6'>
      <h1 className='text-2xl font-bold tracking-tight'>
        Patients showing abnormalities
      </h1>
      <div className='space-y-3'>
        {cards.map((segment) => (
          <SegmentRow key={segment.id} segment={segment} />
        ))}
      </div>
      <AllViolations />
    </Main>
  )
}
