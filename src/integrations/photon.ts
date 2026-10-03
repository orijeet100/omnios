/**
 * Photon Health e-prescribing (sandbox). With a token set, a prescription is
 * three real calls: create the patient, find each medication in Photon's
 * catalog, create the prescription. Without a token nothing leaves the browser.
 */

const PHOTON_API_URL =
  import.meta.env.VITE_PHOTON_API_URL || 'https://api.neutron.health/graphql'
const PHOTON_AUTH_TOKEN = import.meta.env.VITE_PHOTON_AUTH_TOKEN || ''

/** Photon requires a phone number; the synthetic patients have none. */
const PLACEHOLDER_PHONE = '+12025550102'

export type PatientToPrescribe = {
  id: string
  name: string
  age: number
  sex: 'F' | 'M'
}

export type PrescriptionItem = {
  treatment: string
  instructions: string
  dispense_quantity: number
  dispense_unit: string
  days_supply: number
}

export type PrescriptionResult = {
  /** False when no token is set and the prescription was only simulated. */
  live: boolean
  prescriptionIds: string[]
}

type GraphQlResponse<T> = { data?: T; errors?: { message: string }[] }

async function photonRequest<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const response = await fetch(PHOTON_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${PHOTON_AUTH_TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!response.ok) throw new Error(`Photon API HTTP ${response.status}`)

  const result: GraphQlResponse<T> = await response.json()
  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join(', '))
  }
  return result.data as T
}

/** Photon patients created this session, so a second send reuses the patient. */
const photonPatientIds = new Map<string, string>()

async function createPhotonPatient(patient: PatientToPrescribe) {
  const [first, ...rest] = patient.name.split(' ')
  const data = await photonRequest<{ createPatient: { id: string } }>(
    `mutation CreatePatient($name: NameInput!, $dateOfBirth: AWSDate!, $sex: SexType!, $phone: AWSPhone!, $externalId: ID) {
      createPatient(name: $name, dateOfBirth: $dateOfBirth, sex: $sex, phone: $phone, externalId: $externalId) { id }
    }`,
    {
      name: { first, last: rest.join(' ') },
      // Only the age is known, so the birth date is a placeholder in that year.
      dateOfBirth: `${new Date().getFullYear() - patient.age}-01-01`,
      sex: patient.sex === 'F' ? 'FEMALE' : 'MALE',
      phone: PLACEHOLDER_PHONE,
      externalId: patient.id,
    }
  )
  return data.createPatient.id
}

// Photon's docs name the catalog "treatments" in some places and "medications"
// in others, so try each name in turn.
const MEDICATION_LOOKUPS = [
  `query Find($term: String!) { treatments(filter: { term: $term }) { id name } }`,
  `query Find($term: String!) { medications(filter: { name: $term }) { id name } }`,
]
const MEDICATION_ID_ARGS = ['medicationId', 'treatmentId'] as const

/** The catalog entry for a plan's drug, found by its name (the first word). */
async function findMedicationId(treatment: string) {
  const term = treatment.split(' ')[0]
  let firstError: Error | null = null
  for (const query of MEDICATION_LOOKUPS) {
    try {
      const data = await photonRequest<Record<string, { id: string }[]>>(
        query,
        { term }
      )
      const [match] = Object.values(data)[0] ?? []
      if (match) return match.id
    } catch (error) {
      firstError ??= error as Error
    }
  }
  throw firstError ?? new Error(`No Photon medication found for "${term}"`)
}

async function createPhotonPrescription(
  patientId: string,
  medicationId: string,
  item: PrescriptionItem
) {
  let firstError: Error | null = null
  for (const idArg of MEDICATION_ID_ARGS) {
    try {
      const data = await photonRequest<{ createPrescription: { id: string } }>(
        `mutation CreatePrescription($patientId: ID!, $medicationId: ID!, $dispenseQuantity: Int!, $dispenseUnit: DispenseUnit!, $daysSupply: Int!, $dispenseAsWritten: Boolean!, $refillsAllowed: Int!, $instructions: String!) {
          createPrescription(patientId: $patientId, ${idArg}: $medicationId, dispenseQuantity: $dispenseQuantity, dispenseUnit: $dispenseUnit, daysSupply: $daysSupply, dispenseAsWritten: $dispenseAsWritten, refillsAllowed: $refillsAllowed, instructions: $instructions) { id }
        }`,
        {
          patientId,
          medicationId,
          dispenseQuantity: item.dispense_quantity,
          dispenseUnit: item.dispense_unit,
          daysSupply: item.days_supply,
          dispenseAsWritten: false,
          refillsAllowed: 0,
          instructions: item.instructions,
        }
      )
      return data.createPrescription.id
    } catch (error) {
      firstError ??= error as Error
      // Only a rejected argument name is worth retrying under the other name.
      if (!/medicationId|treatmentId/.test((error as Error).message)) break
    }
  }
  throw firstError as Error
}

let simulatedCounter = 0

export async function sendPrescriptions(
  patient: PatientToPrescribe,
  items: PrescriptionItem[]
): Promise<PrescriptionResult> {
  if (!PHOTON_AUTH_TOKEN) {
    return {
      live: false,
      prescriptionIds: items.map(
        () => `rx_${Date.now()}_${++simulatedCounter}`
      ),
    }
  }

  let photonPatientId = photonPatientIds.get(patient.id)
  if (!photonPatientId) {
    photonPatientId = await createPhotonPatient(patient)
    photonPatientIds.set(patient.id, photonPatientId)
  }

  const prescriptionIds: string[] = []
  for (const item of items) {
    const medicationId = await findMedicationId(item.treatment)
    prescriptionIds.push(
      await createPhotonPrescription(photonPatientId, medicationId, item)
    )
  }
  return { live: true, prescriptionIds }
}

const TREATMENT_PLANS: Array<{
  match: string
  treatment: string
  instructions: string
}> = [
  {
    match: 'hypertension',
    treatment: 'Lisinopril 10 mg once daily',
    instructions:
      'Take at the same time each day. Reinforce daily home BP logging and review the wearable BP trend with each follow-up; dose adjustment is a clinician decision.',
  },
  {
    match: 't2_diabetes',
    treatment: 'Metformin 500 mg twice daily with meals',
    instructions:
      "Take with morning and evening meals. Pair with the patient's CGM time-in-range trend in the chart; clinician-titrate dose based on glucose control and renal function.",
  },
  {
    match: 'heart_failure',
    treatment: 'Carvedilol 6.25 mg twice daily',
    instructions:
      'Take with food. Institute daily weight logging and notify the care team for a gain of more than 2 kg over 2 days; escalate increased dyspnea or edema symptoms.',
  },
  {
    match: 'copd',
    treatment: 'Albuterol HFA 90 mcg, 2 puffs every 4-6 hours as needed',
    instructions:
      'Use for wheeze or shortness of breath; check inhaler technique and avoid known triggers. Review recent recovery and SpO2 trends before stepping therapy.',
  },
]

export type TreatmentPlan = (typeof TREATMENT_PLANS)[number]

/** Every plan matching the patient's conditions, for the plan builder UI. */
export function getTreatmentPlansForConditions(
  conditions: string[]
): TreatmentPlan[] {
  return TREATMENT_PLANS.filter((p) => conditions.includes(p.match))
}
