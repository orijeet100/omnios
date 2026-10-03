import {
  METRICS,
  type Metric,
  type MetricDeviation,
  type ResolvedMetric,
} from '../contracts'
import { getPlausibleRange } from './baselines'
import { clamp, linearSlope, mean, roundTenth, stdDev } from './stats'

const CURRENT_WINDOW_DAYS = 3
const SLOPE_WINDOW_DAYS = 7

export function computeDeviations(
  resolved: ResolvedMetric[],
  patientId: string,
  baselines: Map<Metric, number>,
  asOf: string,
): MetricDeviation[] {
  const patientMetrics = resolved.filter(
    (r) => r.patient_id === patientId && r.date <= asOf,
  )

  const byMetric = new Map<Metric, ResolvedMetric[]>()
  for (const r of patientMetrics) {
    const list = byMetric.get(r.metric) ?? []
    list.push(r)
    byMetric.set(r.metric, list)
  }

  const deviations: MetricDeviation[] = []

  for (const [metric, points] of byMetric) {
    const baseline = baselines.get(metric)
    if (baseline == null) continue

    const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))

    const currentWindow = sorted.slice(-CURRENT_WINDOW_DAYS)
    const current = mean(currentWindow.map((p) => p.value))

    const [lo, hi] = getPlausibleRange(metric)
    const recentWindow = sorted.slice(-SLOPE_WINDOW_DAYS)
    const daysOutOfRange = recentWindow.filter(
      (p) => p.value < lo || p.value > hi,
    ).length

    const baselineWindow = sorted.slice(-30)
    const baselineValues = baselineWindow.map((p) => p.value)
    const baselineStd = stdDev(baselineValues)

    const zScore =
      baselineStd > 0 ? (current - baseline) / baselineStd : 0

    const slopeValues = recentWindow.map((p) => p.value)
    const slope = linearSlope(slopeValues)

    const deltaAbs = current - baseline
    const deltaPct = baseline !== 0 ? (deltaAbs / baseline) * 100 : 0

    deviations.push({
      metric,
      unit: METRICS[metric].unit,
      current: roundTenth(current),
      baseline_median: roundTenth(baseline),
      baseline_window_days: 30,
      delta_abs: roundTenth(deltaAbs),
      delta_pct: roundTenth(deltaPct),
      z_score: roundTenth(clamp(zScore, -10, 10)),
      slope_per_day_7d: roundTenth(slope),
      days_out_of_range: daysOutOfRange,
    })
  }

  return deviations
}

export function computeDeviationsForAll(
  resolved: ResolvedMetric[],
  baselines: Map<string, Map<Metric, number>>,
  asOf: string,
): Map<string, MetricDeviation[]> {
  const result = new Map<string, MetricDeviation[]>()
  for (const [patientId, patientBaselines] of baselines) {
    result.set(
      patientId,
      computeDeviations(resolved, patientId, patientBaselines, asOf),
    )
  }
  return result
}
