import type { ConditionCode, SourceId } from '../contracts'
import { COHORT_SPEC, type CohortRow } from './cohort-spec'
import { LAST_DAY } from './dates'
import { FIRST_NAMES_F, FIRST_NAMES_M, LAST_NAMES, TIME_ZONES } from './names'
import {
  chance,
  hashSeed,
  int,
  mulberry32,
  pick,
  rnd,
  shuffle,
  weightedPick,
  type Rng,
} from './random'
import type {
  Adherence,
  DeviceUse,
  PatientProfile,
  Physio,
  Plan,
  Story,
} from './types'

/**
 * Builds the 100 patient profiles from the cohort recipe. A profile holds a
 * patient's baseline physiology, devices, adherence and a Plan describing how
 * their story unfolds. No time series are generated here (see generate.ts).
 */

const SEX_SPLIT_FEMALE = 0.5
const SECOND_WEARABLE_RATE = 0.35
/** Days with no wearable data between the old and the new device. */
const SWAP_GAP_DAYS = 6

/** Wearable brands and how common each is. */
const WEARABLES: [SourceId, number][] = [
  ['apple_watch', 0.3],
  ['oura', 0.2],
  ['fitbit', 0.2],
  ['garmin', 0.15],
  ['whoop', 0.15],
]
/** Heart failure patients need a wearable that also reports weight. */
const WEARABLES_WITH_WEIGHT = WEARABLES.filter(
  ([source]) => source === 'fitbit' || source === 'garmin'
)

const LOW_ADHERENCE: Adherence = { wear: 0.28, bp: 0.18, cgm: 0.3 }

function ageFor(rng: Rng, conditions: ConditionCode[]): number {
  if (conditions.includes('heart_failure')) return int(rng, 58, 85)
  if (conditions.includes('copd')) return int(rng, 55, 82)
  if (conditions.length > 1) return int(rng, 48, 78)
  if (conditions.includes('t2_diabetes')) return int(rng, 40, 75)
  return int(rng, 42, 78)
}

function physioFor(
  rng: Rng,
  age: number,
  sex: 'F' | 'M',
  conditions: ConditionCode[]
): Physio {
  const heartFailure = conditions.includes('heart_failure')
  const copd = conditions.includes('copd')
  const hrv = Math.min(
    95,
    Math.max(18, 72 - (age - 40) * 0.9 + rnd(rng, -10, 10))
  )
  const ageFactor = age > 70 ? 0.7 : 1
  const mobilityFactor = heartFailure || copd ? 0.6 : 1
  const steps = rnd(rng, 3500, 9000) * ageFactor * mobilityFactor

  return {
    hr: rnd(rng, 58, 80) + (heartFailure ? 4 : 0) + (copd ? 2 : 0),
    hrv,
    hrvSdnn: hrv * 0.85 + rnd(rng, -3, 3),
    resp: copd
      ? rnd(rng, 17, 19.5)
      : heartFailure
        ? rnd(rng, 15.5, 18)
        : rnd(rng, 13.5, 16.5),
    spo2: copd
      ? rnd(rng, 91.5, 94)
      : heartFailure
        ? rnd(rng, 94.5, 96.5)
        : rnd(rng, 96.5, 98),
    sleep: rnd(rng, 380, 470),
    eff: rnd(rng, 80, 92),
    steps,
    wear: rnd(rng, 1100, 1380),
    weight: sex === 'M' ? rnd(rng, 75, 105) : rnd(rng, 60, 90),
  }
}

const controlledBp = (rng: Rng) => ({
  sys0: rnd(rng, 120, 131),
  dia0: rnd(rng, 73, 81),
})
const controlledTir = (rng: Rng) => rnd(rng, 76, 87)

/** The archetype decides how BP, glucose and recovery signals behave over the window. */
function planFor(rng: Rng, row: CohortRow): Plan {
  switch (row.archetype) {
    case 'stable_bp_uncontrolled':
      return {
        bp: { sys0: rnd(rng, 148, 158), dia0: rnd(rng, 92, 98) },
        tir: { tir0: controlledTir(rng) },
      }
    case 'bp_drifting':
      return {
        bp: {
          sys0: rnd(rng, 120, 128),
          dia0: rnd(rng, 74, 80),
          rampStartDay: int(rng, 35, 45),
          rampPerDay: rnd(rng, 0.55, 0.7),
        },
        tir: { tir0: controlledTir(rng) },
      }
    case 'glucose_off':
      return {
        bp: controlledBp(rng),
        // Half are chronically off; half deteriorate partway through.
        tir: chance(rng, 0.5)
          ? { tir0: rnd(rng, 48, 62) }
          : {
              tir0: rnd(rng, 78, 84),
              shiftDay: int(rng, 56, 70),
              shiftTo: rnd(rng, 48, 58),
            },
      }
    case 'near_target_improving':
      return row.variant === 'bp'
        ? {
            bp: {
              sys0: rnd(rng, 150, 156),
              dia0: rnd(rng, 93, 97),
              improveTo: { sys: rnd(rng, 130, 134), dia: rnd(rng, 77, 81) },
            },
            tir: { tir0: controlledTir(rng) },
          }
        : {
            bp: controlledBp(rng),
            tir: { tir0: rnd(rng, 50, 56), improveTo: rnd(rng, 79, 84) },
          }
    case 'acute_decliner': {
      const onset = int(rng, 74, 76)
      return {
        bp: controlledBp(rng),
        tir: { tir0: controlledTir(rng) },
        decline: {
          onset,
          erDay: row.er ? onset + int(rng, 10, 12) : undefined,
        },
      }
    }
    case 'false_alarm':
      return {
        bp: controlledBp(rng),
        tir: { tir0: controlledTir(rng) },
        falseAlarmDay: int(rng, 49, 84),
      }
    default:
      return { bp: controlledBp(rng), tir: { tir0: controlledTir(rng) } }
  }
}

