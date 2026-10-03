import type { ConditionCode } from '../contracts'
import type { Archetype } from './types'

/** One line of the cohort recipe: how many patients of this kind to create. */
export type CohortRow = {
  archetype: Archetype
  conditions: ConditionCode[]
  count: number
  /** near_target_improving only: which measure improves. */
  variant?: 'bp' | 'glucose'
  /** acute_decliner only: ends in an ER visit (the true-positive story). */
  er?: boolean
  /** Old wearable stops, a 6-day gap, then a new one starts (the device-gap story). */
  swap?: boolean
  /** The drifting-BP patient reserved for the re-escalation demo. */
  reescalation?: boolean
}

const HTN: ConditionCode = 'hypertension'
const T2D: ConditionCode = 't2_diabetes'
const HF: ConditionCode = 'heart_failure'
const COPD: ConditionCode = 'copd'

const row = (
  archetype: Archetype,
  conditions: ConditionCode[],
  count: number,
  extra: Partial<CohortRow> = {}
): CohortRow => ({ archetype, conditions, count, ...extra })

/**
 * The cohort recipe: 100 patients.
 * Counts per archetype: 39 / 8 / 15 / 10 / 8 / 7 / 8 / 5.
 * Archetypes must fit conditions: BP drifters need hypertension, glucose
 * patients need diabetes.
 */
export const COHORT_SPEC: CohortRow[] = [
  row('stable_controlled', [HTN], 10),
  row('stable_controlled', [T2D], 6),
  row('stable_controlled', [T2D], 2, { swap: true }),
  row('stable_controlled', [HTN, T2D], 10),
  row('stable_controlled', [HTN, T2D], 2, { swap: true }),
  row('stable_controlled', [HF], 5),
  row('stable_controlled', [COPD], 4),

  row('stable_bp_uncontrolled', [HTN], 4),
  row('stable_bp_uncontrolled', [HTN, T2D], 4),

  row('bp_drifting', [HTN], 1, { reescalation: true }),
  row('bp_drifting', [HTN], 6),
  row('bp_drifting', [HTN, T2D], 8),

  row('glucose_off', [T2D], 5),
  row('glucose_off', [HTN, T2D], 5),

  row('near_target_improving', [HTN], 2, { variant: 'bp' }),
  row('near_target_improving', [HTN, T2D], 2, { variant: 'bp' }),
  row('near_target_improving', [T2D], 2, { variant: 'glucose' }),
  row('near_target_improving', [HTN, T2D], 2, { variant: 'glucose' }),

  row('acute_decliner', [HF], 1, { er: true }),
  row('acute_decliner', [HF], 2),
  row('acute_decliner', [COPD], 2),
  row('acute_decliner', [HTN, T2D], 1, { er: true }),
  row('acute_decliner', [HTN], 1, { er: true }),

  row('low_adherence', [HTN], 2),
  row('low_adherence', [T2D], 2),
  row('low_adherence', [HTN, T2D], 2),
  row('low_adherence', [HF], 1),
  row('low_adherence', [COPD], 1),

  row('false_alarm', [HTN], 1),
  row('false_alarm', [T2D], 1),
  row('false_alarm', [HTN, T2D], 1),
  row('false_alarm', [HF], 1),
  row('false_alarm', [COPD], 1),
]
