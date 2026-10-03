import type {
  ConditionCode,
  DataConfidence,
  InsightNote,
  Metric,
  RiskAssessment,
  WorklistItem,
  WorklistStatus,
} from '../contracts'

export function buildWorklistItem(
  patientId: string,
  name: string,
  age: number,
  sex: 'F' | 'M',
  conditions: ConditionCode[],
  risk: RiskAssessment,
  confidence: DataConfidence,
  insightNote: InsightNote | null,
  existingStatus?: WorklistStatus,
  routedAt?: string,
  snoozeUntil?: string,
  riskAtRouting?: number
): WorklistItem {
  const primaryDriver =
    risk.drivers.length > 0 ? (risk.drivers[0].metric as Metric) : null

  return {
    patient_id: patientId,
    name,
    age,
    sex,
    conditions,
    risk_score: risk.score,
    risk_tier: risk.tier,
    risk_trend: risk.trend,
    data_confidence: confidence.level,
    primary_driver: primaryDriver,
    status: existingStatus ?? 'new',
    routed_at: routedAt ?? null,
    snooze_until: snoozeUntil ?? null,
    risk_at_routing: riskAtRouting ?? null,
    last_updated: new Date().toISOString(),
    insight_note_id: insightNote?.id ?? null,
  }
}

export function rankWorklist(items: WorklistItem[]): WorklistItem[] {
  return [...items].sort((a, b) => {
    if (a.status === 're_escalated' && b.status !== 're_escalated') return -1
    if (b.status === 're_escalated' && a.status !== 're_escalated') return 1

    const aSnoozed = a.status === 'routed' ? 1 : 0
    const bSnoozed = b.status === 'routed' ? 1 : 0
    if (aSnoozed !== bSnoozed) return aSnoozed - bSnoozed

    return b.risk_score - a.risk_score
  })
}

export function buildWorklist(
  patients: {
    patient_id: string
    name: string
    age: number
    sex: 'F' | 'M'
    conditions: ConditionCode[]
  }[],
  risks: Map<string, RiskAssessment>,
  confidences: Map<string, DataConfidence>,
  insights: Map<string, InsightNote>,
  existingStatuses: Map<string, WorklistStatus>,
  existingRoutedAt: Map<string, string>,
  existingSnoozeUntil: Map<string, string>,
  existingRiskAtRouting: Map<string, number>
): WorklistItem[] {
  const items: WorklistItem[] = []

  for (const patient of patients) {
    const risk = risks.get(patient.patient_id)
    if (!risk) continue

    const confidence =
      confidences.get(patient.patient_id) ??
      ({
        level: 'low',
        score: 0,
        factors: {
          wear_time_pct: 0,
          missing_days: 7,
          implausible_count: 0,
          source_agreement: 'single_source',
        },
        summary: 'No data',
      } as DataConfidence)

    const insight = insights.get(patient.patient_id) ?? null

    items.push(
      buildWorklistItem(
        patient.patient_id,
        patient.name,
        patient.age,
        patient.sex,
        patient.conditions,
        risk,
        confidence,
        insight,
        existingStatuses.get(patient.patient_id),
        existingRoutedAt.get(patient.patient_id),
        existingSnoozeUntil.get(patient.patient_id),
        existingRiskAtRouting.get(patient.patient_id)
      )
    )
  }

  return rankWorklist(items)
}
