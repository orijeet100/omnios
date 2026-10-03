import {
  CHECKS,
  MIN_DAYS_WITH_DATA,
  SEGMENTS,
  SOURCES,
  segmentIdSchema,
  type CheckRule,
  type Metric,
  type ResolvedMetric,
  type Segment,
  type SegmentId,
  type WeeklyFlag,
} from '../contracts'
import { N_DAYS, N_WEEKS, dayIndex, weekStartOfIndex } from './dates'
import { mean, median } from './math'
import type { PatientProfile } from './types'

/**
 * The weekly check. The whole rule: a weekly average at or beyond the
 * threshold means `off`. Too little data means `insufficient_data` and we make
 * no claim. These are pure functions, so the backend can port them as is.
 */

const BASELINE_WINDOW_DAYS = 30
/** Baseline rules need this many prior days to compute the patient's own median. */
const MIN_BASELINE_DAYS = 10
/** A patient is in the data gap segment when this share of checks can't be judged. */
const DATA_GAP_SHARE = 0.5

const hasValue = (x: number) => !Number.isNaN(x)
const roundTenth = (x: number) => Math.round(x * 10) / 10
const emptySeries = () => new Array<number>(N_DAYS).fill(NaN)

type Verdict = WeeklyFlag['status']

/** Weekly value in the units the rule's threshold uses. */
function valueForRule(
  rule: CheckRule,
  average: number,
  baseline: number | null
): number | null {
  if (rule.kind === 'absolute') return average
  if (baseline == null) return null
  return rule.kind === 'baseline_delta'
    ? average - baseline
    : ((average - baseline) / baseline) * 100
}

/** The verdict for one patient, one metric, one week. */
export function weeklyVerdict(
  rule: CheckRule,
  weekValues: number[],
  baseline: number | null
): Verdict {
  if (weekValues.length < MIN_DAYS_WITH_DATA) return 'insufficient_data'

  const value = valueForRule(rule, mean(weekValues), baseline)
  if (value == null) return 'insufficient_data'

  const isOff =
    rule.direction === 'above'
      ? value >= rule.threshold
      : value <= rule.threshold
  return isOff ? 'off' : 'ok'
}

/** Which checked metrics a patient can possibly produce, based on their devices. */
function checksFor(patient: PatientProfile): [Metric, CheckRule][] {
  const provided = new Set(
    patient.devices.flatMap((d) => SOURCES[d.source].provides)
  )
  return (Object.entries(CHECKS) as [Metric, CheckRule][]).filter(([metric]) =>
    provided.has(metric)
  )
}

/** patientId|metric -> resolved value per day index (NaN where there is no data). */
function dailySeries(resolved: ResolvedMetric[]): Map<string, number[]> {
  const series = new Map<string, number[]>()
  for (const point of resolved) {
    const key = `${point.patient_id}|${point.metric}`
    let days = series.get(key)
    if (!days) {
      days = emptySeries()
      series.set(key, days)
    }
    days[dayIndex(point.date)] = point.value
  }
  return series
}

export function computeWeeklyFlags(
  profiles: PatientProfile[],
  resolved: ResolvedMetric[]
): WeeklyFlag[] {
  const series = dailySeries(resolved)
  const flags: WeeklyFlag[] = []

  for (const patient of profiles) {
    for (const [metric, rule] of checksFor(patient)) {
      const days = series.get(`${patient.id}|${metric}`) ?? emptySeries()

      for (let week = 0; week < N_WEEKS; week++) {
        const weekStart = week * 7
        const weekValues = days.slice(weekStart, weekStart + 7).filter(hasValue)
        const history = days
          .slice(Math.max(0, weekStart - BASELINE_WINDOW_DAYS), weekStart)
          .filter(hasValue)

        const needsBaseline = rule.kind !== 'absolute'
        const baseline =
          needsBaseline && history.length >= MIN_BASELINE_DAYS
            ? median(history)
            : null

        flags.push({
          patient_id: patient.id,
          week_start: weekStartOfIndex(week),
          metric,
          weekly_avg: weekValues.length ? roundTenth(mean(weekValues)) : null,
          baseline: baseline == null ? null : roundTenth(baseline),
          rule_kind: rule.kind,
          threshold: rule.threshold,
          days_with_data: weekValues.length,
          status: weeklyVerdict(rule, weekValues, baseline),
        })
      }
    }
  }
  return flags
}

function flagsByPatient(
  flags: WeeklyFlag[],
  weekStart: string
): Map<string, WeeklyFlag[]> {
  const byPatient = new Map<string, WeeklyFlag[]>()
  for (const flag of flags) {
    if (flag.week_start !== weekStart) continue
    const group = byPatient.get(flag.patient_id)
    if (group) group.push(flag)
    else byPatient.set(flag.patient_id, [flag])
  }
  return byPatient
}

/** At least half of the patient's weekly checks could not be judged. */
function isDataGap(patientFlags: WeeklyFlag[]): boolean {
  if (patientFlags.length === 0) return false
  const unjudged = patientFlags.filter((f) => f.status === 'insufficient_data')
  return unjudged.length / patientFlags.length >= DATA_GAP_SHARE
}

function buildSegment(
  id: SegmentId,
  profiles: PatientProfile[],
  byPatient: Map<string, WeeklyFlag[]>
): Segment {
  const patientIds: string[] = []
  let evaluated = 0

  for (const { id: patientId } of profiles) {
    const patientFlags = byPatient.get(patientId) ?? []

    if (id === 'data_gap') {
      evaluated++ // everyone can be checked for a data gap
      if (isDataGap(patientFlags)) patientIds.push(patientId)
      continue
    }

    const inSegment = patientFlags.filter(
      (f) => CHECKS[f.metric]?.segment === id
    )
    if (inSegment.some((f) => f.status !== 'insufficient_data')) evaluated++
    if (inSegment.some((f) => f.status === 'off')) patientIds.push(patientId)
  }

  return {
    id,
    label: SEGMENTS[id].label,
    ties_to: SEGMENTS[id].ties_to,
    patient_count: patientIds.length,
    evaluated_count: evaluated,
    patient_ids: patientIds,
  }
}

/**
 * Counts per fixed segment for one week, always in the same order (never
 * ranked by size or contract value).
 */
export function computeSegments(
  profiles: PatientProfile[],
  flags: WeeklyFlag[],
  weekStart: string
): { week_start: string; patient_count: number; segments: Segment[] } {
  const byPatient = flagsByPatient(flags, weekStart)
  return {
    week_start: weekStart,
    patient_count: profiles.length,
    segments: segmentIdSchema.options.map((id) =>
      buildSegment(id, profiles, byPatient)
    ),
  }
}
