import type { BodyScan } from '../contracts'
import sourceScans from './body-scans/scans.json'
import { hashSeed } from './random'
import type { PatientProfile } from './types'

/**
 * Body scans for the mock cohort. We have a few real Visualize scans (made with
 * the owners' consent), prepared by `scripts/prepare-body-scans.mjs`. Every
 * patient is given one scan of their own sex, chosen deterministically from
 * their id, so many patients share a scan. The scan's own height, weight and
 * measurements are used as they are; age and name are ignored.
 */

type SourceScan = Omit<BodyScan, 'patient_id'> & { sex: 'F' | 'M' }

const scans = sourceScans as unknown as SourceScan[]

export function bodyScanFor(patient: PatientProfile, seed: number): BodyScan {
  const pool = scans.filter((scan) => scan.sex === patient.sex)
  const chosen = pool[hashSeed(seed, patient.id, 'bodyscan') % pool.length]
  // `sex` is our assignment, not part of the contract record.
  const { sex: _sex, ...record } = chosen
  return { ...record, patient_id: patient.id }
}
