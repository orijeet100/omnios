import { describe, expect, it } from 'vitest'
import {
  METRICS,
  observationSchema,
  patientChartSchema,
  resolvedMetricSchema,
  weeklyFlagSchema,
} from '../contracts'
import { COHORT_SPEC } from './cohort-spec'
import { N_WEEKS, addDays, weekStartOfIndex } from './dates'
import { buildDataset, computeSegments, type Dataset } from './index'
import type { Archetype } from './types'

const ds: Dataset = buildDataset()
const weeks = Array.from({ length: N_WEEKS }, (_, w) => weekStartOfIndex(w))
const lastWeek = weeks[N_WEEKS - 1]

const segmentsByWeek = new Map(
  weeks.map((w) => [w, computeSegments(ds.profiles, ds.weeklyFlags, w)])
)
const inSegment = (week: string, id: string, patientId: string) =>
  segmentsByWeek
    .get(week)!
    .segments.find((s) => s.id === id)!
    .patient_ids.includes(patientId)

const ids = (a: Archetype) =>
  ds.profiles.filter((p) => p.archetype === a).map((p) => p.id)
const share = (xs: string[], pred: (id: string) => boolean) =>
  xs.filter(pred).length / xs.length

describe('cohort', () => {
  it('has 100 synthetic patients with the planned archetype mix', () => {
    expect(ds.profiles).toHaveLength(100)
    const expected: Record<Archetype, number> = {
      stable_controlled: 39,
      stable_bp_uncontrolled: 8,
      bp_drifting: 15,
      glucose_off: 10,
      near_target_improving: 8,
      acute_decliner: 7,
      low_adherence: 8,
      false_alarm: 5,
    }
    for (const [a, n] of Object.entries(expected))
      expect(ids(a as Archetype)).toHaveLength(n)
    expect(COHORT_SPEC.reduce((s, r) => s + r.count, 0)).toBe(100)
  })

  it('is deterministic for the same seed', () => {
    const again = buildDataset()
    expect(again.observations.length).toBe(ds.observations.length)
    expect(again.observations[1234]).toEqual(ds.observations[1234])
    expect(again.weeklyFlags).toEqual(ds.weeklyFlags)
  })

  it('has all five planted stories', () => {
    const stories = new Set(ds.profiles.flatMap((p) => p.stories))
    for (const s of [
      'true_positive',
      'false_alarm',
      'device_gap',
      'recovering',
      'reescalation_candidate',
    ])
      expect(stories.has(s as never)).toBe(true)
    expect(ds.groundTruth.filter((g) => g.er_date)).toHaveLength(3)
  })
})

describe('contract shapes', () => {
  it('every chart, weekly flag and sampled observation/resolved row passes its schema', () => {
    for (const c of ds.charts)
      expect(patientChartSchema.safeParse(c).success).toBe(true)
    for (const f of ds.weeklyFlags)
      expect(weeklyFlagSchema.safeParse(f).success).toBe(true)
    for (let i = 0; i < ds.observations.length; i += 40)
      expect(observationSchema.safeParse(ds.observations[i]).success).toBe(true)
    for (let i = 0; i < ds.resolved.length; i += 40)
      expect(resolvedMetricSchema.safeParse(ds.resolved[i]).success).toBe(true)
  })

  it('only produces metrics a patient device can supply, with correct units', () => {
    for (const o of ds.observations.slice(0, 5000))
      expect(o.unit).toBe(METRICS[o.metric].unit)
  })
})

describe('messiness', () => {
  it('includes implausible values, multi-source conflicts, and gaps', () => {
    expect(ds.observations.some((o) => o.quality_flag === 'implausible')).toBe(
      true
    )
    expect(ds.resolved.some((x) => x.conflict)).toBe(true)
    expect(ds.resolved.some((x) => x.candidates.length > 1)).toBe(true)
  })

  it('never lets an implausible value win resolution', () => {
    for (const x of ds.resolved) {
      const winner = x.candidates.find((c) => c.source_id === x.resolved_from)!
      expect(winner.quality_flag).toBe('ok')
    }
  })
})

