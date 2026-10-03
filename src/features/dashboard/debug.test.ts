import { describe, it } from 'vitest'
import { computeSegments, getDataset } from '@/mock'
import { N_WEEKS, weekStartOfIndex } from '@/mock/dates'
import { weekStartOfIndex as w } from '@/mock/dates'
import { formatWeek } from './segments'

describe('debug', () => {
  it('dumps all weeks', () => {
    const ds = getDataset()
    const weeks = [] as string[]
    for (let i = 0; i < N_WEEKS; i++) weeks.push(w(i))
    const out = weeks.map((wk) => {
      const s = computeSegments(ds.profiles, ds.weeklyFlags, wk)
      return {
        week: wk,
        counts: Object.fromEntries(s.segments.map((seg) => [seg.id, seg.patient_count])),
      }
    })
    throw new Error(JSON.stringify(out, null, 2))
  })
})
