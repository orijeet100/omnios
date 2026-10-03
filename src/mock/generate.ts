import {
  METRICS,
  SOURCES,
  type Metric,
  type Observation,
  type SourceId,
} from '../contracts'
import { addDays, dateOfDay, N_DAYS } from './dates'
import { clamp, round } from './math'
import {
  chance,
  hashSeed,
  int,
  mulberry32,
  normal,
  poisson,
  type Rng,
} from './random'
import {
  bpAt,
  bpSpike,
  isInpatient,
  recoveryOffsets,
  tirAt,
  type Offsets,
} from './shapes'
import type { DeviceUse, PatientProfile } from './types'

/**
 * Turns a patient profile into daily canonical Observations: one row per
 * patient, day, metric and source, exactly as the contract defines them. Only
 * metrics a patient's devices can supply are produced.
 *
 * The order of random draws is part of the seed's output; do not reorder.
 */

/** Share of readings replaced by an implausible value (sensor glitch). */
const IMPLAUSIBLE_RATE = 0.004
/** Share of wearable-days that include a weigh-in, and of cuff-days on a Withings. */
const WEARABLE_WEIGH_IN_RATE = 0.45
const CUFF_WEIGH_IN_RATE = 0.5
/** Share of nights with no sleep record even when the device is worn. */
const MISSED_SLEEP_RATE = 0.07

/** CGM: mean glucose (mg/dL) implied by time in range, a rough linear relation. */
const GLUCOSE_AT_ZERO_TIR = 325
const GLUCOSE_PER_TIR_POINT = 2.5

const DECIMALS: Partial<Record<Metric, number>> = {
  resp_rate: 1,
  spo2_avg: 1,
  skin_temp_dev: 2,
  weight: 1,
}

/**
 * Per-device systematic bias (std dev). HRV and steps use it as a fraction of
 * the value; the rest in the metric's own unit.
 */
const DEVICE_BIAS_SD: Partial<Record<Metric, number>> = {
  resting_hr: 2,
  hrv_rmssd: 0.08,
  hrv_sdnn: 0.08,
  resp_rate: 0.6,
  spo2_avg: 1.5,
  spo2_min: 1.5,
  skin_temp_dev: 0.15,
  sleep_duration: 20,
  sleep_efficiency: 2,
  steps: 0.08,
  active_minutes: 4,
  weight: 0.4,
}
const SLEEP_METRICS = new Set<Metric>(['sleep_duration', 'sleep_efficiency'])

/** Same patient + device + metric always gets the same bias. */
function deviceBias(
  patientId: string,
  source: SourceId,
  metric: Metric
): number {
  const sd = DEVICE_BIAS_SD[metric]
  if (!sd) return 0
  const rng = mulberry32(hashSeed(patientId, source, metric, 'bias'))
  return normal(rng, 0, sd)
}

/** A value that falls outside the metric's plausible range, so it gets flagged. */
function implausibleValue(metric: Metric): number {
  const [lo, hi] = METRICS[metric].plausible
  return METRICS[metric].unit === '%' ? round(lo * 0.4) : round(hi * 1.5)
}

/** Everything the per-device emitters need about one patient-day. */
type DayContext = {
  patient: PatientProfile
  rng: Rng
  day: number
  /** Shared "how stressed was the patient today" factor, nudging several signals together. */
  stress: number
  offsets: Offsets
  emit: (
    metric: Metric,
    source: SourceId,
    rawValue: number,
    sampleCount: number | null
  ) => void
}

function hrvValue(
  baseline: number,
  offsets: Offsets,
  stress: number,
  bias: number,
  rng: Rng
): number {
  const recovery = 1 + offsets.hrvPct / 100 - 0.05 * stress
  return baseline * recovery * (1 + bias) * (1 + normal(rng, 0, 0.06))
}

/** The day's value for one wearable metric, or null if wearables don't report it. */
function wearableValue(
  metric: Metric,
  { patient, rng, stress, offsets }: DayContext,
  source: SourceId
): number | null {
  const body = patient.physio
  const bias = deviceBias(patient.id, source, metric)
  switch (metric) {
    case 'resting_hr':
      return body.hr + offsets.hr + 1.6 * stress + bias + normal(rng, 0, 1.8)
    case 'hrv_rmssd':
      return hrvValue(body.hrv, offsets, stress, bias, rng)
    case 'hrv_sdnn':
      return hrvValue(body.hrvSdnn, offsets, stress, bias, rng)
    case 'resp_rate':
      return (
        body.resp + offsets.resp + 0.25 * stress + bias + normal(rng, 0, 0.45)
      )
    case 'spo2_avg':
      return Math.min(
        100,
        body.spo2 + offsets.spo2 + bias + normal(rng, 0, 0.6)
      )
    case 'spo2_min':
      return Math.min(
        100,
        body.spo2 + offsets.spo2 + bias - 2.5 - Math.abs(normal(rng, 0, 1.2))
      )
    case 'skin_temp_dev':
      return offsets.temp + 0.1 * stress + bias + normal(rng, 0, 0.2)
    case 'sleep_duration':
      return (
        body.sleep + offsets.sleep - 12 * stress + bias + normal(rng, 0, 35)
      )
    case 'sleep_efficiency':
      return Math.min(99, body.eff - 0.8 * stress + bias + normal(rng, 0, 3))
    case 'steps':
      return (
        body.steps * offsets.stepsMul * (1 + bias) * (1 + normal(rng, 0, 0.22))
      )
    case 'active_minutes':
      return Math.max(
        0,
        (body.steps * offsets.stepsMul) / 170 + bias + normal(rng, 0, 6)
      )
    case 'weight':
      return body.weight + offsets.weight + bias + normal(rng, 0, 0.4)
    case 'wear_time':
      return Math.min(1440, normal(rng, body.wear, 60))
    default:
      return null
  }
}

