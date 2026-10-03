import {
  CHECKS,
  CONDITION_LABELS,
  METRICS,
  SOURCES,
  type BodyScan,
  type ConditionCode,
  type Metric,
  type SegmentId,
  type SourceId,
  type WeeklyFlag,
} from '@/contracts'
import { getDataset } from '@/mock'
import { N_DAYS, N_WEEKS, dateOfDay, dayIndex } from '@/mock/dates'

/**
 * View-model for patient cards, search and charts, built from the mock dataset.
 * A day is "abnormal" when the weekly check says that week is `off` for the
 * metric, so the red in a chart always matches the dashboard's counts.
 */

const LATEST_WEEK = N_WEEKS - 1

const SHORT_LABELS: Partial<Record<Metric, string>> = {
  bp_systolic: 'BP',
  bp_diastolic: 'BP',
  glucose_time_in_range: 'Glucose',
  resting_hr: 'Heart rate',
  hrv_rmssd: 'HRV',
  hrv_sdnn: 'HRV',
  resp_rate: 'Breathing',
  spo2_avg: 'SpO2',
}

const shortLabel = (metric: Metric) =>
  SHORT_LABELS[metric] ?? METRICS[metric].label

export const sexLabel = (sex: 'F' | 'M') => (sex === 'F' ? 'Female' : 'Male')

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

/** Where a measurement sits against its normal range. */
export type Indicator = { label: string; status: 'above' | 'below' | 'ok' }

export type PatientListItem = {
  id: string
  name: string
  age: number
  sex: 'F' | 'M'
  conditions: ConditionCode[]
  /** Arrows shown on the card. */
  indicators: Indicator[]
  abnormal: boolean
  /** Lower-case words people can search by: name, id, age, sex, conditions, devices. */
  searchWords: string[]
}

/** One of a patient's devices with its charts, abnormal ones first. */
export type DeviceGroup = {
  source: SourceId
  name: string
  hasAbnormal: boolean
  series: MetricSeries[]
}

type Index = {
  daily: Map<string, (number | null)[]>
  weekly: Map<string, WeeklyFlag[]>
}

let cachedIndex: Index | null = null

/** pid|metric -> daily resolved values, and pid|metric -> weekly verdicts (index = week). */
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

let cachedDeviceValues: Map<string, (number | null)[]> | null = null

/** pid|source|metric -> that device's own daily values (plausible readings only). */
function getDeviceValues() {
  if (cachedDeviceValues) return cachedDeviceValues
  cachedDeviceValues = new Map()
  for (const o of getDataset().observations) {
    if (o.quality_flag !== 'ok') continue
    const key = `${o.patient_id}|${o.source_id}|${o.metric}`
    let days = cachedDeviceValues.get(key)
    if (!days) {
      days = new Array<number | null>(N_DAYS).fill(null)
      cachedDeviceValues.set(key, days)
    }
    days[dayIndex(o.date)] = o.value
  }
  return cachedDeviceValues
}

type Reference = NonNullable<MetricSeries['reference']>

/**
 * The target: the dashed line and the cut-off for red. For BP and glucose it is
 * a fixed value; for heart rate, HRV, breathing and SpO2 it is the patient's
 * own usual level plus the allowed change. Either way the UI calls it "Target".
 */
function referenceFor(metric: Metric, weeks: WeeklyFlag[]): Reference | null {
  const rule = CHECKS[metric]
  if (!rule) return null

  let value: number
  if (rule.kind === 'absolute') {
    value = rule.threshold
  } else {
    const usual = weeks[LATEST_WEEK]?.baseline
    if (usual == null) return null
    value =
      rule.kind === 'baseline_delta'
        ? usual + rule.threshold
        : usual * (1 + rule.threshold / 100)
  }
  const rounded = Math.round(value * 10) / 10
  return { label: `Target ${rounded}`, value }
}

const isBeyond = (
  value: number,
  limit: number,
  direction: 'above' | 'below'
) => (direction === 'above' ? value >= limit : value <= limit)

/**
 * Stretches of consecutive days beyond the limit, as inclusive day ranges. Days
 * with no reading do not break a stretch. Each stretch starts at the reading
 * before it so the red line begins where the line crosses the limit.
 */
function abnormalRuns(abnormal: boolean[], values: (number | null)[]) {
  const runs: [number, number][] = []
  let start: number | null = null
  let last = 0
  let previousReading = 0
  for (let day = 0; day < values.length; day++) {
    if (values[day] == null) continue
    if (abnormal[day]) {
      if (start == null) start = previousReading
      last = day
    } else if (start != null) {
      runs.push([start, last])
      start = null
    }
    previousReading = day
  }
  if (start != null) runs.push([start, last])
  return runs
}

