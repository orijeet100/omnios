import { describe, expect, it } from 'vitest'
import { bodyScanSchema } from '../contracts'
import sourceScans from './body-scans/scans.json'
import { buildDataset } from './index'

const ds = buildDataset()
const sexOf = new Map(ds.profiles.map((p) => [p.id, p.sex]))
const sourceSex = new Map(
  (sourceScans as { scan_id: string; sex: 'F' | 'M' }[]).map((s) => [
    s.scan_id,
    s.sex,
  ])
)

describe('body scans', () => {
  it('gives every patient exactly one scan that fits the contract', () => {
    expect(ds.bodyScans).toHaveLength(100)
    expect(new Set(ds.bodyScans.map((s) => s.patient_id)).size).toBe(100)
    for (const scan of ds.bodyScans) {
      expect(bodyScanSchema.safeParse(scan).success).toBe(true)
    }
  })

  it('gives each patient a scan of their own sex', () => {
    for (const scan of ds.bodyScans) {
      expect(sourceSex.get(scan.scan_id)).toBe(sexOf.get(scan.patient_id))
    }
  })

  it('is stable for the same seed and uses only the real scans we have', () => {
    expect(buildDataset().bodyScans).toEqual(ds.bodyScans)
    expect(
      new Set(ds.bodyScans.map((s) => s.scan_id)).size
    ).toBeLessThanOrEqual(sourceScans.length)
  })

  it('keeps no name or age from the source scans', () => {
    const text = JSON.stringify(sourceScans)
    expect(text).not.toMatch(/age_?years|"name"|memberId/i)
  })

  it('has a 3D point cloud for every scan', () => {
    for (const scan of ds.bodyScans) {
      expect(scan.point_cloud?.points).toBe(60000)
      expect(scan.point_cloud?.url).toBe(`/scans/${scan.scan_id}.bin`)
    }
  })
})