const reportsEveryDay = (source: SourceId): DeviceUse => ({
  source,
  from: 0,
  to: LAST_DAY,
})

function devicesFor(
  rng: Rng,
  conditions: ConditionCode[],
  swap: boolean
): DeviceUse[] {
  const needsWeight = conditions.includes('heart_failure')
  const first = weightedPick(
    rng,
    needsWeight ? WEARABLES_WITH_WEIGHT : WEARABLES
  )
  const devices: DeviceUse[] = []

  if (swap || chance(rng, SECOND_WEARABLE_RATE)) {
    const second = weightedPick(
      rng,
      WEARABLES.filter(([source]) => source !== first)
    )
    if (swap) {
      const swapDay = int(rng, 40, 60)
      devices.push({ source: first, from: 0, to: swapDay - 1 })
      devices.push({
        source: second,
        from: swapDay + SWAP_GAP_DAYS,
        to: LAST_DAY,
      })
    } else {
      devices.push(reportsEveryDay(first), reportsEveryDay(second))
    }
  } else {
    devices.push(reportsEveryDay(first))
  }

  if (conditions.includes('hypertension')) {
    devices.push(reportsEveryDay(pick(rng, ['omron', 'withings'] as const)))
  }
  if (conditions.includes('t2_diabetes')) {
    devices.push(reportsEveryDay(pick(rng, ['dexcom', 'libre'] as const)))
  }
  return devices
}

function storiesFor(row: CohortRow): Story[] {
  const stories: Story[] = []
  if (row.er) stories.push('true_positive')
  if (row.archetype === 'false_alarm') stories.push('false_alarm')
  if (row.swap) stories.push('device_gap')
  if (row.archetype === 'near_target_improving') stories.push('recovering')
  if (row.reescalation) stories.push('reescalation_candidate')
  return stories
}

function adherenceFor(rng: Rng, row: CohortRow): Adherence {
  if (row.archetype === 'low_adherence') return { ...LOW_ADHERENCE }
  return {
    wear: rnd(rng, 0.88, 0.96),
    bp: rnd(rng, 0.65, 0.8),
    cgm: rnd(rng, 0.94, 0.98),
  }
}

/**
 * Each draw below uses the same patient-specific random stream, so a
 * patient's profile never changes when other patients are added or removed.
 * The order of the draws is part of the seed's output; do not reorder.
 */
function createProfile(
  row: CohortRow,
  id: string,
  seed: number
): PatientProfile {
  const rng = mulberry32(hashSeed(seed, id, 'profile'))
  const sex: 'F' | 'M' = chance(rng, SEX_SPLIT_FEMALE) ? 'F' : 'M'
  const age = ageFor(rng, row.conditions)
  const firstName = pick(rng, sex === 'F' ? FIRST_NAMES_F : FIRST_NAMES_M)
  const lastName = pick(rng, LAST_NAMES)
  const timezone = weightedPick(rng, TIME_ZONES)
  const physio = physioFor(rng, age, sex, row.conditions)
  const adherence = adherenceFor(rng, row)
  const devices = devicesFor(rng, row.conditions, !!row.swap)
  const plan = planFor(rng, row)

  return {
    id,
    name: `${firstName} ${lastName}`,
    age,
    sex,
    timezone,
    conditions: row.conditions,
    archetype: row.archetype,
    variant: row.variant,
    stories: storiesFor(row),
    physio,
    adherence,
    devices,
    plan,
  }
}

/** Builds the 100 profiles in a shuffled, deterministic order (P001..P100). */
export function buildCohort(seed: number): PatientProfile[] {
  const rows = COHORT_SPEC.flatMap((row) =>
    Array.from({ length: row.count }, () => row)
  )
  const shuffled = shuffle(mulberry32(hashSeed(seed, 'order')), rows)
  return shuffled.map((row, index) =>
    createProfile(row, `P${String(index + 1).padStart(3, '0')}`, seed)
  )
}
