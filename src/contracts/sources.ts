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
])
export type SourceId = z.infer<typeof sourceIdSchema>

export const sourceCategorySchema = z.enum(['wearable', 'cgm', 'bp_cuff'])

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

const RECOVERY: Metric[] = [
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
      ...RECOVERY.filter((m) => m !== 'hrv_rmssd'),
      'hrv_sdnn',
      'steps',
      'active_minutes',
    ],
  },
  fitbit: {
    vendor: 'Google',
    name: 'Fitbit',
    category: 'wearable',
    provides: [...RECOVERY, 'steps', 'active_minutes', 'weight'],
  },
  garmin: {
    vendor: 'Garmin',
    name: 'Garmin',
    category: 'wearable',
    provides: [...RECOVERY, 'steps', 'active_minutes', 'weight'],
  },
  oura: {
    vendor: 'Oura',
    name: 'Oura Ring',
    category: 'wearable',
    provides: [...RECOVERY, 'steps', 'active_minutes'],
  },
  whoop: {
    vendor: 'Whoop',
    name: 'Whoop',
    category: 'wearable',
    provides: RECOVERY,
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
}

/**
 * Resolution rules: when several sources report the same metric for the same
 * day, the first source in the list that has an `ok` value wins. All
 * candidates are still returned so the UI can show the conflict.
 */
const SLEEP_AND_RECOVERY: SourceId[] = [
  'oura',
  'whoop',
  'apple_watch',
  'garmin',
  'fitbit',
]
const ACTIVITY: SourceId[] = ['apple_watch', 'garmin', 'fitbit', 'oura']

export const RESOLUTION_PRECEDENCE: Record<Metric, SourceId[]> = {
  resting_hr: SLEEP_AND_RECOVERY,
  hrv_rmssd: SLEEP_AND_RECOVERY,
  hrv_sdnn: SLEEP_AND_RECOVERY,
  resp_rate: SLEEP_AND_RECOVERY,
  spo2_avg: SLEEP_AND_RECOVERY,
  spo2_min: SLEEP_AND_RECOVERY,
  skin_temp_dev: SLEEP_AND_RECOVERY,
  sleep_duration: SLEEP_AND_RECOVERY,
  sleep_efficiency: SLEEP_AND_RECOVERY,
  wear_time: SLEEP_AND_RECOVERY,
  steps: ACTIVITY,
  active_minutes: ACTIVITY,
  bp_systolic: ['omron', 'withings'],
  bp_diastolic: ['omron', 'withings'],
  glucose_mean: ['dexcom', 'libre'],
  glucose_time_in_range: ['dexcom', 'libre'],
  glucose_overnight_lows: ['dexcom', 'libre'],
  weight: ['withings', 'garmin', 'fitbit'],
}
