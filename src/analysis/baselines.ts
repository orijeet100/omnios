import { METRICS, type Metric, type ResolvedMetric } from '../contracts'
import { median } from './stats'

const BASELINE_WINDOW_DAYS = 30

export function computeBaselines(
  resolved: ResolvedMetric[],
  patientId: string,
  asOf: string
): Map<Metric, number> {
  const patientMetrics = resolved.filter(
    (r) => r.patient_id === patientId && r.date <= asOf
  )

  const byMetric = new Map<Metric, ResolvedMetric[]>()
  for (const r of patientMetrics) {
    const list = byMetric.get(r.metric) ?? []
    list.push(r)
    byMetric.set(r.metric, list)
  }

  const baselines = new Map<Metric, number>()
  for (const [metric, points] of byMetric) {
    const cutoff = new Date(asOf)
    cutoff.setDate(cutoff.getDate() - BASELINE_WINDOW_DAYS)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    const windowValues = points
      .filter((p) => p.date > cutoffStr && p.date <= asOf)
      .map((p) => p.value)

    if (windowValues.length > 0) {
      baselines.set(metric, median(windowValues))
    }
  }

  return baselines
}

export function computeBaselinesForAll(
  resolved: ResolvedMetric[],
  patientIds: string[],
  asOf: string
): Map<string, Map<Metric, number>> {
  const result = new Map<string, Map<Metric, number>>()
  for (const id of patientIds) {
    result.set(id, computeBaselines(resolved, id, asOf))
  }
  return result
}

export function getBaselineWindowDays(): number {
  return BASELINE_WINDOW_DAYS
}

export function getPlausibleRange(metric: Metric): [number, number] {
  return METRICS[metric].plausible
}
