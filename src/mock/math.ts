export const clamp = (x: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, x))

export const round = (x: number, digits = 0) => {
  const factor = 10 ** digits
  return Math.round(x * factor) / factor
}

export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

export function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
