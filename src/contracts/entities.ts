import { z } from 'zod'
import { metricSchema } from './metrics'
import { sourceIdSchema } from './sources'

/**
 * Entities of the unified data layer and the OmniOS platform.
 *
 * Data flows through these in order:
 *   SourceConnection -> SyncRun -> Observation (per source)
 *     -> ResolvedMetric (unified) -> MetricDeviation / RiskAssessment
 *     -> InsightNote -> WorklistItem -> Notification (EHR) -> AuditEvent
 *
 * Dates are the patient's LOCAL calendar day (YYYY-MM-DD). Timestamps are UTC ISO.
 */

const date = z.iso.date()
const timestamp = z.iso.datetime()

// ---------------------------------------------------------------------------
// 1. Connections and sync (the "Connected sources" panel)
// ---------------------------------------------------------------------------

export const connectionStatusSchema = z.enum([
  'connected',
  'stale',
  'error',
  'disconnected',
])

/** A patient's link to one device source. `stale` = no successful sync in over 36h [DEFAULT]. */
export const sourceConnectionSchema = z.object({
  id: z.string(),
  patient_id: z.string(),
  source_id: sourceIdSchema,
  status: connectionStatusSchema,
  last_sync_at: timestamp.nullable(),
  /** Most recent day we actually have data for (can lag last_sync_at). */
  last_data_date: date.nullable(),
})
export type SourceConnection = z.infer<typeof sourceConnectionSchema>

/** One 24h pull for one connection. */
export const syncRunSchema = z.object({
  id: z.string(),
  connection_id: z.string(),
  started_at: timestamp,
  finished_at: timestamp.nullable(),
  status: z.enum(['success', 'partial', 'failed']),
  window_start: date,
  window_end: date,
  records_received: z.number().int(),
  records_rejected: z.number().int(),
  error: z.string().nullable(),
})
export type SyncRun = z.infer<typeof syncRunSchema>

// ---------------------------------------------------------------------------
// 2. Data: per-source observations, then the unified (resolved) layer
// ---------------------------------------------------------------------------

export const qualityFlagSchema = z.enum([
  'ok',
  'suspect',
  'implausible',
  'imputed',
  'late',
])
export type QualityFlag = z.infer<typeof qualityFlagSchema>

/**
 * Canonical daily data point, exactly as one source reported it after
 * normalization (units reconciled, quality flagged). Never deleted, even if
 * implausible. Idempotency key: (patient_id, date, metric, source_id).
 */
export const observationSchema = z.object({
  patient_id: z.string(),
  date,
  metric: metricSchema,
  value: z.number(),
  unit: z.string(),
  source_id: sourceIdSchema,
  quality_flag: qualityFlagSchema,
  /** Number of underlying readings behind a daily value (e.g. BP cuff readings that day). */
  sample_count: z.number().int().nullable(),
  ingested_at: timestamp,
})
export type Observation = z.infer<typeof observationSchema>

export const resolutionStrategySchema = z.enum(['single_source', 'precedence'])

/**
 * The unified value for one patient/metric/day: output of the resolution
 * pipeline. Keeps every candidate so conflicts are visible, not hidden.
 */
export const resolvedMetricSchema = z.object({
  patient_id: z.string(),
  date,
  metric: metricSchema,
  value: z.number(),
  unit: z.string(),
  resolved_from: sourceIdSchema,
  strategy: resolutionStrategySchema,
  candidates: z.array(
    z.object({
      source_id: sourceIdSchema,
      value: z.number(),
      quality_flag: qualityFlagSchema,
    })
  ),
  /** True when `ok` candidates differ by more than the metric's conflictTolerance. */
  conflict: z.boolean(),
  /** max - min across `ok` candidates; null when there is only one. */
  spread: z.number().nullable(),
})
export type ResolvedMetric = z.infer<typeof resolvedMetricSchema>

/** A gap is simply a missing date in `points`. */
export const resolvedSeriesSchema = z.object({
  metric: metricSchema,
  unit: z.string(),
  points: z.array(resolvedMetricSchema),
})
export type ResolvedSeries = z.infer<typeof resolvedSeriesSchema>

// ---------------------------------------------------------------------------
// 3. Analysis outputs (computed by the backend, only displayed by the frontend)
// ---------------------------------------------------------------------------

export const confidenceLevelSchema = z.enum(['low', 'medium', 'high'])

export const dataConfidenceSchema = z.object({
  level: confidenceLevelSchema,
  score: z.number().min(0).max(1),
  factors: z.object({
    wear_time_pct: z.number().min(0).max(100),
    missing_days: z.number().int(),
    implausible_count: z.number().int(),
    source_agreement: z.enum(['single_source', 'agree', 'conflict']),
  }),
  /** Plain-language reason, e.g. "2 sensor gaps; BP cuff and Apple Watch agree". */
  summary: z.string(),
})
export type DataConfidence = z.infer<typeof dataConfidenceSchema>

/** Where a metric sits versus the patient's own baseline. */
export const metricDeviationSchema = z.object({
  metric: metricSchema,
  unit: z.string(),
  current: z.number(),
  baseline_median: z.number(),
  baseline_window_days: z.number().int(),
  delta_abs: z.number(),
  delta_pct: z.number(),
  z_score: z.number(),
  slope_per_day_7d: z.number().nullable(),
  days_out_of_range: z.number().int(),
})
export type MetricDeviation = z.infer<typeof metricDeviationSchema>

export const riskTierSchema = z.enum(['low', 'watch', 'high', 'critical'])
export type RiskTier = z.infer<typeof riskTierSchema>

/**
 * Honest risk. Reflects the data only. Routing a case NEVER changes this.
 */
