import type { RiskAssessment, WorklistItem } from '../contracts'

const RE_ESCALATION_MARGIN = 15

export function checkReescalation(
  worklist: WorklistItem[],
  risks: Map<string, RiskAssessment>
): WorklistItem[] {
  return worklist.map((item) => {
    if (item.status !== 'routed') return item

    const currentRisk = risks.get(item.patient_id)
    if (!currentRisk) return item

    const riskAtRouting = item.risk_at_routing
    if (riskAtRouting == null) return item

    if (currentRisk.score > riskAtRouting + RE_ESCALATION_MARGIN) {
      return {
        ...item,
        status: 're_escalated',
        snooze_until: null,
        last_updated: new Date().toISOString(),
      }
    }

    return item
  })
}

export function getReEscalationMargin(): number {
  return RE_ESCALATION_MARGIN
}
