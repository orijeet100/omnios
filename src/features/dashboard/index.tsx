import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { SegmentRow } from './segment-row'
import { formatWeek, getDashboard } from './segments'

export function Dashboard() {
  const { weekStart, cards } = getDashboard()

  return (
    <>
      <AppHeader />
      <Main className='space-y-6'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-bold tracking-tight'>
            Patients showing abnormalities
          </h1>
          <p className='text-sm text-muted-foreground'>
            Week of {formatWeek(weekStart)}
          </p>
        </div>
        <div className='space-y-3'>
          {cards.map((segment) => (
            <SegmentRow key={segment.id} segment={segment} />
          ))}
        </div>
      </Main>
    </>
  )
}
