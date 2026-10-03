import { z } from 'zod'

/**
 * Body scans from Visualize (https://developer.visualizeme.ai/docs): a Face ID
 * iPhone captures the body and computes measurements and a 3D point cloud. A
 * separate iOS app (not part of this repo) captures the scan and sends us this
 * record. The shape below follows the SDK 2.0.3 export (inches and pounds,
 * names converted to snake_case).
 *
 * Unlike device data (one value per day), a scan is a rare, whole-body event:
 * one record per scan, taken weeks apart.
 *
 * We deliberately keep only the person's height and weight from the subject:
 * not their name or age, and not Visualize's gender field.
 */

/** Inputs to the scan. */
export const scanSubjectSchema = z.object({
  height_in: z.number(),
  weight_lb: z.number(),
})
export type ScanSubject = z.infer<typeof scanSubjectSchema>

/** Circumferences in inches. */
export const girthsSchema = z
  .object({
    neck_in: z.number().optional(),
    waist_in: z.number().optional(),
    lower_waist_in: z.number().optional(),
    hip_in: z.number().optional(),
  })
  .catchall(z.number())

export const advancedMeasurementsSchema = z
  .object({
    waist_hip_ratio: z.number().optional(),
    waist_height_ratio: z.number().optional(),
    central_adiposity_index: z.number().optional(),
    fat_mass_index: z.number().optional(),
    skeletal_muscle_index: z.number().optional(),
    /** Absent for some scans. */
    muscle_preservation_index: z.number().optional(),
  })
  .catchall(z.number())

/** What the scan measured, on the phone. */
export const scanMeasurementsSchema = z
  .object({
    body_fat_percent: z.number().min(0).max(100).optional(),
    bmi: z.number().optional(),
    lean_muscle_mass_lb: z.number().optional(),
    bone_mineral_content_lb: z.number().optional(),
    girths: girthsSchema.optional(),
    advanced: advancedMeasurementsSchema.optional(),
    body_fat_formula: z.string().optional(),
    duration_seconds: z.number().optional(),
  })
  .catchall(z.unknown())
export type ScanMeasurements = z.infer<typeof scanMeasurementsSchema>

/**
 * The 3D reconstruction: a coloured point cloud stored as one binary file of
 * `points` x 3 float32 (x, y, z in metres, y up) followed by `points` x 3
 * uint8 (red, green, blue). It covers the head and torso, not the whole body.
 */
export const pointCloudSchema = z.object({
  url: z.string(),
  points: z.number().int(),
  /** Extent in metres: [x, y, z]. */
  size_m: z.tuple([z.number(), z.number(), z.number()]),
})
export type PointCloud = z.infer<typeof pointCloudSchema>

export const bodyScanSchema = z.object({
  /** Visualize's id for the scan (`scan_id`). Also the idempotency key. */
  scan_id: z.string(),
  /** Our patient id; Visualize calls it `host_user_ref`. */
  patient_id: z.string(),
  scanned_at: z.iso.datetime(),
  /** Visualize's model version, kept so results stay comparable over time. */
  model_version: z.string().nullable(),
  status: z.enum(['completed', 'failed']),
  subject: scanSubjectSchema,
  /** Null when the scan failed. */
  measurements: scanMeasurementsSchema.nullable(),
  /** Null when there is no 3D data. */
  point_cloud: pointCloudSchema.nullable(),
  /** Always 'visualize'; leaves room for other body-composition sources. */
  source: z.literal('visualize'),
})
export type BodyScan = z.infer<typeof bodyScanSchema>