describe('planted stories land in the right segments (weekly check)', () => {
  it('stable controlled patients are rarely flagged (specificity)', () => {
    const stable = ids('stable_controlled')
    let flagged = 0
    let total = 0
    for (const w of weeks)
      for (const id of stable)
        for (const seg of ['bp_off', 'glucose_off', 'recovery_off']) {
          total++
          if (inSegment(w, seg, id)) flagged++
        }
    expect(flagged / total).toBeLessThan(0.02)
  })

  it('chronically uncontrolled BP is off in the latest week', () => {
    expect(
      share(ids('stable_bp_uncontrolled'), (id) =>
        inSegment(lastWeek, 'bp_off', id)
      )
    ).toBeGreaterThanOrEqual(0.85)
  })

  it('drifting BP patients are off in the latest week and were fine early on', () => {
    const drift = ids('bp_drifting')
    expect(
      share(drift, (id) => inSegment(lastWeek, 'bp_off', id))
    ).toBeGreaterThanOrEqual(0.85)
    expect(
      share(drift, (id) => inSegment(weeks[1], 'bp_off', id))
    ).toBeLessThanOrEqual(0.1)
  })

  it('glucose-off patients are off in the latest week', () => {
    expect(
      share(ids('glucose_off'), (id) => inSegment(lastWeek, 'glucose_off', id))
    ).toBeGreaterThanOrEqual(0.8)
  })

  it('near-target improving patients were off early and are ok by the latest week', () => {
    const near = ids('near_target_improving')
    const offIn = (w: string, id: string) =>
      inSegment(w, 'bp_off', id) || inSegment(w, 'glucose_off', id)
    expect(share(near, (id) => offIn(weeks[1], id))).toBeGreaterThanOrEqual(
      0.75
    )
    expect(share(near, (id) => !offIn(lastWeek, id))).toBeGreaterThanOrEqual(
      0.85
    )
  })

  it('false alarms never trip any check in any week', () => {
    for (const id of ids('false_alarm'))
      for (const w of weeks)
        for (const seg of ['bp_off', 'glucose_off', 'recovery_off'])
          expect(inSegment(w, seg, id), `${id} ${w} ${seg}`).toBe(false)
  })

  it('true positives are flagged before their ER visit (lead time)', () => {
    for (const g of ds.groundTruth.filter((x) => x.er_date)) {
      const lastFullWeekBeforeEr = weeks.filter(
        (w) => addDays(w, 6) < g.er_date!
      )
      const flaggedWeeks = lastFullWeekBeforeEr.filter((w) =>
        ['bp_off', 'glucose_off', 'recovery_off'].some((seg) =>
          inSegment(w, seg, g.patient_id)
        )
      )
      expect(flaggedWeeks.length, g.patient_id).toBeGreaterThan(0)
    }
  })

  it('declining patients show recovery signals off in the latest weeks', () => {
    const dec = ids('acute_decliner')
    const anyRecovery = (id: string) =>
      weeks.slice(-3).some((w) => inSegment(w, 'recovery_off', id))
    expect(share(dec, anyRecovery)).toBeGreaterThanOrEqual(0.85)
  })

  it('low-adherence patients are mostly in the data gap segment across weeks', () => {
    const low = ids('low_adherence')
    const perWeek = weeks
      .slice(2)
      .map((w) => share(low, (id) => inSegment(w, 'data_gap', id)))
    const avg = perWeek.reduce((a, b) => a + b, 0) / perWeek.length
    expect(avg).toBeGreaterThanOrEqual(0.6)
  })

  it('device-swap patients show a data gap during the swap', () => {
    const swapped = ds.profiles.filter((p) => p.stories.includes('device_gap'))
    expect(swapped).toHaveLength(4)
    for (const p of swapped) {
      const gapWeeks = weeks.filter((w) => inSegment(w, 'data_gap', p.id))
      expect(gapWeeks.length, p.id).toBeGreaterThan(0)
    }
  })
})

describe('latest-week segments', () => {
  it('have plausible counts and a fixed order', () => {
    const seg = segmentsByWeek.get(lastWeek)!
    expect(seg.segments.map((s) => s.id)).toEqual([
      'bp_off',
      'glucose_off',
      'recovery_off',
      'data_gap',
    ])
    const count = (id: string) =>
      seg.segments.find((s) => s.id === id)!.patient_count
    // 8 uncontrolled + 15 drifting BP patients are the planted BP-off group.
    expect(count('bp_off')).toBeGreaterThanOrEqual(15)
    expect(count('bp_off')).toBeLessThanOrEqual(30)
    expect(count('glucose_off')).toBeGreaterThanOrEqual(6)
    expect(count('glucose_off')).toBeLessThanOrEqual(16)
    expect(count('recovery_off')).toBeGreaterThanOrEqual(3)
    expect(count('data_gap')).toBeGreaterThanOrEqual(3)
  })
})
