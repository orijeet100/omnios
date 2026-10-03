import type { ConditionCode, PatientChart } from '../contracts'
import {
  DATA_END,
  DATA_START,
  LAST_DAY,
  N_DAYS,
  addDays,
  dateOfDay,
  dayDiff,
} from './dates'
import { clamp, mean, round } from './math'
import {
  chance,
  hashSeed,
  int,
  mulberry32,
  normal,
  pick,
  type Rng,
} from './random'
import { bpAt, tirAt } from './shapes'
import type { PatientProfile } from './types'

/**
 * The mock EHR record, EHR-side only (display-only, never used by OmniOS
 * analysis). It is generated from the same profile as the device data so the
 * two layers agree: A1c follows the CGM baseline, clinic BP follows home BP,
 * and the ER encounter lands where the planted decline ends.
 *
 * Medications are drug CLASSES only: no brand names, no doses.
 */

type Encounter = PatientChart['encounters'][number]
type Lab = PatientChart['labs'][number]
type Medication = PatientChart['medications'][number]

const OFFICE_VISIT_INTERVAL_DAYS = 90
/** A heart failure or COPD patient has often been to the ER before; others rarely. */
const PRIOR_ER_RATE_CHRONIC_LUNG_HEART = 0.4
const PRIOR_ER_RATE_OTHER = 0.08
/** Clinic BP reads a little higher than home BP (the "white coat" effect). */
const WHITE_COAT = { sys: 3, dia: 2 }

/** Estimated A1c (%) from average glucose, using eAG = 28.7 * A1c - 46.7. */
const a1cFromTir = (tir: number) => (325 - 2.5 * tir + 46.7) / 28.7

function erReasonFor(conditions: ConditionCode[]): string {
  if (conditions.includes('heart_failure')) {
    return 'Shortness of breath and weight gain'
  }
  if (conditions.includes('copd')) return 'Breathing difficulty'
  if (conditions.includes('hypertension')) {
    return 'Elevated blood pressure with symptoms'
  }
  return 'High blood sugar'
}

/** Office visits about quarterly, one telehealth check-in, plus ER visits. */
function encountersFor(rng: Rng, patient: PatientProfile): Encounter[] {
  const encounters: Encounter[] = [0, 1, 2, 3]
    .map((i) =>
      addDays(DATA_END, -(i * OFFICE_VISIT_INTERVAL_DAYS + int(rng, 10, 40)))
    )
    .map((date, i): Encounter => ({
      id: `${patient.id}-E${i + 1}`,
      type: 'office',
      date,
      reason: 'Chronic condition follow-up',
    }))
  encounters.push({
    id: `${patient.id}-E5`,
    type: 'telehealth',
    date: addDays(DATA_END, -int(rng, 40, 120)),
    reason: 'Medication check-in',
  })

  const reason = erReasonFor(patient.conditions)
  const erDay = patient.plan.decline?.erDay
  if (erDay != null) {
    encounters.push({
      id: `${patient.id}-ER1`,
      type: 'er',
      date: dateOfDay(erDay),
      reason,
    })
  }

  const priorErRate = patient.conditions.some(
    (c) => c === 'heart_failure' || c === 'copd'
  )
    ? PRIOR_ER_RATE_CHRONIC_LUNG_HEART
    : PRIOR_ER_RATE_OTHER
  if (chance(rng, priorErRate)) {
    encounters.push({
      id: `${patient.id}-ER0`,
      type: 'er',
      date: addDays(DATA_START, -int(rng, 30, 270)),
      reason,
    })
  }
  return encounters.sort((a, b) => b.date.localeCompare(a.date))
}

/** A1c tracks the CGM baseline; eGFR and potassium follow age and condition. */
function labsFor(rng: Rng, patient: PatientProfile): Lab[] {
  const latest = addDays(DATA_END, -int(rng, 15, 70))
  const previous = addDays(latest, -int(rng, 85, 100))
  const labs: Lab[] = []

  if (patient.conditions.includes('t2_diabetes')) {
    const averageTir = mean(
      Array.from({ length: N_DAYS }, (_, day) => tirAt(patient, day))
    )
    labs.push({
      name: 'a1c',
      value: round(a1cFromTir(averageTir) + normal(rng, 0, 0.15), 1),
      unit: '%',
      date: latest,
    })
    labs.push({
      name: 'a1c',
      value: round(a1cFromTir(tirAt(patient, 0)) + normal(rng, 0, 0.2), 1),
      unit: '%',
      date: previous,
    })
  }

  const heartFailurePenalty = patient.conditions.includes('heart_failure')
    ? 8
    : 0
  const egfr =
    100 - (patient.age - 30) * 0.8 - heartFailurePenalty + normal(rng, 0, 8)
  labs.push({
    name: 'egfr',
    value: round(clamp(egfr, 25, 110)),
    unit: 'mL/min/1.73m²',
    date: latest,
  })
  labs.push({
    name: 'potassium',
    value: round(4.3 + normal(rng, 0, 0.3), 1),
    unit: 'mmol/L',
    date: latest,
  })
  return labs
}

