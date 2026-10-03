import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsSent } from '@/hooks/use-notifications'
import { sexLabel, type PatientListItem } from './data'
import { Indicators } from './indicators'
import { PatientAvatar } from './patient-avatar'

/**
 * A square, clickable patient card: photo, name, age and sex, and arrows for
 * the measurements. The whole tile is one button that opens the patient modal,
 * and it shifts color on hover to show it is clickable. Once the patient has
 * been sent to the doctor the card turns gray and says so.
 */
export function PatientTile({
  patient,
  onSelect,
}: {
  patient: PatientListItem
  onSelect: () => void
}) {
  const sent = useIsSent(patient.id)

  return (
    <button
      type='button'
      onClick={onSelect}
      className={cn(
        'flex min-h-60 flex-col items-center justify-center gap-3 rounded-xl border bg-card p-4 text-center text-card-foreground shadow-sm transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
        sent && 'bg-muted/60 text-muted-foreground [&_img]:grayscale'
      )}
    >
      <PatientAvatar id={patient.id} sex={patient.sex} />
      <div>
        <div className='font-semibold'>{patient.name}</div>
        <div className='text-xs text-muted-foreground'>
          {patient.age} · {sexLabel(patient.sex)}
        </div>
      </div>
      <Indicators items={patient.indicators} />
      {sent && (
        <span className='flex items-center gap-1 text-xs text-muted-foreground'>
          <Send className='size-3' aria-hidden />
          Sent to doctor
        </span>
      )}
    </button>
  )
}
