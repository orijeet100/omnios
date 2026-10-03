/** Tiny seeded random helpers so the mock data is identical on every run. */

export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a hash of the parts, so each patient/stream gets its own stable seed. */
export function hashSeed(...parts: (string | number)[]): number {
  const text = parts.join('|')
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export const rnd = (rng: Rng, lo: number, hi: number) => lo + rng() * (hi - lo)

/** Whole number in [lo, hi], both ends included. */
export const int = (rng: Rng, lo: number, hi: number) =>
  Math.floor(rnd(rng, lo, hi + 1))

export const chance = (rng: Rng, probability: number) => rng() < probability

export const pick = <T>(rng: Rng, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length)]

/** Box-Muller transform. */
export function normal(rng: Rng, mean = 0, sd = 1): number {
  const u1 = 1 - rng()
  const u2 = rng()
  return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

/** Knuth's algorithm; fine for the small rates used here. */
export function poisson(rng: Rng, lambda: number): number {
  const limit = Math.exp(-lambda)
  let count = 0
  let product = 1
  do {
    count++
    product *= rng()
  } while (product > limit)
  return count - 1
}

/** Fisher-Yates. Returns a new array. */
export function shuffle<T>(rng: Rng, items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function weightedPick<T>(rng: Rng, items: readonly [T, number][]): T {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0)
  let remaining = rng() * total
  for (const [item, weight] of items) {
    remaining -= weight
    if (remaining <= 0) return item
  }
  return items[items.length - 1][0]
}
