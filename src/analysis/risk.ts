import type {
  ConditionCode,
  DataConfidence,
  Metric,
  MetricDeviation,
  RiskAssessment,
  RiskTier,
} from '../contracts'
import { clamp, roundTenth } from './stats'

const CONDITION_WEIGHTS: Record<
  ConditionCode,
  Partial<Record<Metric, number>>
> = {
  hypertension: {
    bp_systolic: 3,
    bp_diastolic: 2,
    resting_hr: 1.5,
    hrv_rmssd: 1,
    hrv_sdnn: 1,
    weight: 0.5,
    waist_circumference_cm: 0.5,
    body_fat_pct: 0.5,
  },
  t2_diabetes: {
    glucose_time_in_range: 3,
    glucose_mean: 2,
    glucose_overnight_lows: 1.5,
    weight: 1,
    waist_circumference_cm: 1,
    body_fat_pct: 1,
    resting_hr: 0.5,
  },
  heart_failure: {
    resting_hr: 2.5,
    hrv_rmssd: 2,
    hrv_sdnn: 2,
    resp_rate: 2,
    spo2_avg: 2,
    spo2_min: 1.5,
    weight: 1.5,
    sleep_duration: 0.5,
  },
  copd: {
    resp_rate: 3,
    spo2_avg: 3,
    spo2_min: 2,
    resting_hr: 1.5,
    hrv_rmssd: 1,
    sleep_duration: 0.5,
  },
}

const DEFAULT_WEIGHTS: Partial<Record<Metric, number>> = {
  resting_hr: 1,
  hrv_rmssd: 1,
  hrv_sdnn: 1,
  resp_rate: 1,
  spo2_avg: 1,
  spo2_min: 0.5,
  skin_temp_dev: 0.5,
  sleep_duration: 0.5,
  sleep_efficiency: 0.5,
  steps: 0.5,
  bp_systolic: 1.5,
  bp_diastolic: 1,
  glucose_mean: 1.5,
  glucose_time_in_range: 1.5,
  glucose_overnight_lows: 1,
  weight: 0.5,
  body_fat_pct: 0.5,
  muscle_mass_kg: 0.5,
  bone_mass_kg: 0.25,
  waist_circumference_cm: 0.5,
}

const CONFIDENCE_DAMPENING: Record<DataConfidence['level'], number> = {
  high: 1.0,
  medium: 0.85,
  low: 0.6,
}

export function computeRisk(
  deviations: MetricDeviation[],
  conditions: ConditionCode[],
  confidence: DataConfidence,
  asOf: string
): RiskAssessment {
  const weights = conditions.map((c) => CONDITION_WEIGHTS[c] ?? {})
  const mergedWeights = mergeWeights(weights)

  let totalWeightedZ = 0
  let totalWeight = 0
  const drivers: RiskAssessment['drivers'] = []

  for (const dev of deviations) {
    const weight = mergedWeights[dev.metric] ?? DEFAULT_WEIGHTS[dev.metric] ?? 0
    if (weight === 0) continue

    const direction = dev.delta_abs > 0 ? 'up' : 'down'
    const contribution = clamp(Math.abs(dev.z_score) * weight * 0.1, 0, 1)

    totalWeightedZ += Math.abs(dev.z_score) * weight
    totalWeight += weight

    if (contribution > 0.1) {
      drivers.push({
        metric: dev.metric,
        contribution: roundTenth(contribution),
        direction,
      })
    }
  }

  const avgZ = totalWeight > 0 ? totalWeightedZ / totalWeight : 0
  const dampening = CONFIDENCE_DAMPENING[confidence.level]
  const rawScore = avgZ * 25 * dampening
  const score = clamp(Math.round(rawScore), 0, 100)

  const tier = scoreToTier(score)
  const trend = computeTrend(deviations)

  drivers.sort((a, b) => b.contribution - a.contribution)

  return {
    score,
    tier,
    as_of: asOf,
    trend,
    drivers: drivers.slice(0, 5),
    model_version: 'omni-demo-v1',
  }
}

function mergeWeights(
  weightMaps: Partial<Record<Metric, number>>[]
): Partial<Record<Metric, number>> {
  const merged: Partial<Record<Metric, number>> = {}
  for (const wm of weightMaps) {
    for (const [metric, weight] of Object.entries(wm) as [Metric, number][]) {
      merged[metric] = (merged[metric] ?? 0) + weight
    }
  }
  return merged
}

function scoreToTier(score: number): RiskTier {
  if (score >= 75) return 'critical'
  if (score >= 50) return 'high'
  if (score >= 25) return 'watch'
  return 'low'
}

function computeTrend(deviations: MetricDeviation[]): RiskAssessment['trend'] {
  const slopes = deviations
    .filter((d) => d.slope_per_day_7d != null)
    .map((d) => d.slope_per_day_7d!)

  if (slopes.length === 0) return 'flat'

  const avgSlope = slopes.reduce((a, b) => a + b, 0) / slopes.length
  const threshold = 0.5

  if (avgSlope > threshold) return 'up'
  if (avgSlope < -threshold) return 'down'
  return 'flat'
}

export function computeRiskForAll(
  deviations: Map<string, MetricDeviation[]>,
  conditions: Map<string, ConditionCode[]>,
  confidences: Map<string, DataConfidence>,
  asOf: string
): Map<string, RiskAssessment> {
  const result = new Map<string, RiskAssessment>()
  for (const [patientId, devs] of deviations) {
    const patientConditions = conditions.get(patientId) ?? []
    const confidence = confidences.get(patientId) ?? {
      level: 'low' as const,
      score: 0,
      factors: {
        wear_time_pct: 0,
        missing_days: 7,
        implausible_count: 0,
        source_agreement: 'single_source' as const,
      },
      summary: 'No data',
    }
    result.set(
      patientId,
      computeRisk(devs, patientConditions, confidence, asOf)
    )
  }
  return result
}
