export interface PhotonPrescription {
  id: string
  external_id: string
  patient_id: string
  patient_name: string
  treatment_name: string
  dispense_quantity: number
  dispense_unit: string
  days_supply: number
  instructions: string
  diagnoses: string[]
  state: 'pending' | 'sent_to_pharmacy' | 'filled' | 'cancelled'
  created_at: string
}

export interface PhotonPatient {
  id: string
  external_id: string
  name: string
  date_of_birth: string
  sex: 'M' | 'F'
}

export interface CreatePrescriptionInput {
  patient_id: string
  treatment_name: string
  dispense_quantity: number
  dispense_unit: string
  days_supply: number
  instructions: string
  diagnoses: string[]
}

const PHOTON_API_URL =
  import.meta.env.VITE_PHOTON_API_URL || 'https://api.neutron.health/graphql'
const PHOTON_AUTH_TOKEN = import.meta.env.VITE_PHOTON_AUTH_TOKEN || ''

let prescriptionCounter = 0

export async function createPrescription(
  input: CreatePrescriptionInput,
  patientName: string
): Promise<{ prescription: PhotonPrescription; fromApi: boolean }> {
  prescriptionCounter++

  if (PHOTON_AUTH_TOKEN) {
    try {
      const mutation = `
        mutation CreatePrescription($input: CreatePrescriptionInput!) {
          createPrescription(input: $input) {
            id
            state
            dispenseQuantity
            dispenseUnit
            daysSupply
            instructions
          }
        }
      `

      const response = await fetch(PHOTON_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${PHOTON_AUTH_TOKEN}`,
        },
        body: JSON.stringify({
          query: mutation,
          variables: {
            input: {
              patientId: input.patient_id,
              treatmentName: input.treatment_name,
              dispenseQuantity: input.dispense_quantity,
              dispenseUnit: input.dispense_unit,
              daysSupply: input.days_supply,
              instructions: input.instructions,
              diagnoses: input.diagnoses,
            },
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`Photon API HTTP ${response.status}`)
      }

      const result = await response.json()

      if (result.errors) {
        throw new Error(
          result.errors.map((e: { message: string }) => e.message).join(', ')
        )
      }

      const rx = result.data.createPrescription

      return {
        prescription: {
          id: rx.id,
          external_id: `ext_${input.patient_id}`,
          patient_id: input.patient_id,
          patient_name: patientName,
          treatment_name: input.treatment_name,
          dispense_quantity: rx.dispenseQuantity,
          dispense_unit: rx.dispenseUnit,
          days_supply: rx.daysSupply,
          instructions: rx.instructions,
          diagnoses: input.diagnoses,
          state: rx.state,
          created_at: new Date().toISOString(),
        },
        fromApi: true,
      }
    } catch (error) {
      void error
    }
  }

  return {
    prescription: {
      id: `rx_${Date.now()}_${prescriptionCounter}`,
      external_id: `ext_${input.patient_id}`,
      patient_id: input.patient_id,
      patient_name: patientName,
      treatment_name: input.treatment_name,
      dispense_quantity: input.dispense_quantity,
      dispense_unit: input.dispense_unit,
      days_supply: input.days_supply,
      instructions: input.instructions,
      diagnoses: input.diagnoses,
      state: 'pending',
      created_at: new Date().toISOString(),
    },
    fromApi: false,
  }
}

export function getPhotonSandboxUrl(): string {
  return PHOTON_API_URL
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

export function getTreatmentForConditions(conditions: string[]): string {
  const plan = TREATMENT_PLANS.find((p) => conditions.includes(p.match))
  return plan
    ? plan.treatment
    : 'Consult the care plan for the next pharmacologic step'
}

export function getTreatmentInstructions(conditions: string[]): string {
  const instructions = TREATMENT_PLANS.filter((p) =>
    conditions.includes(p.match)
  ).map((p) => `${p.treatment}. ${p.instructions}`)
  return instructions.length > 0
    ? instructions.join(' ')
    : 'Continue current management and schedule a follow-up based on the wearable trend.'
}
