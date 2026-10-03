import { CHECKS } from '@/contracts'
import { describe, expect, it } from 'vitest'
import {
  getAllPatients,
  getDeviceGroups,
  matchesQuery,
  type PatientListItem,
} from './data'

const patients = getAllPatients()
const search = (query: string) =>
  patients.filter((p: PatientListItem) => matchesQuery(p, query))

describe('patient list', () => {
  it('has every patient, in id order', () => {
    expect(patients).toHaveLength(100)
    expect(patients.map((p) => p.id)).toEqual(
      [...patients.map((p) => p.id)].sort()
    )
  })

  it('shows each measurement as one arrow, out-of-range first', () => {
    for (const { indicators } of patients) {
      const labels = indicators.map((i) => i.label)
      expect(new Set(labels).size).toBe(labels.length)
      const firstNormal = indicators.findIndex((i) => i.status === 'ok')
      if (firstNormal >= 0) {
        expect(
          indicators.slice(firstNormal).every((i) => i.status === 'ok')
        ).toBe(true)
      }
    }
  })
})

describe('search', () => {
  it('matches everyone when empty', () => {
    expect(search('')).toHaveLength(100)
    expect(search('   ')).toHaveLength(100)
  })

  it('finds by name, ignoring case and using word starts', () => {
    const first = patients[0]
    const [given] = first.name.split(' ')
    expect(search(given.toUpperCase()).map((p) => p.id)).toContain(first.id)
    expect(search(first.name.toLowerCase().slice(0, 3))).toContain(first)
  })

  it('finds by id, condition and device', () => {
    expect(search(patients[0].id)).toContain(patients[0])
    expect(search('heart failure')).toHaveLength(10) // 10 heart failure patients
    expect(search('whoop').length).toBeGreaterThan(0)
  })

  it('needs every typed word to match', () => {
    expect(search('heart copd')).toHaveLength(0)
  })

  it('does not treat "male" as "female"', () => {
    const male = search('male')
    expect(male.length).toBeGreaterThan(0)
    expect(male.every((p) => p.sex === 'M')).toBe(true)
  })
})

describe('device groups', () => {
  it('splits charts by device and opens on the one that is out of range', () => {
    const patient = patients.find((p) =>
      p.indicators.some((i) => i.label === 'BP' && i.status === 'above')
    )!
    const groups = getDeviceGroups(patient.id)
    expect(groups.length).toBeGreaterThan(1)

    const cuff = groups.find((g) =>
      g.series.some((s) => s.metric === 'bp_systolic')
    )!
    expect(cuff.hasAbnormal).toBe(true)
    // Out-of-range charts come first within a device.
    expect(cuff.series[0].abnormalNow).toBe(true)
  })
})

describe('chart colouring', () => {
  const allSeries = patients
    .slice(0, 40)
    .flatMap((p) => getDeviceGroups(p.id))
    .flatMap((g) => g.series)

  it('marks a day red exactly when it is past the dashed line', () => {
    for (const series of allSeries) {
      const direction = CHECKS[series.metric]!.direction
      for (const { value, abnormal } of series.points) {
        const past =
          value != null &&
          !!series.reference &&
          (direction === 'above'
            ? value >= series.reference.value
            : value <= series.reference.value)
        expect(abnormal).toBe(past)
      }
    }
  })

  it('covers every red day with a red stretch', () => {
    for (const series of allSeries) {
      series.points.forEach(({ abnormal }, day) => {
        if (!abnormal) return
        expect(series.runs.some(([a, b]) => day >= a && day <= b)).toBe(true)
      })
    }
  })

  it('calls every dashed line "Target"', () => {
    for (const series of allSeries) {
      if (series.reference) expect(series.reference.label).toMatch(/^Target /)
    }
  })
})
