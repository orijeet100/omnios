import { sexLabel, type PatientListItem } from './data'
import { Indicators } from './indicators'
import { PatientAvatar } from './patient-avatar'

/**
 * A square, clickable patient card: photo, name, age and sex, and arrows for
 * the measurements. The whole tile is one button that opens the patient modal,
 * and it shifts color on hover to show it is clickable.
 */
export function PatientTile({
  patient,
  onSelect,
}: {
  patient: PatientListItem
  onSelect: () => void
}) {
  return (
    <button
      type='button'
      onClick={onSelect}
      className='flex min-h-60 flex-col items-center justify-center gap-3 rounded-xl border bg-card p-4 text-center text-card-foreground shadow-sm transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50'
    >
      <PatientAvatar id={patient.id} sex={patient.sex} />
      <div>
        <div className='font-semibold'>{patient.name}</div>
        <div className='text-xs text-muted-foreground'>
          {patient.age} · {sexLabel(patient.sex)}
        </div>
      </div>
      <Indicators items={patient.indicators} />
    </button>
  )
}
