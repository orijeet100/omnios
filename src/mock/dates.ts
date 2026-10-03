/**
 * Fixed demo window: 13 full Monday-to-Sunday weeks (91 days) so every week is
 * complete. All dates are plain YYYY-MM-DD strings handled in UTC.
 */

const DAY_MS = 86_400_000

export const DATA_END = '2026-09-27' // a Sunday
export const N_DAYS = 91
export const N_WEEKS = 13
export const LAST_DAY = N_DAYS - 1

const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`)

export const addDays = (iso: string, days: number) =>
  new Date(toMs(iso) + days * DAY_MS).toISOString().slice(0, 10)

export const dayDiff = (a: string, b: string) =>
  Math.round((toMs(a) - toMs(b)) / DAY_MS)

export const DATA_START = addDays(DATA_END, -LAST_DAY) // a Monday

/** Day index 0..90 within the window. */
export const dayIndex = (iso: string) => dayDiff(iso, DATA_START)

export const dateOfDay = (day: number) => addDays(DATA_START, day)

export const weekStartOfIndex = (week: number) => addDays(DATA_START, week * 7)
