import {
  CHECKS,
  METRICS,
  SEGMENTS,
  segmentIdSchema,
  type CheckRule,
  type Metric,
  type RuleKind,
  type SegmentId,
  type SegmentTie,
} from '@/contracts'
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
  const segmentPatients =
    latestWeek().segments.find((s) => s.id === segmentId)?.patient_ids ?? []

  const metricSet = new Set<string>()
  for (const pid of segmentPatients) {
    for (const flag of weeklyFlags.filter(
      (f) => f.patient_id === pid && f.week_start === LATEST_WEEK
    )) {
      if (flag.status === 'off') {
        metricSet.add(flag.metric)
      }
    }
  }
  return [...metricSet]
}

function computeTrend(
  current: number,
  previous: number
): 'up' | 'down' | 'flat' {
  if (previous === 0 && current === 0) return 'flat'
  if (previous === 0) return 'up'
  const pctChange = ((current - previous) / previous) * 100
  if (pctChange > 5) return 'up'
  if (pctChange < -5) return 'down'
  return 'flat'
}

export function getDashboard() {
  const week = latestWeek()
  const prevWeekData = computeSegments(
    getDataset().profiles,
    getDataset().weeklyFlags,
    PREV_WEEK
  )

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

// ---------------------------------------------------------------------------
// The comprehensive violation list behind "See all".
//
// One row per check in CHECKS, plus the data-gap segment. Every number is
// derived from the weekly flags for the displayed week, so the list always
// agrees with the three rows above it.
// ---------------------------------------------------------------------------

export type ViolationRow = {
  id: string
  label: string
  /** The segment this violation rolls up into. */
  segment: SegmentId
  tiesTo: SegmentTie
  unit: string
  ruleKind: RuleKind
  direction: 'above' | 'below'
  threshold: number
  /** How the threshold is written, for display. */
  thresholdLabel: string
  /** Patients `off` on this check this week. */
  offCount: number
  prevOffCount: number
  trend: 'up' | 'down' | 'flat'
  /** Patients we could judge on this check (not `insufficient_data`). */
  evaluatedCount: number
  /** Patients we could not judge, so we make no claim. */
  insufficientCount: number
}

const RULE_KIND_LABEL: Record<RuleKind, string> = {
  absolute: 'weekly average',
  baseline_delta: 'vs own baseline',
  baseline_delta_pct: 'vs own baseline',
}

function thresholdLabel(
  kind: RuleKind,
  direction: 'above' | 'below',
  threshold: number,
  unit: string
): string {
  const unitSuffix = unit === '%' ? '%' : ` ${unit}`
  if (kind === 'baseline_delta_pct') {
    return `${direction === 'below' ? 'at or below' : 'at or above'} ${Math.abs(threshold)}%`
  }
  return `${RULE_KIND_LABEL[kind]} ${direction === 'below' ? 'at or below' : 'at or above'} ${Math.abs(threshold)}${unitSuffix}`
}

/** The 3 shown segments first, then data gap, then checks in registry order. */
const SEGMENT_ORDER: SegmentId[] = [
  'bp_off',
  'glucose_off',
  'recovery_off',
  'data_gap',
]

export function getAllViolations(): ViolationRow[] {
  const { weeklyFlags } = getDataset()
  const week = latestWeek()
  const prevWeekData = computeSegments(
    getDataset().profiles,
    weeklyFlags,
    PREV_WEEK
  )

  const weekFlags = weeklyFlags.filter((f) => f.week_start === LATEST_WEEK)
  const prevWeekFlags = weeklyFlags.filter((f) => f.week_start === PREV_WEEK)

  const checks = Object.entries(CHECKS) as [Metric, CheckRule][]

  const rows: ViolationRow[] = checks.map(([metric, rule]) => {
    const current = weekFlags.filter((f) => f.metric === metric)
    const previous = prevWeekFlags.filter((f) => f.metric === metric)

    const offCount = current.filter((f) => f.status === 'off').length
    const prevOffCount = previous.filter((f) => f.status === 'off').length

    return {
      id: metric,
      label: METRICS[metric].label,
      segment: rule.segment,
      tiesTo: SEGMENTS[rule.segment].ties_to,
      unit: METRICS[metric].unit,
      ruleKind: rule.kind,
      direction: rule.direction,
      threshold: rule.threshold,
      thresholdLabel: thresholdLabel(
        rule.kind,
        rule.direction,
        rule.threshold,
        METRICS[metric].unit
      ),
      offCount,
      prevOffCount,
      trend: computeTrend(offCount, prevOffCount),
      evaluatedCount: current.filter((f) => f.status !== 'insufficient_data')
        .length,
      insufficientCount: current.filter((f) => f.status === 'insufficient_data')
        .length,
    }
  })

  const dataGap = week.segments.find((s) => s.id === 'data_gap')!
  const prevDataGap = prevWeekData.segments.find((s) => s.id === 'data_gap')
  const prevGapCount = prevDataGap?.patient_count ?? 0

  const gapRow: ViolationRow = {
    id: 'data_gap',
    label: SEGMENTS.data_gap.label,
    segment: 'data_gap',
    tiesTo: SEGMENTS.data_gap.ties_to,
    unit: '',
    ruleKind: 'absolute',
    direction: 'below',
    threshold: 0,
    thresholdLabel: 'too few days of data to judge',
    offCount: dataGap.patient_count,
    prevOffCount: prevGapCount,
    trend: computeTrend(dataGap.patient_count, prevGapCount),
    evaluatedCount: dataGap.evaluated_count,
    insufficientCount: 0,
  }

  return [...rows, gapRow].sort(
    (a, b) =>
      SEGMENT_ORDER.indexOf(a.segment) - SEGMENT_ORDER.indexOf(b.segment) ||
      b.offCount - a.offCount
  )
}