export const riskAssessmentSchema = z.object({
  score: z.number().min(0).max(100),
  tier: riskTierSchema,
  as_of: date,
  trend: z.enum(['up', 'flat', 'down']),
  drivers: z.array(
    z.object({
      metric: metricSchema,
      contribution: z.number().min(0).max(1),
      direction: z.enum(['up', 'down']),
    })
  ),
  model_version: z.string(),
})
export type RiskAssessment = z.infer<typeof riskAssessmentSchema>

// ---------------------------------------------------------------------------
// 4. Patient, insight, worklist
// ---------------------------------------------------------------------------

/** Mock EHR context. All patients are synthetic. */
export const patientChartSchema = z.object({
  patient_id: z.string(),
  name: z.string(),
  age: z.number().int(),
  sex: z.enum(['F', 'M']),
  timezone: z.string(),
  conditions: z.array(z.string()),
  medications: z.array(z.string()),
  last_a1c: z.number().nullable(),
  last_bp_clinic: z.string().nullable(),
  last_visit_date: date.nullable(),
  attributed_to_hospital: z.boolean(),
})
export type PatientChart = z.infer<typeof patientChartSchema>

export const insightWindowSchema = z.object({
  from: date,
  to: date,
  days: z.number().int(),
})

/** Computed features only. This is the INPUT to the AI call; no raw data, no free text. */
export const insightFeaturesSchema = z.object({
  patient_id: z.string(),
  as_of: date,
  risk_tier: riskTierSchema,
  window: insightWindowSchema,
  baseline: z.object({ basis: z.literal('median'), days: z.number().int() }),
  changes: z.array(
    z.object({
      metric: metricSchema,
      unit: z.string(),
      delta_abs: z.number(),
      delta_pct: z.number(),
      direction: z.enum(['up', 'down']),
    })
  ),
  confidence: z.object({
    level: confidenceLevelSchema,
    reasons: z.array(z.string()),
  }),
  sources: z.array(sourceIdSchema),
})
export type InsightFeatures = z.infer<typeof insightFeaturesSchema>

/**
 * The prose fields. Insight only: generic suggestions ("flag for clinician
 * review", "consider medication review", "consider outreach"). Never a drug,
 * dose, or treatment. The backend must reject output that violates this.
 */
export const insightTextSchema = z.object({
  what_changed: z.string(),
  versus_baseline: z.string(),
  window: z.string(),
  confidence: z.string(),
  sources: z.string(),
  suggestion: z.string(),
})
export type InsightText = z.infer<typeof insightTextSchema>

export const insightNoteSchema = insightTextSchema.extend({
  id: z.string(),
  patient_id: z.string(),
  as_of: date,
  generated_at: timestamp,
  generated_by: z.enum(['rules', 'llm']),
  features: insightFeaturesSchema,
})
export type InsightNote = z.infer<typeof insightNoteSchema>

export const worklistStatusSchema = z.enum([
  'new',
  'routed',
  'acknowledged',
  'resolved',
  're_escalated',
])
export type WorklistStatus = z.infer<typeof worklistStatusSchema>

/** Status here is worklist state only. It is independent of the risk score. */
export const worklistItemSchema = z.object({
  patient_id: z.string(),
  name: z.string(),
  age: z.number().int(),
  conditions: z.array(z.string()),
  risk_score: z.number().min(0).max(100),
  risk_tier: riskTierSchema,
  risk_trend: z.enum(['up', 'flat', 'down']),
  data_confidence: confidenceLevelSchema,
  primary_driver: metricSchema.nullable(),
  status: worklistStatusSchema,
  routed_at: timestamp.nullable(),
  snooze_until: timestamp.nullable(),
  risk_at_routing: z.number().nullable(),
  last_updated: timestamp,
  insight_note_id: z.string().nullable(),
})
export type WorklistItem = z.infer<typeof worklistItemSchema>

export const cohortTrendSchema = z.object({
  id: z.string(),
  direction: z.enum(['up', 'down']),
  metric: metricSchema,
  patient_count: z.number().int(),
  /** e.g. "15 patients trending toward elevated BP". Derived from data, never hardcoded. */
  headline: z.string(),
  top_drivers: z.array(
    z.object({ metric: metricSchema, patient_count: z.number().int() })
  ),
})
export type CohortTrend = z.infer<typeof cohortTrendSchema>

// ---------------------------------------------------------------------------
// 5. EHR mock and audit
// ---------------------------------------------------------------------------

export const clinicianActionSchema = z.enum([
  'acknowledge',
  'dismiss',
  'add_plan_note',
])
export type ClinicianAction = z.infer<typeof clinicianActionSchema>

export const notificationSchema = z.object({
  id: z.string(),
  patient_id: z.string(),
  insight_note_id: z.string(),
  created_at: timestamp,
  status: z.enum(['unread', 'acknowledged', 'dismissed']),
  plan_notes: z.array(
    z.object({
      id: z.string(),
      author: z.string(),
      text: z.string(),
      created_at: timestamp,
    })
  ),
})
export type Notification = z.infer<typeof notificationSchema>

export const auditEventSchema = z.object({
  event_id: z.string(),
  timestamp,
  actor_role: z.enum(['care_manager', 'nurse', 'clinician', 'system']),
  actor_id: z.string(),
  patient_id: z.string().nullable(),
  action: z.enum([
    'viewed_patient',
    'routed',
    'acknowledged',
    'dismissed',
    'plan_note_added',
    're_escalated',
    'sync_completed',
  ]),
  detail: z.string(),
})
export type AuditEvent = z.infer<typeof auditEventSchema>
