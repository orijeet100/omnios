import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const patient = { id: 'P004', name: 'Nico Garnett', age: 53, sex: 'M' as const }
const item = {
  treatment: 'Lisinopril 10 mg once daily',
  instructions: 'Take daily.',
  dispense_quantity: 30,
  dispense_unit: 'Each',
  days_supply: 30,
}

/** Answer each Photon call by looking at the query text. */
function stubPhoton(reply: (query: string) => object) {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { body: string }) => {
      const { query } = JSON.parse(init.body)
      calls.push(query)
      return { ok: true, json: async () => reply(query) }
    })
  )
  return calls
}

async function load(token: string) {
  vi.stubEnv('VITE_PHOTON_AUTH_TOKEN', token)
  vi.resetModules()
  return import('./photon')
}

describe('sendPrescriptions', () => {
  beforeEach(() => vi.unstubAllGlobals())
  afterEach(() => vi.unstubAllEnvs())

  it('only simulates when there is no token', async () => {
    const calls = stubPhoton(() => ({}))
    const { sendPrescriptions } = await load('')
    const result = await sendPrescriptions(patient, [item])
    expect(result.live).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('creates the patient, finds the medication, then prescribes', async () => {
    const calls = stubPhoton((query) => {
      if (query.includes('createPatient'))
        return { data: { createPatient: { id: 'pat_1' } } }
      if (query.includes('treatments'))
        return { data: { treatments: [{ id: 'med_1', name: 'Lisinopril' }] } }
      return { data: { createPrescription: { id: 'rx_1' } } }
    })
    const { sendPrescriptions } = await load('token')
    const result = await sendPrescriptions(patient, [item])
    expect(result).toEqual({ live: true, prescriptionIds: ['rx_1'] })
    expect(
      calls.map(
        (q) => q.match(/createPatient|treatments|createPrescription/)?.[0]
      )
    ).toEqual(['createPatient', 'treatments', 'createPrescription'])
  })

  it('retries the prescription under the other id argument name', async () => {
    const calls = stubPhoton((query) => {
      if (query.includes('createPatient'))
        return { data: { createPatient: { id: 'pat_1' } } }
      if (query.includes('treatments'))
        return { data: { treatments: [{ id: 'med_1', name: 'Lisinopril' }] } }
      return query.includes(', medicationId: $medicationId')
        ? { errors: [{ message: 'Unknown argument "medicationId"' }] }
        : { data: { createPrescription: { id: 'rx_2' } } }
    })
    const { sendPrescriptions } = await load('token')
    const result = await sendPrescriptions(patient, [item])
    expect(result.prescriptionIds).toEqual(['rx_2'])
    expect(calls[calls.length - 1]).toContain('treatmentId:')
  })

  it('shows the error instead of pretending it worked', async () => {
    stubPhoton(() => ({ errors: [{ message: 'Not authorized' }] }))
    const { sendPrescriptions } = await load('token')
    await expect(sendPrescriptions(patient, [item])).rejects.toThrow(
      'Not authorized'
    )
  })
})
