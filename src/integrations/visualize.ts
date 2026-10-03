import type { Observation } from '../contracts'
import type { PatientProfile } from '../mock/types'
import { mulberry32, hashSeed, normal } from '../mock/random'

export interface VisualizeScanResult {
  scan_id: string
  host_user_ref: string
  created_at: string
  body_fat_pct: number
  muscle_mass_kg: number
  bone_mass_kg: number
  waist_circumference_cm: number
  confidence: 'high' | 'medium' | 'low'
}

export interface VisualizeWebhookPayload {
  event_id: string
  event_type: 'scan.completed' | 'scan.results_available'
  created_at: string
  data: VisualizeScanResult
}

const VISUALIZE_PATIENT_IDS = ['P001', 'P015', 'P032', 'P047', 'P063']

export function generateVisualizeScan(
  patient: PatientProfile,
  seed: number,
): VisualizeScanResult {
  const rng = mulberry32(hashSeed(seed, patient.id, 'visualize'))

  const baseBodyFat = patient.sex === 'M' ? 22 : 32
  const baseMuscle = patient.sex === 'M' ? 35 : 25
  const baseBone = patient.sex === 'M' ? 3.5 : 2.5
  const baseWaist = patient.sex === 'M' ? 95 : 85

  return {
    scan_id: `scan_${patient.id}_${Date.now()}`,
    host_user_ref: patient.id,
    created_at: new Date().toISOString(),
    body_fat_pct: Math.round((baseBodyFat + normal(rng, 0, 3)) * 10) / 10,
    muscle_mass_kg: Math.round((baseMuscle + normal(rng, 0, 2)) * 10) / 10,
    bone_mass_kg: Math.round((baseBone + normal(rng, 0, 0.3)) * 10) / 10,
    waist_circumference_cm: Math.round(baseWaist + normal(rng, 0, 5)),
    confidence: 'high',
  }
}

export function generateVisualizeWebhook(
  patient: PatientProfile,
  seed: number,
): VisualizeWebhookPayload {
  const scan = generateVisualizeScan(patient, seed)
  return {
    event_id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    event_type: 'scan.results_available',
    created_at: new Date().toISOString(),
    data: scan,
  }
}

export function visualizeToObservations(
  webhook: VisualizeWebhookPayload,
  date: string,
): Observation[] {
  const { data } = webhook
  const ingestedAt = `${date}T06:00:00Z`

  return [
    {
      patient_id: data.host_user_ref,
      date,
      metric: 'body_fat_pct',
      value: data.body_fat_pct,
      unit: '%',
      source_id: 'visualize_ai',
      quality_flag: 'ok',
      sample_count: 1,
      ingested_at: ingestedAt,
    },
    {
      patient_id: data.host_user_ref,
      date,
      metric: 'muscle_mass_kg',
      value: data.muscle_mass_kg,
      unit: 'kg',
      source_id: 'visualize_ai',
      quality_flag: 'ok',
      sample_count: 1,
      ingested_at: ingestedAt,
    },
    {
      patient_id: data.host_user_ref,
      date,
      metric: 'bone_mass_kg',
      value: data.bone_mass_kg,
      unit: 'kg',
      source_id: 'visualize_ai',
      quality_flag: 'ok',
      sample_count: 1,
      ingested_at: ingestedAt,
    },
    {
      patient_id: data.host_user_ref,
      date,
      metric: 'waist_circumference_cm',
      value: data.waist_circumference_cm,
      unit: 'cm',
      source_id: 'visualize_ai',
      quality_flag: 'ok',
      sample_count: 1,
      ingested_at: ingestedAt,
    },
  ]
}

export function isVisualizePatient(patientId: string): boolean {
  return VISUALIZE_PATIENT_IDS.includes(patientId)
}

export function getVisualizePatientIds(): string[] {
  return [...VISUALIZE_PATIENT_IDS]
}
