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

export async function createPrescription(
  input: CreatePrescriptionInput,
  patientName: string
): Promise<PhotonPrescription> {
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
    throw new Error(
      `Photon API error: ${response.status} ${response.statusText}`
    )
  }

  const result = await response.json()

  if (result.errors) {
    throw new Error(result.errors.map((e: any) => e.message).join(', '))
  }

  const rx = result.data.createPrescription

  return {
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
  }
}

export async function createPatient(
  patientId: string,
  name: string,
  dateOfBirth: string,
  sex: 'M' | 'F'
): Promise<PhotonPatient> {
  const mutation = `
    mutation CreatePatient($input: CreatePatientInput!) {
      createPatient(input: $input) {
        id
        externalId
        name {
          full
        }
        dateOfBirth
        sex
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
          externalId: patientId,
          name: { full: name },
          dateOfBirth,
          sex,
        },
      },
    }),
  })

  if (!response.ok) {
    throw new Error(
      `Photon API error: ${response.status} ${response.statusText}`
    )
  }

  const result = await response.json()

  if (result.errors) {
    throw new Error(result.errors.map((e: any) => e.message).join(', '))
  }

  const pt = result.data.createPatient

  return {
    id: pt.id,
    external_id: pt.externalId,
    name: pt.name.full,
    date_of_birth: pt.dateOfBirth,
    sex: pt.sex,
  }
}

export function getPhotonSandboxUrl(): string {
  return PHOTON_API_URL
}

export function buildPrescriptionMutation(
  input: CreatePrescriptionInput
): string {
  return `
    mutation CreatePrescription {
      createPrescription(input: {
        patientId: "${input.patient_id}"
        treatmentName: "${input.treatment_name}"
        dispenseQuantity: ${input.dispense_quantity}
        dispenseUnit: "${input.dispense_unit}"
        daysSupply: ${input.days_supply}
        instructions: "${input.instructions}"
        diagnoses: [${input.diagnoses.map((d) => `"${d}"`).join(', ')}]
      }) {
        id
        state
        dispenseQuantity
        dispenseUnit
        daysSupply
        instructions
      }
    }
  `.trim()
}