/** Drug classes a patient is on, by condition. Never brand names or doses. */
function currentMedicationClasses(
  rng: Rng,
  patient: PatientProfile
): Set<string> {
  const classes = new Set<string>()
  const { conditions } = patient

  if (conditions.includes('hypertension')) {
    classes.add(
      pick(rng, [
        'ACE inhibitor',
        'ARB',
        'Calcium channel blocker',
        'Thiazide-type diuretic',
      ])
    )
    if (chance(rng, 0.4)) classes.add('Beta blocker')
  }
  if (conditions.includes('t2_diabetes')) {
    classes.add('Biguanide')
    if (chance(rng, 0.4)) classes.add('SGLT2 inhibitor')
    if (patient.plan.tir.tir0 < 62 && chance(rng, 0.5)) {
      classes.add('Basal insulin')
    }
  }
  if (conditions.includes('heart_failure')) {
    classes.add('Beta blocker')
    classes.add('Loop diuretic')
    classes.add(pick(rng, ['ACE inhibitor', 'ARB']))
  }
  if (conditions.includes('copd')) {
    classes.add('Long-acting bronchodilator')
    classes.add('Short-acting bronchodilator')
    if (chance(rng, 0.5)) classes.add('Inhaled corticosteroid')
  }
  return classes
}

function medicationsFor(rng: Rng, patient: PatientProfile): Medication[] {
  const classes = currentMedicationClasses(rng, patient)
  const medications = [...classes].map((label) => ({
    label,
    started: addDays(DATA_START, -int(rng, 200, 2600)),
  }))

  // Recovering patients got a treatment change early in the window.
  if (patient.archetype === 'near_target_improving') {
    const candidates =
      patient.variant === 'bp'
        ? ['Thiazide-type diuretic', 'ARB']
        : ['SGLT2 inhibitor', 'GLP-1 receptor agonist']
    const added =
      candidates.find((label) => !classes.has(label)) ?? candidates[0]
    medications.push({ label: added, started: dateOfDay(int(rng, 15, 30)) })
  }
  return medications
}

/** Vitals at the latest office visit: the home BP trend plus a white-coat offset. */
function clinicVitalsFor(
  rng: Rng,
  patient: PatientProfile,
  encounters: Encounter[]
): NonNullable<PatientChart['clinic_vitals']> {
  const visit = encounters.find((e) => e.type === 'office')!
  const visitDay = clamp(dayDiff(visit.date, DATA_START), 0, LAST_DAY)
  const bp = bpAt(patient, visitDay)
  return {
    date: visit.date,
    bp_systolic: round(bp.sys + WHITE_COAT.sys + normal(rng, 0, 4)),
    bp_diastolic: round(bp.dia + WHITE_COAT.dia + normal(rng, 0, 3)),
    weight_kg: round(patient.physio.weight + normal(rng, 0, 0.8), 1),
  }
}

/** The order of random draws is part of the seed's output; do not reorder. */
export function buildChart(
  patient: PatientProfile,
  seed: number
): PatientChart {
  const rng = mulberry32(hashSeed(seed, patient.id, 'chart'))
  const encounters = encountersFor(rng, patient)
  const labs = labsFor(rng, patient)
  const medications = medicationsFor(rng, patient)
  const clinicVitals = clinicVitalsFor(rng, patient, encounters)

  return {
    patient_id: patient.id,
    name: patient.name,
    age: patient.age,
    sex: patient.sex,
    conditions: patient.conditions,
    attributed_to_hospital: true,
    timezone: patient.timezone,
    medications,
    labs,
    clinic_vitals: clinicVitals,
    encounters,
  }
}
