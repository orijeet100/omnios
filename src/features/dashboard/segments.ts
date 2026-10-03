import { CHECKS, SEGMENTS, type SegmentId, type SegmentTie } from '@/contracts'
import { computeSegments, getDataset } from '@/mock'
import { N_WEEKS, weekStartOfIndex } from '@/mock/dates'
import {
  getAllPatients,
  offMetrics,
  seriesFor,
  unjudgedMetrics,
  withoutDuplicateHrv,
  type PatientListItem,
} from '@/features/patients/data'

/**
 * What the dashboard shows, from the latest complete week. Patients are listed
 * in a neutral fixed order (by patient id), never ranked by contract value.
 */

const LATEST_WEEK_INDEX = N_WEEKS - 1
const LATEST_WEEK = weekStartOfIndex(LATEST_WEEK_INDEX)
const MAX_TILE_METRICS = 4

export type SegmentCardData = {
  id: SegmentId
  label: string
  tieLabel: string
  count: number
  evaluated: number
}

/** A patient in a segment, with the measurements that put them there. */
export type SegmentPatient = PatientListItem & {
  /** Consecutive weeks off up to now. Null for "not enough data". */
  weeksOff: number | null
}

const TIE_LABELS: Record<SegmentTie, string> = {
  contract_measure: 'Contract measure',
  er_early_warning: 'ER early warning',
  data_quality: 'Data quality',
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
  const cards: SegmentCardData[] = week.segments.map((segment) => ({
    id: segment.id,
    label: SEGMENTS[segment.id].label,
    tieLabel: TIE_LABELS[SEGMENTS[segment.id].ties_to],
    count: segment.patient_count,
    evaluated: segment.evaluated_count,
  }))
  return { weekStart: week.week_start, cards }
}

/** Consecutive weeks, counting back from the latest, with any `off` check in the segment. */
function weeksOff(patientId: string, segment: SegmentId): number {
  const flags = getDataset().weeklyFlags.filter(
    (f) => f.patient_id === patientId && CHECKS[f.metric]?.segment === segment
  )
  let weeks = 0
  for (let w = LATEST_WEEK_INDEX; w >= 0; w--) {
    const weekStart = weekStartOfIndex(w)
    const isOff = flags.some(
      (f) => f.week_start === weekStart && f.status === 'off'
    )
    if (!isOff) break
    weeks++
  }
  return weeks
}

export function getSegmentDetail(id: SegmentId) {
  const segment = latestWeek().segments.find((s) => s.id === id)!
  const everyone = new Map(getAllPatients().map((p) => [p.id, p]))

  const patients: SegmentPatient[] = [...segment.patient_ids]
    .sort()
    .map((patientId) => {
      const patient = everyone.get(patientId)!
      const metrics = withoutDuplicateHrv(
        id === 'data_gap'
          ? unjudgedMetrics(patientId)
          : offMetrics(patientId, id)
      ).slice(0, MAX_TILE_METRICS)
      const series = seriesFor(patientId, metrics)
      const shown = series.length > 0 ? series : patient.series.slice(0, 2)
      return {
        ...patient,
        series: shown,
        modalMetrics: shown.map((s) => s.metric),
        weeksOff: id === 'data_gap' ? null : weeksOff(patientId, id),
      }
    })

  const card = getDashboard().cards.find((c) => c.id === id)!
  return { card, patients }
}

export function formatWeek(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
