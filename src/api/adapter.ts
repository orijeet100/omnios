import {
  buildCohortTrends,
  buildTierCounts,
  buildWorklist,
  checkReescalation,
  computeBaselinesForAll,
  computeConfidenceForAll,
  computeDeviationsForAll,
  computeRiskForAll,
  generateInsightFeatures,
  generateInsightNote,
  generateInsightText,
} from '../analysis'
import {
  SOURCES,
  type AuditEvent,
  type ClinicianAction,
  type InsightNote,
  type Notification,
  type Observation,
  type PatientChart,
  type PatientSummary,
  type ResolvedMetric,
  type SourceConnection,
  type SourceId,
  type SyncRun,
  type WorklistStatus,
} from '../contracts'
import {
  getDataset,
  computeSegments,
  generateObservations,
  resolve,
  type Dataset,
} from '../mock'

const SNOOZE_DAYS = 14

export interface EditedNote {
  suggestion: string
  prescription_suggestions: string
}

export class MockApiAdapter {
  private dataset: Dataset
  private asOf: string
  private worklistStatuses: Map<string, WorklistStatus> = new Map()
  private routedAt: Map<string, string> = new Map()
  private snoozeUntil: Map<string, string> = new Map()
  private riskAtRouting: Map<string, number> = new Map()
  private notifications: Notification[] = []
  private auditEvents: AuditEvent[] = []
  private syncRuns: SyncRun[] = []
  private editedNotes: Map<string, EditedNote> = new Map()

  constructor() {
    this.dataset = getDataset()
    this.asOf = this.dataset.window.end
    this.initializeSyncRuns()
  }

  private initializeSyncRuns(): void {
    for (const conn of this.dataset.connections) {
      if (conn.last_data_date) {
        this.syncRuns.push({
          id: `sync-${conn.id}`,
          connection_id: conn.id,
          started_at: `${conn.last_data_date}T05:00:00Z`,
          finished_at: `${conn.last_data_date}T05:05:00Z`,
          status: 'success',
          window_start: conn.last_data_date,
          window_end: conn.last_data_date,
          records_received: 10,
          records_rejected: 0,
          error: null,
        })
      }
    }
  }

  private getPatientSummaries(): PatientSummary[] {
    return this.dataset.profiles.map((p) => ({
      patient_id: p.id,
      name: p.name,
      age: p.age,
      sex: p.sex,
      conditions: p.conditions,
      attributed_to_hospital: true,
    }))
  }

  private getConditionsMap(): Map<string, PatientSummary['conditions']> {
    const map = new Map<string, PatientSummary['conditions']>()
    for (const p of this.dataset.profiles) {
      map.set(p.id, p.conditions)
    }
    return map
  }

  private getSourcesForPatient(patientId: string) {
    const resolved = this.dataset.resolved.filter(
      (r) => r.patient_id === patientId
    )
    const sourceSet = new Set<string>()
    for (const r of resolved) {
      sourceSet.add(r.resolved_from)
    }
    return [...sourceSet] as SourceId[]
  }

  private runAnalysis() {
    const patientIds = this.dataset.profiles.map((p) => p.id)

    const baselines = computeBaselinesForAll(
      this.dataset.resolved,
      patientIds,
      this.asOf
    )
    const deviations = computeDeviationsForAll(
      this.dataset.resolved,
      baselines,
      this.asOf
    )
    const confidences = computeConfidenceForAll(
      this.dataset.resolved,
      this.dataset.observations,
      this.dataset.connections,
      patientIds,
      this.asOf
    )
    const risks = computeRiskForAll(
      deviations,
      this.getConditionsMap(),
      confidences,
      this.asOf
    )

    const insights = new Map<string, InsightNote>()
    for (const p of this.dataset.profiles) {
      const risk = risks.get(p.id)
      if (!risk) continue
      const devs = deviations.get(p.id) ?? []
      const conf = confidences.get(p.id)
      if (!conf) continue
      const sources = this.getSourcesForPatient(p.id)

      const features = generateInsightFeatures(
        p.id,
        this.asOf,
        risk,
        devs,
        conf,
        sources
      )
      const text = generateInsightText(features)
      insights.set(p.id, generateInsightNote(features, text))
    }

    return { baselines, deviations, confidences, risks, insights }
  }