/** A chart series from daily values; a day is abnormal when it is beyond the dashed line. */
function buildSeries(
  patientId: string,
  metric: Metric,
  values: (number | null)[]
): MetricSeries {
  const weeks = getIndex().weekly.get(`${patientId}|${metric}`) ?? []
  const reference = referenceFor(metric, weeks)
  const direction = CHECKS[metric]?.direction ?? 'above'
  const abnormal = values.map(
    (value) =>
      value != null &&
      !!reference &&
      isBeyond(value, reference.value, direction)
  )

  return {
    metric,
    label: METRICS[metric].label,
    unit: METRICS[metric].unit,
    points: values.map((value, day) => ({
      date: dateOfDay(day),
      value,
      abnormal: abnormal[day],
    })),
    runs: abnormalRuns(abnormal, values),
    latest: [...values].reverse().find((value) => value != null) ?? null,
    reference,
    abnormalNow: weeks[LATEST_WEEK]?.status === 'off',
  }
}

const checkedMetrics = Object.keys(CHECKS) as Metric[]

function latestStatus(patientId: string, metric: Metric) {
  return getIndex().weekly.get(`${patientId}|${metric}`)?.[LATEST_WEEK]?.status
}

/** Checked metrics that are off this week, optionally within one segment. */
export function offMetrics(patientId: string, segment?: SegmentId): Metric[] {
  return checkedMetrics.filter(
    (metric) =>
      latestStatus(patientId, metric) === 'off' &&
      (!segment || CHECKS[metric]?.segment === segment)
  )
}

function statusOf(
  patientId: string,
  metric: Metric
): Indicator['status'] | null {
  const verdict = latestStatus(patientId, metric)
  if (verdict === 'ok') return 'ok'
  if (verdict !== 'off') return null
  return CHECKS[metric]?.direction === 'below' ? 'below' : 'above'
}

/** One arrow per measurement (BP counts once), out-of-range first. */
export function indicatorsFor(
  patientId: string,
  metrics: Metric[]
): Indicator[] {
  const byLabel = new Map<string, Indicator>()
  for (const metric of metrics) {
    const status = statusOf(patientId, metric)
    if (!status) continue
    const label = shortLabel(metric)
    const existing = byLabel.get(label)
    if (!existing || (existing.status === 'ok' && status !== 'ok')) {
      byLabel.set(label, { label, status })
    }
  }
  return [...byLabel.values()].sort(
    (a, b) => Number(a.status === 'ok') - Number(b.status === 'ok')
  )
}

/** Every measurement we have for the patient, as arrows. */
export function allIndicators(patientId: string): Indicator[] {
  const { daily } = getIndex()
  return indicatorsFor(
    patientId,
    checkedMetrics.filter((m) => daily.has(`${patientId}|${m}`))
  )
}

/** The patient's devices, each with charts for its checked measurements. */
export function getDeviceGroups(patientId: string): DeviceGroup[] {
  const profile = getDataset().profiles.find((p) => p.id === patientId)
  if (!profile) return []
  const values = getDeviceValues()
  const sources = [...new Set(profile.devices.map((d) => d.source))]

  return sources.map((source) => {
    const series = SOURCES[source].provides
      .filter((metric) => CHECKS[metric])
      .flatMap((metric) => {
        const daily = values.get(`${patientId}|${source}|${metric}`)
        return daily ? buildSeries(patientId, metric, daily) : []
      })
      .sort((a, b) => Number(b.abnormalNow) - Number(a.abnormalNow))
    return {
      source,
      name: SOURCES[source].name,
      hasAbnormal: series.some((s) => s.abnormalNow),
      series,
    }
  })
}

let cachedPatients: PatientListItem[] | null = null

/** Every patient, in a neutral fixed order (by id). */
export function getAllPatients(): PatientListItem[] {
  if (cachedPatients) return cachedPatients
  const { charts, profiles } = getDataset()
  const devicesById = new Map(profiles.map((p) => [p.id, p.devices]))

  cachedPatients = [...charts]
    .sort((a, b) => a.patient_id.localeCompare(b.patient_id))
    .map((chart) => {
      const id = chart.patient_id
      const deviceNames = (devicesById.get(id) ?? []).map(
        (d) => SOURCES[d.source].name
      )
      return {
        id,
        name: chart.name,
        age: chart.age,
        sex: chart.sex,
        conditions: chart.conditions,
        indicators: allIndicators(id),
        abnormal: offMetrics(id).length > 0,
        searchWords: [
          chart.name,
          id,
          String(chart.age),
          sexLabel(chart.sex),
          ...chart.conditions.map((c) => CONDITION_LABELS[c]),
          ...deviceNames,
        ]
          .join(' ')
          .toLowerCase()
          .split(/\s+/),
      }
    })
  return cachedPatients
}

/** Every typed word must start a word of the patient's name, id, age, sex, condition or device. */
export function matchesQuery(patient: PatientListItem, query: string): boolean {
  const typed = query.toLowerCase().split(/\s+/).filter(Boolean)
  return typed.every((word) =>
    patient.searchWords.some((candidate) => candidate.startsWith(word))
  )
}

export const formatValue = (value: number | null, unit: string) =>
  value == null ? '–' : `${value}${unit === '%' ? '' : ' '}${unit}`

let cachedBodyScans: Map<string, BodyScan> | null = null

/** The patient's Visualize body scan (every patient has one in the mock). */
export function getBodyScan(patientId: string): BodyScan | undefined {
  cachedBodyScans ??= new Map(
    getDataset().bodyScans.map((scan) => [scan.patient_id, scan])
  )
  return cachedBodyScans.get(patientId)
}
