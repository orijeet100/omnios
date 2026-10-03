import { z } from 'zod'
import type { Metric } from './metrics'

/**
 * The weekly check: the simplest possible "does this week look off?" rule.
 *
 * For each patient, metric and calendar week, take the weekly average and
 * compare it to a threshold. If the average is at or beyond the threshold, the
 * week is `off`. If there are fewer than MIN_DAYS_WITH_DATA days of readings
 * the week is `insufficient_data` and we make no claim.
 *
 * Thresholds below are placeholders for the demo [VERIFY against the real
 * contract and clinical guidance before presenting as fact].
 *
 * Weeks start on Monday, patient local time [DEFAULT].
 */

export const MIN_DAYS_WITH_DATA = 3

/**
 * - absolute:            compare the weekly average to `threshold` directly
 * - baseline_delta:      weekly avg minus the patient's own 30-day median (metric units)
 * - baseline_delta_pct:  same, as a percentage of the baseline
 */
export const ruleKindSchema = z.enum([
  'absolute',
  'baseline_delta',
  'baseline_delta_pct',
])
export type RuleKind = z.infer<typeof ruleKindSchema>

/** Segments are fixed groups of checks. They are never ranked by contract value. */
export const segmentIdSchema = z.enum([
  'bp_off',
  'glucose_off',
  'recovery_off',
  'data_gap',
])
export type SegmentId = z.infer<typeof segmentIdSchema>

export const segmentTieSchema = z.enum([
  'contract_measure',
  'er_early_warning',
  'data_quality',
])
export type SegmentTie = z.infer<typeof segmentTieSchema>

/**
 * `contract_measure`: the contract rewards improving this (BP control, glucose control).
 * `er_early_warning`: not a measure itself; a leading indicator for ER visits, which the contract rewards.
 * `data_quality`: we cannot judge these patients; not a clinical finding.
 */
export const SEGMENTS: Record<
  SegmentId,
  { label: string; ties_to: SegmentTie }
> = {
  bp_off: { label: 'BP above normal', ties_to: 'contract_measure' },
  glucose_off: {
    label: 'Glucose time in range low',
    ties_to: 'contract_measure',
  },
  recovery_off: { label: 'Early warning signs', ties_to: 'er_early_warning' },
  data_gap: { label: 'Not enough data', ties_to: 'data_quality' },
}

export type CheckRule = {
  kind: RuleKind
  /** Off when the weekly value is at or beyond `threshold` in this direction. */
  direction: 'above' | 'below'
  threshold: number
  segment: SegmentId
}

export const CHECKS: Partial<Record<Metric, CheckRule>> = {
  bp_systolic: {
    kind: 'absolute',
    direction: 'above',
    threshold: 140,
    segment: 'bp_off',
  },
  bp_diastolic: {
    kind: 'absolute',
    direction: 'above',
    threshold: 90,
    segment: 'bp_off',
  },
  glucose_time_in_range: {
    kind: 'absolute',
    direction: 'below',
    threshold: 70,
    segment: 'glucose_off',
  },
  resting_hr: {
    kind: 'baseline_delta',
    direction: 'above',
    threshold: 7,
    segment: 'recovery_off',
  },
  hrv_rmssd: {
    kind: 'baseline_delta_pct',
    direction: 'below',
    threshold: -15,
    segment: 'recovery_off',
  },
  hrv_sdnn: {
    kind: 'baseline_delta_pct',
    direction: 'below',
    threshold: -15,
    segment: 'recovery_off',
  },
  resp_rate: {
    kind: 'baseline_delta',
    direction: 'above',
    threshold: 2,
    segment: 'recovery_off',
  },
  spo2_avg: {
    kind: 'baseline_delta',
    direction: 'below',
    threshold: -3,
    segment: 'recovery_off',
  },
}