  listSources() {
    return (
      Object.entries(SOURCES) as [SourceId, (typeof SOURCES)[SourceId]][]
    ).map(([id, source]) => ({ id, ...source }))
  }

  getSourceSummary() {
    return this.listSources().map((s) => {
      const conns = this.dataset.connections.filter((c) => c.source_id === s.id)
      return {
        source_id: s.id,
        patients_connected: conns.filter((c) => c.status === 'connected')
          .length,
        patients_stale: conns.filter((c) => c.status === 'stale').length,
        patients_error: conns.filter((c) => c.status === 'error').length,
        last_sync_at: conns.find((c) => c.last_sync_at)?.last_sync_at ?? null,
      }
    })
  }

  getPatientConnections(patientId: string): SourceConnection[] {
    return this.dataset.connections.filter((c) => c.patient_id === patientId)
  }

  listSyncRuns(patientId?: string): SyncRun[] {
    if (patientId) {
      return this.syncRuns.filter((s) => s.connection_id.startsWith(patientId))
    }
    return this.syncRuns
  }

  getObservations(patientId: string, from: string, to: string): Observation[] {
    return this.dataset.observations.filter(
      (o) => o.patient_id === patientId && o.date >= from && o.date <= to
    )
  }

  getResolvedSeries(patientId: string, from: string, to: string) {
    const resolved = this.dataset.resolved.filter(
      (r) => r.patient_id === patientId && r.date >= from && r.date <= to
    )

    const byMetric = new Map<string, ResolvedMetric[]>()
    for (const r of resolved) {
      const list = byMetric.get(r.metric) ?? []
      list.push(r)
      byMetric.set(r.metric, list)
    }

    return [...byMetric.entries()].map(([metric, points]) => ({
      metric,
      unit: points[0].unit,
      points: points.sort((a, b) => a.date.localeCompare(b.date)),
    }))
  }

  getPatient(patientId: string) {
    const profile = this.dataset.profiles.find((p) => p.id === patientId)
    if (!profile) return null

    const { risks, confidences, deviations, insights } = this.runAnalysis()

    const risk = risks.get(patientId)
    const confidence = confidences.get(patientId)
    const devs = deviations.get(patientId) ?? []
    const insight = insights.get(patientId) ?? null

    if (!risk || !confidence) return null

    const patient: PatientSummary = {
      patient_id: profile.id,
      name: profile.name,
      age: profile.age,
      sex: profile.sex,
      conditions: profile.conditions,
      attributed_to_hospital: true,
    }

    const only = <V>(value: V | undefined) =>
      new Map<string, V>(value === undefined ? [] : [[patientId, value]])

    const worklistItem = buildWorklist(
      [patient],
      only(risk),
      only(confidence),
      only(insight ?? undefined),
      only(this.worklistStatuses.get(patientId)),
      only(this.routedAt.get(patientId)),
      only(this.snoozeUntil.get(patientId)),
      only(this.riskAtRouting.get(patientId))
    )[0]

    return {
      patient,
      risk,
      confidence,
      deviations: devs,
      worklist: worklistItem,
      insight,
    }
  }

  getEhrChart(patientId: string): PatientChart | null {
    return this.dataset.charts.find((c) => c.patient_id === patientId) ?? null
  }

  getCohortSummary() {
    const { risks } = this.runAnalysis()
    const segments = this.getCohortSegments(this.asOf).segments
    const trends = buildCohortTrends(segments, risks)
    const tierCounts = buildTierCounts(risks)

    return {
      as_of: this.asOf,
      patient_count: this.dataset.profiles.length,
      tier_counts: tierCounts,
      trends,
    }
  }

  getCohortSegments(weekStart: string) {
    return computeSegments(
      this.dataset.profiles,
      this.dataset.weeklyFlags,
      weekStart
    )
  }

