import type { ConditionCode, SourceId } from '../contracts'

/**
 * Behavior archetypes: what a patient's data does over the 13 weeks. The label
 * is only the answer key for tests. The product derives categories from the
 * data with the weekly check, never from this label.
 */
export type Archetype =
  | 'stable_controlled'
  | 'stable_bp_uncontrolled'
  | 'bp_drifting'
  | 'glucose_off'
  | 'near_target_improving'
  | 'acute_decliner'
  | 'low_adherence'
  | 'false_alarm'

/** The five planted stories from context.md (plus the re-escalation demo candidate). */
export type Story =
  | 'true_positive'
  | 'false_alarm'
  | 'device_gap'
  | 'recovering'
  | 'reescalation_candidate'

/** Baseline daily physiology for one patient. */
export type Physio = {
  hr: number
  hrv: number // rMSSD, ms
  hrvSdnn: number
  resp: number
  spo2: number
  sleep: number // minutes
  eff: number // percent
  steps: number
  wear: number // minutes worn per day
  weight: number // kg
}

/** How BP / glucose / recovery signals evolve for a patient. Day indexes are 0..90. */
export type Plan = {
  bp: {
    sys0: number
    dia0: number
    rampStartDay?: number
    rampPerDay?: number
    improveTo?: { sys: number; dia: number }
  }
  tir: {
    tir0: number
    shiftDay?: number
    shiftTo?: number
    improveTo?: number
  }
  decline?: { onset: number; erDay?: number }
  falseAlarmDay?: number
}

/** A device and the days (inclusive) it reports data. */
export type DeviceUse = { source: SourceId; from: number; to: number }

/** Share of days each kind of device actually reports. */
export type Adherence = { wear: number; bp: number; cgm: number }

export type PatientProfile = {
  id: string
  name: string
  age: number
  sex: 'F' | 'M'
  timezone: string
  conditions: ConditionCode[]
  archetype: Archetype
  variant?: 'bp' | 'glucose'
  stories: Story[]
  physio: Physio
  adherence: Adherence
  devices: DeviceUse[]
  plan: Plan
}
