import { SEGMENTS, segmentIdSchema, type SegmentId } from '@/contracts'
import { computeSegments, getDataset } from '@/mock'
import { N_WEEKS, weekStartOfIndex } from '@/mock/dates'
import {
  getAllPatients,
  indicatorsFor,
  offMetrics,
  type PatientListItem,
} from '@/features/patients/data'

const LATEST_WEEK = weekStartOfIndex(N_WEEKS - 1)
const PREV_WEEK = weekStartOfIndex(N_WEEKS - 2)

const SHOWN_SEGMENTS: SegmentId[] = ['bp_off', 'glucose_off', 'recovery_off']

export function isShownSegment(id: string): id is SegmentId {
  const parsed = segmentIdSchema.safeParse(id)
  return parsed.success && SHOWN_SEGMENTS.includes(parsed.data)
}

export type SegmentCardData = {
  id: SegmentId
  label: string
  count: number
  prevCount: number
  trend: 'up' | 'down' | 'flat'
  metrics: string[]
  primaryMetric: string
}

let cachedWeek: ReturnType<typeof computeSegments> | null = null
function latestWeek() {
  if (!cachedWeek) {
    const ds = getDataset()
    cachedWeek = computeSegments(ds.profiles, ds.weeklyFlags, LATEST_WEEK)
  }
  return cachedWeek
}

function getSegmentMetrics(segmentId: SegmentId): string[] {
  const { weeklyFlags } = getDataset()
  const segmentPatients = latestWeek().segments.find((s) => s.id === segmentId)?.patient_ids ?? []

  const metricSet = new Set<string>()
  for (const pid of segmentPatients) {
    for (const flag of weeklyFlags.filter((f) => f.patient_id === pid && f.week_start === LATEST_WEEK)) {
      if (flag.status === 'off') {
        metricSet.add(flag.metric)
      }
    }
  }
  return [...metricSet]
}

function computeTrend(current: number, previous: number): 'up' | 'down' | 'flat' {
  if (previous === 0 && current === 0) return 'flat'
  if (previous === 0) return 'up'
  const pctChange = ((current - previous) / previous) * 100
  if (pctChange > 5) return 'up'
  if (pctChange < -5) return 'down'
  return 'flat'
}

export function getDashboard() {
  const week = latestWeek()
  const prevWeekData = computeSegments(getDataset().profiles, getDataset().weeklyFlags, PREV_WEEK)

  const cards: SegmentCardData[] = week.segments
    .filter((segment) => SHOWN_SEGMENTS.includes(segment.id))
    .map((segment) => {
      const prevSegment = prevWeekData.segments.find((s) => s.id === segment.id)
      const prevCount = prevSegment?.patient_count ?? 0
      const metrics = getSegmentMetrics(segment.id)
      return {
        id: segment.id,
        label: SEGMENTS[segment.id].label,
        count: segment.patient_count,
        prevCount,
        trend: computeTrend(segment.patient_count, prevCount),
        metrics,
        primaryMetric: metrics[0] ?? 'BP',
      }
    })
  return { weekStart: week.week_start, cards }
}

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
