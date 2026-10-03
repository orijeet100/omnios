import type { Indicator } from '../data'

/**
 * Targets for the body-scan ratios (placeholders, WHO-style cut-offs
 * **[VERIFY]** before presenting as clinical guidance). Same idea as every
 * other target: at or above it is past target.
 */
const WAIST_HIP_TARGET = { F: 0.85, M: 0.9 } as const
const WAIST_HEIGHT_TARGET = 0.5

const against = (value: number | undefined, target: number) =>
  value == null ? null : value >= target ? ('above' as const) : ('ok' as const)

/** Markers for the two waist ratios; a ratio the scan lacks is left out. */
export function ratioIndicators(
  waistHip: number | undefined,
  waistHeight: number | undefined,
  sex: 'F' | 'M'
): Indicator[] {
  const items: [string, ReturnType<typeof against>][] = [
    ['Waist-hip', against(waistHip, WAIST_HIP_TARGET[sex])],
    ['Waist-height', against(waistHeight, WAIST_HEIGHT_TARGET)],
  ]
  return items.flatMap(([label, status]) => (status ? [{ label, status }] : []))
}
