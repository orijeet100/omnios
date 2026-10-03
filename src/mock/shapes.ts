import { LAST_DAY } from './dates'
import { clamp } from './math'
import type { PatientProfile } from './types'

/**
 * How a patient's underlying signals evolve day by day. Each archetype is a
 * small set of parameters (the Plan); these functions turn them into values.
 */

/** Effects when a decline is at full strength (declineFrac = 1). */
const DECLINE = {
  rampDays: 4,
  hr: 13,
  hrvPct: -28,
  resp: 3.2,
  respCopd: 3.8,
  spo2: -4.2,
  spo2Copd: -4.8,
  temp: 0.5,
  sleepMinutes: -45,
  stepsLoss: 0.4,
  heartFailureWeightKg: 2.8,
  bpSys: 20,
  bpDia: 10,
  tir: -22,
  /** Days in hospital after the ER visit with no device data. */
  inpatientDays: 3,
  /** Days to recover back to baseline after leaving hospital. */
  recoveryDays: 5,
} as const

/** A drifting-BP patient's resting HR rises a little as BP climbs. */
const HR_PER_BP_MMHG = 0.12
const DIASTOLIC_PER_SYSTOLIC_RAMP = 0.45

/** One bad night plus a hard workout on a single day (the false-alarm story). */
const FALSE_ALARM = {
  hr: 12,
  hrvPct: -35,
  resp: 1,
  temp: 0.4,
  sleepMinutes: -90,
  stepsMultiplier: 2.2,
  bpSys: 35,
  bpDia: 18,
  /** The next day is half as bad. */
  nextDayShare: 0.4,
} as const

const lerp = (from: number, to: number, t: number) => from + (to - from) * t

/** 0..1: how far into a decline the patient is on a day. Recovers after an ER stay. */
function declineFrac(p: PatientProfile, day: number): number {
  const decline = p.plan.decline
  if (!decline) return 0
  const rampUp = clamp((day - decline.onset + 1) / DECLINE.rampDays, 0, 1)
  if (decline.erDay == null) return rampUp
  const leftHospital = decline.erDay + DECLINE.inpatientDays
  const recovered = clamp((day - leftHospital) / DECLINE.recoveryDays, 0, 1)
  return rampUp * (1 - recovered)
}

/** In hospital after an ER visit: no device data is recorded. */
export function isInpatient(p: PatientProfile, day: number): boolean {
  const erDay = p.plan.decline?.erDay
  return erDay != null && day >= erDay && day < erDay + DECLINE.inpatientDays
}

export function bpAt(
  p: PatientProfile,
  day: number
): { sys: number; dia: number } {
  const { sys0, dia0, rampStartDay, rampPerDay, improveTo } = p.plan.bp
  let sys = sys0
  let dia = dia0

  if (rampStartDay != null && rampPerDay != null && day >= rampStartDay) {
    const rise = rampPerDay * (day - rampStartDay)
    sys += rise
    dia += rise * DIASTOLIC_PER_SYSTOLIC_RAMP
  }
  if (improveTo) {
    const progress = day / LAST_DAY
    sys = lerp(sys0, improveTo.sys, progress)
    dia = lerp(dia0, improveTo.dia, progress)
  }
  if (p.conditions.includes('hypertension')) {
    const decline = declineFrac(p, day)
    sys += DECLINE.bpSys * decline
    dia += DECLINE.bpDia * decline
  }
  return { sys, dia }
}

/** Glucose time in range (%) on a day. */
export function tirAt(p: PatientProfile, day: number): number {
  const { tir0, shiftDay, shiftTo, improveTo } = p.plan.tir
  let tir = tir0

  if (shiftDay != null && shiftTo != null && day >= shiftDay) {
    tir = lerp(tir0, shiftTo, clamp((day - shiftDay) / 7, 0, 1))
  }
  if (improveTo != null) tir = lerp(tir0, improveTo, day / LAST_DAY)
  if (p.conditions.includes('t2_diabetes')) {
    tir += DECLINE.tir * declineFrac(p, day)
  }
  return tir
}

/** The one-day BP bump on a false-alarm day. */
export function bpSpike(
  p: PatientProfile,
  day: number
): { sys: number; dia: number } {
  return p.plan.falseAlarmDay === day
    ? { sys: FALSE_ALARM.bpSys, dia: FALSE_ALARM.bpDia }
    : { sys: 0, dia: 0 }
}

export type Offsets = {
  hr: number
  hrvPct: number
  resp: number
  spo2: number
  temp: number
  sleep: number
  stepsMul: number
  weight: number
}

/** Shifts applied to recovery signals (HR, HRV, respiration, SpO2, ...) on a day. */
export function recoveryOffsets(p: PatientProfile, day: number): Offsets {
  const copd = p.conditions.includes('copd')
  const heartFailure = p.conditions.includes('heart_failure')
  const decline = declineFrac(p, day)
  const bpRise =
    p.plan.bp.rampStartDay != null ? bpAt(p, day).sys - p.plan.bp.sys0 : 0

  const offsets: Offsets = {
    hr: DECLINE.hr * decline + HR_PER_BP_MMHG * bpRise,
    hrvPct: DECLINE.hrvPct * decline,
    resp: (copd ? DECLINE.respCopd : DECLINE.resp) * decline,
    spo2: (copd ? DECLINE.spo2Copd : DECLINE.spo2) * decline,
    temp: DECLINE.temp * decline,
    sleep: DECLINE.sleepMinutes * decline,
    stepsMul: 1 - DECLINE.stepsLoss * decline,
    weight: heartFailure ? DECLINE.heartFailureWeightKg * decline : 0,
  }

  const alarmDay = p.plan.falseAlarmDay
  if (alarmDay != null && (day === alarmDay || day === alarmDay + 1)) {
    const share = day === alarmDay ? 1 : FALSE_ALARM.nextDayShare
    offsets.hr += FALSE_ALARM.hr * share
    offsets.hrvPct += FALSE_ALARM.hrvPct * share
    offsets.resp += FALSE_ALARM.resp * share
    offsets.temp += FALSE_ALARM.temp * share
    offsets.sleep += FALSE_ALARM.sleepMinutes * share
    if (day === alarmDay) offsets.stepsMul *= FALSE_ALARM.stepsMultiplier
  }
  return offsets
}
