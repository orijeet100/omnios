import { Activity } from 'lucide-react'
import { SOURCES, type SourceId } from '@/contracts'

const LOGOS: Partial<Record<SourceId, { file: string; height: string }>> = {
  apple_watch: { file: 'apple', height: 'h-6' },
  fitbit: { file: 'fitbit', height: 'h-4' },
  garmin: { file: 'garmin', height: 'h-4' },
  oura: { file: 'oura', height: 'h-10' },
  whoop: { file: 'whoop', height: 'h-3' },
  dexcom: { file: 'dexcom', height: 'h-6' },
  libre: { file: 'libre', height: 'h-10' },
  omron: { file: 'omron', height: 'h-3.5' },
  withings: { file: 'withings', height: 'h-3' },
}

export function DeviceLogo({ source }: { source: SourceId }) {
  const entry = LOGOS[source]
  if (!entry) {
    return (
      <div className='flex h-6 w-6 items-center justify-center rounded bg-muted text-muted-foreground'>
        <Activity className='h-4 w-4' />
      </div>
    )
  }
  const { file, height } = entry
  return (
    <img
      src={`/images/${file}.png`}
      alt={SOURCES[source].name}
      className={`${height} w-auto max-w-24 object-contain mix-blend-multiply dark:mix-blend-screen dark:invert`}
    />
  )
}
