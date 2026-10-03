import { z } from 'zod'
import { metricSchema, type Metric } from './metrics'

export const sourceIdSchema = z.enum([
  'apple_watch',
  'fitbit',
  'garmin',
  'oura',
  'whoop',
  'dexcom',
  'libre',
  'omron',
  'withings',
  'visualize_ai',
])
export type SourceId = z.infer<typeof sourceIdSchema>

export const sourceCategorySchema = z.enum(['wearable', 'cgm', 'bp_cuff', 'body_composition'])

/** Catalog entry: a kind of device/vendor the platform can ingest. */
export const dataSourceSchema = z.object({
  id: sourceIdSchema,
  vendor: z.string(),
  name: z.string(),
  category: sourceCategorySchema,
  /** Metrics this source can supply. Not every source covers every metric. */
  provides: z.array(metricSchema),
})
export type DataSource = z.infer<typeof dataSourceSchema>

const RECOVERY_METRICS: Metric[] = [
  'resting_hr',
  'hrv_rmssd',
  'resp_rate',
  'spo2_avg',
  'spo2_min',
  'skin_temp_dev',
  'sleep_duration',
  'sleep_efficiency',
  'wear_time',
]

/** What each source can supply. Placeholder reference data for the demo [VERIFY per vendor]. */
export const SOURCES: Record<
  SourceId,
  {
    vendor: string
    name: string
    category: DataSource['category']
    provides: Metric[]
  }
> = {
  apple_watch: {
    vendor: 'Apple',
    name: 'Apple Watch',
    category: 'wearable',
    provides: [
      ...RECOVERY_METRICS.filter((m) => m !== 'hrv_rmssd'),
      'hrv_sdnn',
      'steps',
      'active_minutes',
    ],
  },
  fitbit: {
    vendor: 'Google',
    name: 'Fitbit',
    category: 'wearable',
    provides: [...RECOVERY_METRICS, 'steps', 'active_minutes', 'weight'],
  },
  garmin: {
    vendor: 'Garmin',
    name: 'Garmin',
    category: 'wearable',
    provides: [...RECOVERY_METRICS, 'steps', 'active_minutes', 'weight'],
  },
  oura: {
    vendor: 'Oura',
    name: 'Oura Ring',
    category: 'wearable',
    provides: [...RECOVERY_METRICS, 'steps', 'active_minutes'],
  },
  whoop: {
    vendor: 'Whoop',
    name: 'Whoop',
    category: 'wearable',
    provides: RECOVERY_METRICS,
  },
  dexcom: {
    vendor: 'Dexcom',
    name: 'Dexcom CGM',
    category: 'cgm',
    provides: [
      'glucose_mean',
      'glucose_time_in_range',
      'glucose_overnight_lows',
    ],
  },
  libre: {
    vendor: 'Abbott',
    name: 'FreeStyle Libre CGM',
    category: 'cgm',
    provides: [
      'glucose_mean',
      'glucose_time_in_range',
      'glucose_overnight_lows',
    ],
  },
  omron: {
    vendor: 'Omron',
    name: 'Omron BP cuff',
    category: 'bp_cuff',
    provides: ['bp_systolic', 'bp_diastolic'],
  },
  withings: {
    vendor: 'Withings',
    name: 'Withings BP cuff',
    category: 'bp_cuff',
    provides: ['bp_systolic', 'bp_diastolic', 'weight'],
  },
  visualize_ai: {
    vendor: 'Visualize AI',
    name: 'Visualize AI body scan',
    category: 'body_composition',
    provides: [
      'body_fat_pct',
      'muscle_mass_kg',
      'bone_mass_kg',
      'waist_circumference_cm',
    ],
  },
}

/**
 * Resolution rules: when several sources report the same metric for the same
 * day, the first source in the list that has an `ok` value wins. All
 * candidates are still returned so the UI can show the conflict.
 */
const RECOVERY_SOURCE_ORDER: SourceId[] = [
  'oura',
  'whoop',
  'apple_watch',
  'garmin',
  'fitbit',
]
const ACTIVITY_SOURCE_ORDER: SourceId[] = [
  'apple_watch',
  'garmin',
  'fitbit',
  'oura',
]

export const RESOLUTION_PRECEDENCE: Record<Metric, SourceId[]> = {
  resting_hr: RECOVERY_SOURCE_ORDER,
  hrv_rmssd: RECOVERY_SOURCE_ORDER,
  hrv_sdnn: RECOVERY_SOURCE_ORDER,
  resp_rate: RECOVERY_SOURCE_ORDER,
  spo2_avg: RECOVERY_SOURCE_ORDER,
  spo2_min: RECOVERY_SOURCE_ORDER,
  skin_temp_dev: RECOVERY_SOURCE_ORDER,
  sleep_duration: RECOVERY_SOURCE_ORDER,
  sleep_efficiency: RECOVERY_SOURCE_ORDER,
  wear_time: RECOVERY_SOURCE_ORDER,
  steps: ACTIVITY_SOURCE_ORDER,
  active_minutes: ACTIVITY_SOURCE_ORDER,
  bp_systolic: ['omron', 'withings'],
  bp_diastolic: ['omron', 'withings'],
  glucose_mean: ['dexcom', 'libre'],
  glucose_time_in_range: ['dexcom', 'libre'],
  glucose_overnight_lows: ['dexcom', 'libre'],
  weight: ['withings', 'garmin', 'fitbit'],
  body_fat_pct: ['visualize_ai'],
  muscle_mass_kg: ['visualize_ai'],
  bone_mass_kg: ['visualize_ai'],
  waist_circumference_cm: ['visualize_ai'],
}
