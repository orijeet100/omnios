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

const PHOTON_API_URL = import.meta.env.VITE_PHOTON_API_URL || 'https://api.neutron.health/graphql'
const PHOTON_AUTH_TOKEN = import.meta.env.VITE_PHOTON_AUTH_TOKEN || ''

let prescriptionCounter = 0

export async function createPrescription(
  input: CreatePrescriptionInput,
  patientName: string,
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
          'Authorization': `Bearer ${PHOTON_AUTH_TOKEN}`,
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
        throw new Error(result.errors.map((e: { message: string }) => e.message).join(', '))
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

export function getTreatmentForConditions(conditions: string[]): string {
  if (conditions.includes('hypertension')) {
    return 'Lisinopril 10mg daily (POC demo)'
  }
  if (conditions.includes('t2_diabetes')) {
    return 'Metformin 500mg twice daily (POC demo)'
  }
  if (conditions.includes('heart_failure')) {
    return 'Carvedilol 6.25mg daily (POC demo)'
  }
  if (conditions.includes('copd')) {
    return 'Albuterol inhaler 2 puffs BID PRN (POC demo)'
  }
  return 'Medication review recommended'
}

export function getTreatmentInstructions(conditions: string[]): string {
  const treatments = []
  if (conditions.includes('hypertension')) {
    treatments.push('Monitor BP daily. Lisinopril 10mg daily for hypertension management.')
  }
  if (conditions.includes('t2_diabetes')) {
    treatments.push('Metformin 500mg twice daily with meals. Monitor fasting glucose.')
  }
  if (conditions.includes('heart_failure')) {
    treatments.push('Carvedilol 6.25mg daily. Monitor weight and symptoms.')
  }
  if (conditions.includes('copd')) {
    treatments.push('Albuterol inhaler 2 puffs BID PRN for wheezing. Avoid triggers.')
  }
  return treatments.length > 0 ? treatments.join(' ') : 'Follow-up recommended based on wearable trends.'
}
