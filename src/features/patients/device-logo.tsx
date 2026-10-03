import { SOURCES, type SourceId } from '@/contracts'
import { Activity } from 'lucide-react'

/**
 * Logo files in `public/images`, with a display height per logo. The files
 * differ in shape and padding (Oura has wide margins, Apple is tall, Dexcom
 * carries a tagline), so each gets the height that makes it look about the
 * same size as the others. A source with no logo shows a generic icon.
 */
const LOGOS: Partial<
  Record<SourceId, { file: string; ext?: 'jpg'; height: string }>
> = {
  apple_watch: { file: 'apple', height: 'h-6' },
  fitbit: { file: 'fitbit', height: 'h-4' },
  garmin: { file: 'garmin', height: 'h-4' },
  oura: { file: 'oura', height: 'h-10' },
  whoop: { file: 'whoop', height: 'h-3' },
  dexcom: { file: 'dexcom', height: 'h-6' },
  libre: { file: 'libre', height: 'h-10' },
  omron: { file: 'omron', height: 'h-3.5' },
  withings: { file: 'withings', height: 'h-3' },
  visualize_ai: { file: 'visualize', ext: 'jpg', height: 'h-7' },
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
  const { file, ext = 'png', height } = entry
  return (
    <img
      src={`/images/${file}.${ext}`}
      alt={SOURCES[source].name}
      className={`${height} w-auto max-w-24 object-contain mix-blend-multiply dark:mix-blend-screen dark:invert`}
    />
  )
}