  getPatientWeeklyFlags(patientId: string, from: string, to: string) {
    return this.dataset.weeklyFlags.filter(
      (f) =>
        f.patient_id === patientId && f.week_start >= from && f.week_start <= to
    )
  }

  listWorklist() {
    const { risks, confidences, insights } = this.runAnalysis()
    const patients = this.getPatientSummaries().map((p) => ({
      patient_id: p.patient_id,
      name: p.name,
      age: p.age,
      sex: p.sex,
      conditions: p.conditions,
    }))

    const worklist = buildWorklist(
      patients,
      risks,
      confidences,
      insights,
      this.worklistStatuses,
      this.routedAt,
      this.snoozeUntil,
      this.riskAtRouting
    )

    return checkReescalation(worklist, risks)
  }

  getInsight(patientId: string): InsightNote | null {
    const { insights } = this.runAnalysis()
    const insight = insights.get(patientId) ?? null
    if (!insight) return null

    const edited = this.editedNotes.get(patientId)
    if (!edited) return insight

    return {
      ...insight,
      suggestion: edited.suggestion,
    }
  }

  updateInsightNote(
    patientId: string,
    suggestion: string,
    prescriptionSuggestions: string
  ): void {
    this.editedNotes.set(patientId, {
      suggestion,
      prescription_suggestions: prescriptionSuggestions,
    })
  }

  getEhrContext(patientId: string) {
    const chart = this.getEhrChart(patientId)
    const insight = this.getInsight(patientId)
    const connections = this.getPatientConnections(patientId)
    return { chart, insight, connections }
  }

  getSplitScreenData(patientId: string) {
    const patient = this.getPatient(patientId)
    const ehr = this.getEhrContext(patientId)
    return { patient, ehr }
  }

  routePatient(patientId: string, actorId: string) {
    const { risks, insights } = this.runAnalysis()
    const risk = risks.get(patientId)
    const insight = insights.get(patientId)

    if (!risk || !insight) return null

    const profile = this.dataset.profiles.find((p) => p.id === patientId)
    const patientName = profile?.name ?? patientId

    const edited = this.editedNotes.get(patientId)
    const finalInsight = edited
      ? { ...insight, suggestion: edited.suggestion }
      : insight

    const now = new Date()
    const snoozeDate = new Date(now)
    snoozeDate.setDate(snoozeDate.getDate() + SNOOZE_DAYS)

    this.worklistStatuses.set(patientId, 'routed')
    this.routedAt.set(patientId, now.toISOString())
    this.snoozeUntil.set(patientId, snoozeDate.toISOString())
    this.riskAtRouting.set(patientId, risk.score)

    const notification: Notification = {
      id: `notif-${patientId}-${Date.now()}`,
      patient_id: patientId,
      insight_note_id: finalInsight.id,
      created_at: now.toISOString(),
      status: 'unread',
      priority: risk.score > 75 ? 'high' : risk.score > 50 ? 'medium' : 'low',
      message: `${patientName} trending outside normal parameters. ${finalInsight.what_changed}`,
      plan_notes: [],
    }
    this.notifications.push(notification)

    this.addAuditEvent({
      actor_role: 'care_manager',
      actor_id: actorId,
      patient_id: patientId,
      action: 'routed',
      detail: `Routed to clinician. Risk score: ${risk.score}. Snoozed until ${snoozeDate.toISOString()}.`,
    })

    const worklist = this.listWorklist()
    const worklistItem = worklist.find((w) => w.patient_id === patientId)

    return {
      message: 'Request submitted (demo mode).' as const,
      worklist: worklistItem!,
      notification,
    }
  }

  listNotifications(status?: Notification['status']) {
    if (status) {
      return this.notifications.filter((n) => n.status === status)
    }
    return this.notifications
  }

  actOnNotificationByPatient(
    patientId: string,
    action: ClinicianAction,
    actorId: string = 'clinician',
    text?: string
  ) {
    const notification = this.notifications.find(
      (n) => n.patient_id === patientId
    )
    if (!notification) return null
    return this.actOnNotification(notification.id, action, actorId, text)
  }