function emitWearableDay(ctx: DayContext, device: DeviceUse): void {
  const { patient, rng, emit } = ctx
  if (!chance(rng, patient.adherence.wear)) return // not worn today

  for (const metric of SOURCES[device.source].provides) {
    if (metric === 'weight' && !chance(rng, WEARABLE_WEIGH_IN_RATE)) continue
    if (SLEEP_METRICS.has(metric) && chance(rng, MISSED_SLEEP_RATE)) continue
    const value = wearableValue(metric, ctx, device.source)
    if (value != null) emit(metric, device.source, value, null)
  }
}

function emitBpCuffDay(ctx: DayContext, device: DeviceUse): void {
  const { patient, rng, day, offsets, emit } = ctx
  if (!chance(rng, patient.adherence.bp)) return // no reading today

  const bp = bpAt(patient, day)
  const spike = bpSpike(patient, day)
  const readings = int(rng, 1, 3)
  emit(
    'bp_systolic',
    device.source,
    bp.sys + spike.sys + normal(rng, 0, 5),
    readings
  )
  emit(
    'bp_diastolic',
    device.source,
    bp.dia + spike.dia + normal(rng, 0, 3.5),
    readings
  )

  const weighsToo = SOURCES[device.source].provides.includes('weight')
  if (weighsToo && chance(rng, CUFF_WEIGH_IN_RATE)) {
    const weight = patient.physio.weight + offsets.weight + normal(rng, 0, 0.4)
    emit('weight', device.source, weight, null)
  }
}

function emitCgmDay(ctx: DayContext, device: DeviceUse): void {
  const { patient, rng, day, stress, emit } = ctx
  if (!chance(rng, patient.adherence.cgm)) return // sensor off today

  const tir = tirAt(patient, day)
  const samples = int(rng, 250, 288)
  const lowsRate = 0.2 + Math.max(0, 70 - tir) / 40

  emit(
    'glucose_time_in_range',
    device.source,
    clamp(tir + normal(rng, 0, 3.5), 0, 100),
    samples
  )
  emit(
    'glucose_mean',
    device.source,
    GLUCOSE_AT_ZERO_TIR -
      GLUCOSE_PER_TIR_POINT * tir +
      3 * stress +
      normal(rng, 0, 6),
    samples
  )
  emit('glucose_overnight_lows', device.source, poisson(rng, lowsRate), samples)
}

export function generateObservations(
  patient: PatientProfile,
  seed: number
): Observation[] {
  const rng = mulberry32(hashSeed(seed, patient.id, 'series'))
  const rows: Observation[] = []

  for (let day = 0; day < N_DAYS; day++) {
    if (isInpatient(patient, day)) continue

    const date = dateOfDay(day)
    const ingestedAt = `${addDays(date, 1)}T06:00:00Z`
    const emit: DayContext['emit'] = (
      metric,
      source,
      rawValue,
      sampleCount
    ) => {
      const [lo, hi] = METRICS[metric].plausible
      const value = chance(rng, IMPLAUSIBLE_RATE)
        ? implausibleValue(metric)
        : round(rawValue, DECIMALS[metric] ?? 0)
      rows.push({
        patient_id: patient.id,
        date,
        metric,
        value,
        unit: METRICS[metric].unit,
        source_id: source,
        quality_flag: value < lo || value > hi ? 'implausible' : 'ok',
        sample_count: sampleCount,
        ingested_at: ingestedAt,
      })
    }
    const ctx: DayContext = {
      patient,
      rng,
      day,
      stress: normal(rng),
      offsets: recoveryOffsets(patient, day),
      emit,
    }

    for (const device of patient.devices) {
      if (day < device.from || day > device.to) continue
      switch (SOURCES[device.source].category) {
        case 'wearable':
          emitWearableDay(ctx, device)
          break
        case 'bp_cuff':
          emitBpCuffDay(ctx, device)
          break
        case 'cgm':
          emitCgmDay(ctx, device)
          break
      }
    }
  }
  return rows
}
