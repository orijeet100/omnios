import type {
  DataConfidence,
  InsightFeatures,
  InsightNote,
  InsightText,
  MetricDeviation,
  RiskAssessment,
  SourceId,
} from '../contracts'
import { METRICS, SOURCES } from '../contracts'

export function generateInsightFeatures(
  patientId: string,
  asOf: string,
  risk: RiskAssessment,
  deviations: MetricDeviation[],
  confidence: DataConfidence,
  sources: SourceId[]
): InsightFeatures {
  const significantDeviations = deviations
    .filter((d) => Math.abs(d.z_score) > 1.5 || Math.abs(d.delta_pct) > 10)
    .sort((a, b) => Math.abs(b.z_score) - Math.abs(a.z_score))
    .slice(0, 5)

  const windowDays = 7

  return {
    patient_id: patientId,
    as_of: asOf,
    risk_tier: risk.tier,
    window: {
      from: shiftDate(asOf, -windowDays),
      to: asOf,
      days: windowDays,
    },
    baseline: { basis: 'median', days: 30 },
    changes: significantDeviations.map((d) => ({
      metric: d.metric,
      unit: d.unit,
      delta_abs: d.delta_abs,
      delta_pct: d.delta_pct,
      direction: d.delta_abs > 0 ? ('up' as const) : ('down' as const),
    })),
    confidence: {
      level: confidence.level,
      reasons: [confidence.summary],
    },
    sources,
  }
}

export function generateInsightText(features: InsightFeatures): InsightText {
  const whatChanged = buildWhatChanged(features.changes)
  const versusBaseline = `Patient's ${features.baseline.days}-day median`
  const window = `Last ${features.window.days} days`
  const confidence = buildConfidenceText(features.confidence)
  const sources = buildSourcesText(features.sources)
  const suggestion = buildSuggestion(features.risk_tier)

  return {
    what_changed: whatChanged,
    versus_baseline: versusBaseline,
    window,
    confidence,
    sources,
    suggestion,
  }
}

export function generateInsightNote(
  features: InsightFeatures,
  text: InsightText
): InsightNote {
  return {
    id: `insight-${features.patient_id}-${features.as_of}`,
    patient_id: features.patient_id,
    as_of: features.as_of,
    generated_at: new Date().toISOString(),
    generated_by: 'rules',
    features,
    ...text,
  }
}

function buildWhatChanged(changes: InsightFeatures['changes']): string {
  if (changes.length === 0) return 'No significant changes detected'

  const parts = changes.map((c) => {
    const label = METRICS[c.metric].label
    const sign = c.delta_abs > 0 ? '+' : ''
    return `${label} ${sign}${c.delta_abs}${c.unit}`
  })

  return parts.join('; ')
}

function buildConfidenceText(
  confidence: InsightFeatures['confidence']
): string {
  const levelLabel =
    confidence.level.charAt(0).toUpperCase() + confidence.level.slice(1)
  return `${levelLabel} (${confidence.reasons.join('; ')})`
}

function buildSourcesText(sources: SourceId[]): string {
  if (sources.length === 0) return 'No sources'
  return sources.map((s) => SOURCES[s].name).join(', ')
}

function buildSuggestion(riskTier: InsightFeatures['risk_tier']): string {
  switch (riskTier) {
    case 'critical':
      return 'Flag for clinician review. Consider urgent outreach.'
    case 'high':
      return 'Flag for clinician review. Consider medication review.'
    case 'watch':
      return 'Flag for clinician review. Consider outreach.'
    case 'low':
      return 'Continue monitoring. No action needed at this time.'
  }
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
