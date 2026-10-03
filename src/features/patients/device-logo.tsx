import { SOURCES, type SourceId } from '@/contracts'

/**
 * Logo files in `public/images`, with a display height per logo. The files
 * differ in shape and padding (Oura has wide margins, Apple is tall, Dexcom
 * carries a tagline), so each gets the height that makes it look about the
 * same size as the others.
 */
const LOGOS: Record<SourceId, { file: string; height: string }> = {
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

/**
 * A device's brand logo. The logos are black, and some have a white
 * background, so they blend into the page: multiply in light mode (white
 * disappears), invert + screen in dark mode (black disappears).
 */
export function DeviceLogo({ source }: { source: SourceId }) {
  const { file, height } = LOGOS[source]
  return (
    <img
      src={`/images/${file}.png`}
      alt={SOURCES[source].name}
      className={`${height} w-auto max-w-24 object-contain mix-blend-multiply dark:mix-blend-screen dark:invert`}
    />
  )
}
