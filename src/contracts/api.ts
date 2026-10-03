import { z } from 'zod'
import {
  auditEventSchema,
  clinicianActionSchema,
  cohortTrendSchema,
  dataConfidenceSchema,
  insightFeaturesSchema,
  insightNoteSchema,
  insightTextSchema,
  metricDeviationSchema,
  notificationSchema,
  observationSchema,
  patientChartSchema,
  resolvedSeriesSchema,
  riskAssessmentSchema,
  riskTierSchema,
  sourceConnectionSchema,
  syncRunSchema,
  worklistItemSchema,
  worklistStatusSchema,
} from './entities'
import { metricSchema } from './metrics'
import { dataSourceSchema, sourceIdSchema } from './sources'

/**
 * The read/action API the frontend consumes. The mock adapter and the real
 * backend must both implement exactly this. Path params are written `:name`.
 *
 * `kind`:
 *   read   - no side effects
 *   action - changes worklist/EHR state (never risk)
 *   ai     - calls an LLM; input is computed features only
 *   demo   - demo-mode controls, not part of the real product
 */

const date = z.iso.date()
const range = { from: date, to: date }
const metricList = z.array(metricSchema).optional()

export const endpoints = {
  // --- Sources and sync ----------------------------------------------------
  listSources: {
    kind: 'read',
    method: 'GET',
    path: '/sources',
    response: z.array(dataSourceSchema),
  },
  getSourceSummary: {
    kind: 'read',
    method: 'GET',
    path: '/sources/summary',
    response: z.array(
      z.object({
        source_id: sourceIdSchema,
        patients_connected: z.number().int(),
        patients_stale: z.number().int(),
        patients_error: z.number().int(),
        last_sync_at: z.iso.datetime().nullable(),
      })
    ),
  },
  getPatientConnections: {
    kind: 'read',
    method: 'GET',
    path: '/patients/:patientId/connections',
    response: z.array(sourceConnectionSchema),
  },
  listSyncRuns: {
    kind: 'read',
    method: 'GET',
    path: '/sync-runs',
    query: z.object({
      patient_id: z.string().optional(),
      limit: z.number().int().optional(),
    }),
    response: z.array(syncRunSchema),
  },

  // --- Data: before and after the resolution pipeline ----------------------
  getObservations: {
    kind: 'read',
    method: 'GET',
    path: '/patients/:patientId/observations',
    description:
      'Per-source canonical daily values, BEFORE resolution. Powers the multi-device overlay.',
    query: z.object({
      ...range,
      metrics: metricList,
      source_id: sourceIdSchema.optional(),
    }),
    response: z.array(observationSchema),
  },
  getResolvedSeries: {
    kind: 'read',
    method: 'GET',
    path: '/patients/:patientId/resolved',
    description:
      'Unified values AFTER resolution, one point per metric per day, with conflict info.',
    query: z.object({ ...range, metrics: metricList }),
    response: z.array(resolvedSeriesSchema),
  },

  // --- Patient and cohort --------------------------------------------------
  getPatient: {
    kind: 'read',
    method: 'GET',
    path: '/patients/:patientId',
    response: z.object({
      chart: patientChartSchema,
      risk: riskAssessmentSchema,
      confidence: dataConfidenceSchema,
      deviations: z.array(metricDeviationSchema),
      worklist: worklistItemSchema,
    }),
  },
  getCohortSummary: {
    kind: 'read',
    method: 'GET',
    path: '/cohort/summary',
    response: z.object({
      as_of: date,
      patient_count: z.number().int(),
      tier_counts: z.record(riskTierSchema, z.number().int()),
      trends: z.array(cohortTrendSchema),
    }),
  },
  listWorklist: {
    kind: 'read',
    method: 'GET',
    path: '/worklist',
    description:
      'Ranked: re_escalated first, then new by risk_score. Snoozed (routed) patients sort below.',
    query: z.object({
      tier: riskTierSchema.optional(),
      status: worklistStatusSchema.optional(),
    }),
    response: z.array(worklistItemSchema),
  },

  // --- Insight -------------------------------------------------------------
  getInsight: {
    kind: 'read',
    method: 'GET',
    path: '/patients/:patientId/insight',
    response: insightNoteSchema.nullable(),
  },
  generateInsight: {
    kind: 'ai',
    method: 'POST',
    path: '/insights/generate',
    description:
      'LLM turns computed features into prose. Output must contain no drug names, doses, or treatments; ' +
      'backend validates and falls back to a rules template on violation.',
    body: insightFeaturesSchema,
    response: insightTextSchema,
  },

  // --- Actions: route, EHR, audit -----------------------------------------
  routePatient: {
    kind: 'action',
    method: 'POST',
    path: '/patients/:patientId/route',
    description:
      'Snoozes the worklist item and creates the EHR notification. Does not touch risk.',
    body: z.object({ actor_id: z.string() }),
    response: z.object({
      message: z.literal('Request submitted (demo mode).'),
      worklist: worklistItemSchema,
      notification: notificationSchema,
    }),
  },
  listNotifications: {
    kind: 'read',
    method: 'GET',
    path: '/ehr/notifications',
    query: z.object({
      status: z.enum(['unread', 'acknowledged', 'dismissed']).optional(),
    }),
    response: z.array(notificationSchema),
  },
  actOnNotification: {
    kind: 'action',
    method: 'POST',
    path: '/ehr/notifications/:notificationId/actions',
    description:
      'acknowledge -> worklist "acknowledged"; dismiss -> worklist "resolved" [DEFAULT]; add_plan_note needs text.',
    body: z.object({
      action: clinicianActionSchema,
      actor_id: z.string(),
      text: z.string().optional(),
    }),
    response: z.object({
      notification: notificationSchema,
      worklist: worklistItemSchema,
    }),
  },
  listAudit: {
    kind: 'read',
    method: 'GET',
    path: '/audit',
    query: z.object({
      patient_id: z.string().optional(),
      limit: z.number().int().optional(),
    }),
    response: z.array(auditEventSchema),
  },

  // --- Demo controls -------------------------------------------------------
  runSync: {
    kind: 'demo',
    method: 'POST',
    path: '/demo/sync',
    description:
      'Simulates the 24h sync (in production this is a scheduled job, not an endpoint).',
    body: z.object({ patient_id: z.string().optional() }),
    response: z.array(syncRunSchema),
  },
  worsenPatient: {
    kind: 'demo',
    method: 'POST',
    path: '/demo/patients/:patientId/worsen',
    description: 'Pushes a snoozed patient past the re-escalation threshold.',
    response: worklistItemSchema,
  },
  advanceClock: {
    kind: 'demo',
    method: 'POST',
    path: '/demo/clock/advance',
    body: z.object({ days: z.number().int() }),
    response: z.object({ now: z.iso.datetime() }),
  },
} as const

export type EndpointName = keyof typeof endpoints
export type EndpointResponse<K extends EndpointName> = z.infer<
  (typeof endpoints)[K]['response']
>
