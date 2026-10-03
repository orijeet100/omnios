import { describe, expect, it } from 'vitest'
import { bodyScanSchema } from './body-scan'

const completed = {
  scan_id: 'scan_001',
  patient_id: 'P004',
  scanned_at: '2026-09-20T14:30:00Z',
  model_version: '1.2.0',
  status: 'completed',
  subject: { height_in: 70, weight_lb: 180 },
  measurements: {
    body_fat_percent: 24.5,
    bmi: 25.8,
    girths: { waist_in: 36, hip_in: 40 },
    advanced: { waist_hip_ratio: 0.9 },
  },
  point_cloud: {
    url: '/scans/scan_001.bin',
    points: 60000,
    size_m: [0.5, 1, 0.5],
  },
  source: 'visualize',
}

describe('body scan', () => {
  it('accepts a completed scan', () => {
    expect(bodyScanSchema.safeParse(completed).success).toBe(true)
  })

  it('accepts a failed scan with no measurements or 3D data', () => {
    const failed = {
      ...completed,
      status: 'failed',
      measurements: null,
      point_cloud: null,
    }
    expect(bodyScanSchema.safeParse(failed).success).toBe(true)
  })

  it('lets not-yet-known measurements through', () => {
    const extra = {
      ...completed,
      measurements: {
        ...completed.measurements,
        girths: { waist_in: 36, thigh_in: 22 },
      },
    }
    expect(bodyScanSchema.safeParse(extra).success).toBe(true)
  })

  it('rejects a body fat over 100%', () => {
    const bad = { ...completed, measurements: { body_fat_percent: 140 } }
    expect(bodyScanSchema.safeParse(bad).success).toBe(false)
  })
})
