import type { CohortTrend, Metric, RiskAssessment, Segment } from '../contracts'

export function buildCohortTrends(
  segments: Segment[],
  risks: Map<string, RiskAssessment>,
): CohortTrend[] {
  const trends: CohortTrend[] = []

  for (const segment of segments) {
    if (segment.patient_count === 0) continue

    const metric = segmentToMetric(segment.id)
    if (!metric) continue

    const direction = metricToDirection(metric)
    const headline = `${segment.patient_count} patient${segment.patient_count > 1 ? 's' : ''} trending toward ${segment.label.toLowerCase()}`

    const topDrivers = computeTopDrivers(segment, risks)

    trends.push({
      id: `trend-${segment.id}`,
      direction,
      metric,
      patient_count: segment.patient_count,
      headline,
      top_drivers: topDrivers,
    })
  }

  return trends
}

function segmentToMetric(segmentId: string): Metric | null {
  switch (segmentId) {
    case 'bp_off':
      return 'bp_systolic'
    case 'glucose_off':
      return 'glucose_time_in_range'
    case 'recovery_off':
      return 'resting_hr'
    case 'data_gap':
      return 'wear_time'
    default:
      return null
  }
}

function metricToDirection(metric: Metric): CohortTrend['direction'] {
  const downMetrics: Metric[] = [
    'hrv_rmssd',
    'hrv_sdnn',
    'spo2_avg',
    'spo2_min',
    'sleep_duration',
    'sleep_efficiency',
    'steps',
    'glucose_time_in_range',
    'active_minutes',
  ]
  return downMetrics.includes(metric) ? 'down' : 'up'
}

function computeTopDrivers(
  segment: Segment,
  risks: Map<string, RiskAssessment>,
): CohortTrend['top_drivers'] {
  const driverCounts = new Map<Metric, number>()

  for (const patientId of segment.patient_ids) {
    const risk = risks.get(patientId)
    if (!risk) continue

    for (const driver of risk.drivers) {
      driverCounts.set(
        driver.metric,
        (driverCounts.get(driver.metric) ?? 0) + 1,
      )
    }
  }

  return [...driverCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([metric, patient_count]) => ({ metric, patient_count }))
}

export function buildTierCounts(
  risks: Map<string, RiskAssessment>,
): Record<string, number> {
  const counts: Record<string, number> = {
    low: 0,
    watch: 0,
    high: 0,
    critical: 0,
  }

  for (const risk of risks.values()) {
    counts[risk.tier]++
  }

  return counts
}
