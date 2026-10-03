import { SEGMENTS, segmentIdSchema, type SegmentId } from '@/contracts'
import { computeSegments, getDataset } from '@/mock'
import { N_WEEKS, weekStartOfIndex } from '@/mock/dates'
import {
  getAllPatients,
  indicatorsFor,
  offMetrics,
  type PatientListItem,
} from '@/features/patients/data'

/**
 * What the dashboard shows, from the latest complete week. Patients are listed
 * in a neutral fixed order (by patient id), never ranked by contract value.
 */

const LATEST_WEEK = weekStartOfIndex(N_WEEKS - 1)

/** Categories shown to users. "Not enough data" is a data-quality signal, not an abnormality. */
const SHOWN_SEGMENTS: SegmentId[] = ['bp_off', 'glucose_off', 'recovery_off']

export function isShownSegment(id: string): id is SegmentId {
  const parsed = segmentIdSchema.safeParse(id)
  return parsed.success && SHOWN_SEGMENTS.includes(parsed.data)
}

export type SegmentCardData = {
  id: SegmentId
  label: string
  count: number
}

let cachedWeek: ReturnType<typeof computeSegments> | null = null
function latestWeek() {
  if (!cachedWeek) {
    const ds = getDataset()
    cachedWeek = computeSegments(ds.profiles, ds.weeklyFlags, LATEST_WEEK)
  }
  return cachedWeek
}

export function getDashboard() {
  const week = latestWeek()
  const cards: SegmentCardData[] = week.segments
    .filter((segment) => SHOWN_SEGMENTS.includes(segment.id))
    .map((segment) => ({
      id: segment.id,
      label: SEGMENTS[segment.id].label,
      count: segment.patient_count,
    }))
  return { weekStart: week.week_start, cards }
}

/** The patients in a segment; each tile's arrows are the measurements that put them there. */
export function getSegmentDetail(id: SegmentId) {
  const segment = latestWeek().segments.find((s) => s.id === id)!
  const everyone = new Map(getAllPatients().map((p) => [p.id, p]))

  const patients: PatientListItem[] = [...segment.patient_ids]
    .sort()
    .map((patientId) => ({
      ...everyone.get(patientId)!,
      indicators: indicatorsFor(patientId, offMetrics(patientId, id)),
    }))

  return {
    card: getDashboard().cards.find((c) => c.id === id)!,
    patients,
  }
}

export function formatWeek(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
