import { z } from 'zod'

/**
 * Metric registry: the single source of truth for what the unified layer holds.
 *
 * Grain is ONE VALUE PER PATIENT, PER METRIC, PER DAY, PER SOURCE. Vendors are
 * pulled once every 24h and give us daily summaries, not raw streams. Not every
 * source provides every metric (see SOURCES in sources.ts).
 *
 * Plausible ranges and conflict tolerances are placeholders for the demo.
 * LOINC codes are intentionally left out until verified [VERIFY].
 */
export const metricSchema = z.enum([
  // Cardiac / recovery
  'resting_hr',
  'hrv_rmssd',
  'hrv_sdnn',
  'resp_rate',
  'spo2_avg',
  'spo2_min',
  'skin_temp_dev',
  // Sleep
  'sleep_duration',
  'sleep_efficiency',
  // Activity
  'steps',
  'active_minutes',
  // Cardiometabolic (cuff / CGM / scale)
  'bp_systolic',
  'bp_diastolic',
  'glucose_mean',
  'glucose_time_in_range',
  'glucose_overnight_lows',
  'weight',
  // Body composition (Visualize AI, smart scales, DEXA)
  'body_fat_pct',
  'muscle_mass_kg',
  'bone_mass_kg',
  'waist_circumference_cm',
  // Platform-derived
  'wear_time',
])
export type Metric = z.infer<typeof metricSchema>

export type MetricDef = {
  label: string
  unit: string
  /** Values outside this range are flagged `implausible`. */
  plausible: [min: number, max: number]
  /**
   * Two sources disagreeing by more than this (same unit) on the same day
   * raises `conflict: true` in the resolved layer.
   */
  conflictTolerance: number
}

export const METRICS: Record<Metric, MetricDef> = {
  resting_hr: {
    label: 'Resting heart rate',
    unit: 'bpm',
    plausible: [30, 150],
    conflictTolerance: 5,
  },
  hrv_rmssd: {
    label: 'HRV (rMSSD)',
    unit: 'ms',
    plausible: [5, 250],
    conflictTolerance: 20,
  },
  hrv_sdnn: {
    label: 'HRV (SDNN)',
    unit: 'ms',
    plausible: [5, 250],
    conflictTolerance: 20,
  },
  resp_rate: {
    label: 'Respiratory rate (sleep)',
    unit: 'br/min',
    plausible: [8, 35],
    conflictTolerance: 2,
  },
  spo2_avg: {
    label: 'SpO2 (average)',
    unit: '%',
    plausible: [70, 100],
    conflictTolerance: 3,
  },
  spo2_min: {
    label: 'SpO2 (lowest)',
    unit: '%',
    plausible: [50, 100],
    conflictTolerance: 4,
  },
  skin_temp_dev: {
    label: 'Skin temperature deviation',
    unit: '°C',
    plausible: [-3, 3],
    conflictTolerance: 0.5,
  },
  sleep_duration: {
    label: 'Sleep duration',
    unit: 'min',
    plausible: [0, 960],
    conflictTolerance: 45,
  },
  sleep_efficiency: {
    label: 'Sleep efficiency',
    unit: '%',
    plausible: [20, 100],
    conflictTolerance: 8,
  },
  steps: {
    label: 'Steps',
    unit: 'steps',
    plausible: [0, 60000],
    conflictTolerance: 1500,
  },
  active_minutes: {
    label: 'Active minutes',
    unit: 'min',
    plausible: [0, 600],
    conflictTolerance: 20,
  },
  bp_systolic: {
    label: 'Home BP (systolic)',
    unit: 'mmHg',
    plausible: [70, 250],
    conflictTolerance: 8,
  },
  bp_diastolic: {
    label: 'Home BP (diastolic)',
    unit: 'mmHg',
    plausible: [40, 150],
    conflictTolerance: 6,
  },
  glucose_mean: {
    label: 'Glucose (mean)',
    unit: 'mg/dL',
    plausible: [40, 500],
    conflictTolerance: 15,
  },
  glucose_time_in_range: {
    label: 'Glucose time in range',
    unit: '%',
    plausible: [0, 100],
    conflictTolerance: 10,
  },
  glucose_overnight_lows: {
    label: 'Overnight lows',
    unit: 'count',
    plausible: [0, 20],
    conflictTolerance: 1,
  },
  weight: {
    label: 'Weight',
    unit: 'kg',
    plausible: [25, 300],
    conflictTolerance: 1.5,
  },
  body_fat_pct: {
    label: 'Body fat percentage',
    unit: '%',
    plausible: [3, 70],
    conflictTolerance: 3,
  },
  muscle_mass_kg: {
    label: 'Muscle mass',
    unit: 'kg',
    plausible: [10, 120],
    conflictTolerance: 2,
  },
  bone_mass_kg: {
    label: 'Bone mass',
    unit: 'kg',
    plausible: [1, 10],
    conflictTolerance: 0.5,
  },
  waist_circumference_cm: {
    label: 'Waist circumference',
    unit: 'cm',
    plausible: [50, 200],
    conflictTolerance: 5,
  },
  wear_time: {
    label: 'Wear time',
    unit: 'min',
    plausible: [0, 1440],
    conflictTolerance: 120,
  },
}