  actOnNotification(
    notificationId: string,
    action: ClinicianAction,
    actorId: string = 'clinician',
    text?: string
  ) {
    const notification = this.notifications.find((n) => n.id === notificationId)
    if (!notification) return null

    const now = new Date().toISOString()

    if (action === 'acknowledge') {
      notification.status = 'acknowledged'
      this.worklistStatuses.set(notification.patient_id, 'acknowledged')
      this.addAuditEvent({
        actor_role: 'clinician',
        actor_id: actorId,
        patient_id: notification.patient_id,
        action: 'acknowledged',
        detail: 'Clinician acknowledged the notification.',
      })
    } else if (action === 'dismiss') {
      notification.status = 'dismissed'
      this.worklistStatuses.set(notification.patient_id, 'resolved')
      this.addAuditEvent({
        actor_role: 'clinician',
        actor_id: actorId,
        patient_id: notification.patient_id,
        action: 'dismissed',
        detail: 'Clinician dismissed the notification.',
      })
    } else if (action === 'add_plan_note' && text) {
      notification.plan_notes.push({
        id: `note-${Date.now()}`,
        author: actorId,
        text,
        created_at: now,
      })
      this.addAuditEvent({
        actor_role: 'clinician',
        actor_id: actorId,
        patient_id: notification.patient_id,
        action: 'plan_note_added',
        detail: `Plan note added: ${text}`,
      })
    }

    const worklist = this.listWorklist()
    const worklistItem = worklist.find(
      (w) => w.patient_id === notification.patient_id
    )

    return {
      notification,
      worklist: worklistItem!,
    }
  }

  listAudit(patientId?: string) {
    if (patientId) {
      return this.auditEvents.filter((e) => e.patient_id === patientId)
    }
    return this.auditEvents
  }

  worsenPatient(patientId: string) {
    const profile = this.dataset.profiles.find((p) => p.id === patientId)
    if (!profile) return null

    const baseProfile = { ...profile }
    baseProfile.physio = {
      ...profile.physio,
      hr: profile.physio.hr + 15,
      hrv: profile.physio.hrv * 0.7,
      hrvSdnn: profile.physio.hrvSdnn * 0.7,
      resp: profile.physio.resp + 4,
      spo2: profile.physio.spo2 - 4,
      sleep: profile.physio.sleep - 120,
      steps: profile.physio.steps * 0.5,
    }

    const newObs = generateObservations(baseProfile, this.dataset.seed)

    this.dataset.observations.push(...newObs)

    this.dataset.resolved = resolve(this.dataset.observations)

    const worklist = this.listWorklist()
    return worklist.find((w) => w.patient_id === patientId) ?? null
  }

  advanceClock(days: number) {
    const current = new Date(this.asOf)
    current.setDate(current.getDate() + days)
    this.asOf = current.toISOString().slice(0, 10)
    return { now: current.toISOString() }
  }

  runSync() {
    const now = new Date().toISOString()
    const runs = this.dataset.connections.map((conn) => ({
      id: `sync-${conn.id}-demo`,
      connection_id: conn.id,
      started_at: now,
      finished_at: now,
      status: 'success' as const,
      window_start: this.asOf,
      window_end: this.asOf,
      records_received: 5,
      records_rejected: 0,
      error: null,
    }))
    this.syncRuns.push(...runs)
    this.addAuditEvent({
      actor_role: 'system',
      actor_id: 'demo',
      patient_id: null,
      action: 'sync_completed',
      detail: `Sync run completed for ${runs.length} connections`,
    })
    return runs
  }

  private addAuditEvent(event: Omit<AuditEvent, 'event_id' | 'timestamp'>) {
    this.auditEvents.push({
      ...event,
      event_id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    })
  }
}

let adapter: MockApiAdapter | null = null

export function getApiAdapter(): MockApiAdapter {
  if (!adapter) {
    adapter = new MockApiAdapter()
  }
  return adapter
}
