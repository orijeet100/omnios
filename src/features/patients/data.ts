import {
  CHECKS,
  METRICS,
  type ConditionCode,
  type Metric,
  type SegmentId,
  type WeeklyFlag,
} from '@/contracts'
import { getDataset } from '@/mock'
import { N_DAYS, N_WEEKS, dateOfDay, dayIndex } from '@/mock/dates'

/**
 * View-model for patient cards and charts, built from the mock dataset.
 * A day is "abnormal" when the weekly check says that week is `off` for the
 * metric, so the red parts of a line always match the dashboard's counts.
 */

const LATEST_WEEK = N_WEEKS - 1
const MAX_TILE_TRENDS = 5

/** Metrics shown as trends on a patient card, in display order. */
const TREND_METRICS: Metric[] = [
  'bp_systolic',
  'glucose_time_in_range',
  'resting_hr',
  'hrv_rmssd',
  'hrv_sdnn',
  'spo2_avg',
]

const SHORT_LABELS: Partial<Record<Metric, string>> = {
  bp_systolic: 'BP',
  bp_diastolic: 'BP low',
  glucose_time_in_range: 'Glucose',
  resting_hr: 'Heart rate',
  hrv_rmssd: 'HRV',
  hrv_sdnn: 'HRV',
  resp_rate: 'Breathing',
  spo2_avg: 'SpO2',
}

export const shortLabel = (metric: Metric) =>
  SHORT_LABELS[metric] ?? METRICS[metric].label

export type SeriesPoint = {
  date: string
  value: number | null
  abnormal: boolean
}

export type MetricSeries = {
  metric: Metric
  label: string
  unit: string
  /** One point per day of the data window; value is null on days with no data. */
  points: SeriesPoint[]
  /** Inclusive day-index ranges of consecutive abnormal weeks. */
  runs: [start: number, end: number][]
  latest: number | null
  /** The dashed line on the chart: the target, or the patient's own usual. */
  reference: { label: string; value: number } | null
  abnormalNow: boolean
}

export type PatientListItem = {
  id: string
  name: string
  age: number
  sex: 'F' | 'M'
  conditions: ConditionCode[]
  /** Trends shown on the card. */
  series: MetricSeries[]
  /** Metrics charted in the modal when the card is opened. */
  modalMetrics: Metric[]
  abnormal: boolean
}

type Index = {
  daily: Map<string, (number | null)[]>
  weekly: Map<string, WeeklyFlag[]>
}

let cachedIndex: Index | null = null

/** pid|metric -> daily values, and pid|metric -> weekly verdicts (index = week). */
function getIndex(): Index {
  if (cachedIndex) return cachedIndex
  const { resolved, weeklyFlags } = getDataset()
  const daily = new Map<string, (number | null)[]>()
  for (const point of resolved) {
    const key = `${point.patient_id}|${point.metric}`
    let days = daily.get(key)
    if (!days) {
      days = new Array<number | null>(N_DAYS).fill(null)
      daily.set(key, days)
    }
    days[dayIndex(point.date)] = point.value
  }
  const weekly = new Map<string, WeeklyFlag[]>()
  for (const flag of weeklyFlags) {
    const key = `${flag.patient_id}|${flag.metric}`
    const weeks = weekly.get(key)
    if (weeks) weeks.push(flag)
    else weekly.set(key, [flag])
  }
  cachedIndex = { daily, weekly }
  return cachedIndex
}

function abnormalRuns(weeks: WeeklyFlag[]): [number, number][] {
  const runs: [number, number][] = []
  let start: number | null = null
  for (let week = 0; week <= N_WEEKS; week++) {
    const off = weeks[week]?.status === 'off'
    if (off && start == null) start = week * 7
    if (!off && start != null) {
      runs.push([start, week * 7 - 1])
      start = null
    }
  }
  return runs
}

function referenceFor(
  metric: Metric,
  weeks: WeeklyFlag[]
): MetricSeries['reference'] {
  const rule = CHECKS[metric]
  if (!rule) return null
  if (rule.kind === 'absolute') {
    return { label: `Target ${rule.threshold}`, value: rule.threshold }
  }
  const usual = weeks[LATEST_WEEK]?.baseline
  return usual == null ? null : { label: `Usual ${usual}`, value: usual }
}

export function getMetricSeries(
  patientId: string,
  metric: Metric
): MetricSeries | null {
  const { daily, weekly } = getIndex()
  const key = `${patientId}|${metric}`
  const values = daily.get(key)
  if (!values) return null
  const weeks = weekly.get(key) ?? []

  return {
    metric,
    label: METRICS[metric].label,
    unit: METRICS[metric].unit,
    points: values.map((value, day) => ({
      date: dateOfDay(day),
      value,
      abnormal: weeks[Math.floor(day / 7)]?.status === 'off',
    })),
    runs: abnormalRuns(weeks),
    latest: [...values].reverse().find((value) => value != null) ?? null,
    reference: referenceFor(metric, weeks),
    abnormalNow: weeks[LATEST_WEEK]?.status === 'off',
  }
}

function latestStatus(patientId: string, metric: Metric) {
  return getIndex().weekly.get(`${patientId}|${metric}`)?.[LATEST_WEEK]?.status
}

/** Checked metrics that are off this week, optionally within one segment. */
export function offMetrics(patientId: string, segment?: SegmentId): Metric[] {
  return (Object.keys(CHECKS) as Metric[]).filter(
    (metric) =>
      latestStatus(patientId, metric) === 'off' &&
      (!segment || CHECKS[metric]?.segment === segment)
  )
}

/** Checked metrics this patient lacks enough data for this week. */
export function unjudgedMetrics(patientId: string): Metric[] {
  return (Object.keys(CHECKS) as Metric[]).filter(
    (metric) => latestStatus(patientId, metric) === 'insufficient_data'
  )
}

/** A patient with two wearables can report both HRV kinds; show one. */
export function withoutDuplicateHrv(metrics: Metric[]): Metric[] {
  return metrics.filter(
    (m) => !(m === 'hrv_sdnn' && metrics.includes('hrv_rmssd'))
  )
}

function trendMetrics(patientId: string): Metric[] {
  const { daily } = getIndex()
  const present = TREND_METRICS.filter((m) => daily.has(`${patientId}|${m}`))
  return withoutDuplicateHrv(present).slice(0, MAX_TILE_TRENDS)
}

export function seriesFor(
  patientId: string,
  metrics: Metric[]
): MetricSeries[] {
  return metrics.flatMap((metric) => getMetricSeries(patientId, metric) ?? [])
}

let cachedPatients: PatientListItem[] | null = null

/** Every patient with their usual trends, in a neutral fixed order (by id). */
export function getAllPatients(): PatientListItem[] {
  if (cachedPatients) return cachedPatients
  const { charts } = getDataset()
  cachedPatients = [...charts]
    .sort((a, b) => a.patient_id.localeCompare(b.patient_id))
    .map((chart) => {
      const id = chart.patient_id
      const trends = trendMetrics(id)
      const off = offMetrics(id)
      return {
        id,
        name: chart.name,
        age: chart.age,
        sex: chart.sex,
        conditions: chart.conditions,
        series: seriesFor(id, trends),
        modalMetrics: off.length > 0 ? off : trends.slice(0, 2),
        abnormal: off.length > 0,
      }
    })
  return cachedPatients
}

export const formatValue = (value: number | null, unit: string) =>
  value == null ? '–' : `${value}${unit === '%' ? '' : ' '}${unit}`
