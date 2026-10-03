import type {
  DataConfidence,
  Observation,
  ResolvedMetric,
  SourceConnection,
} from '../contracts'
import { clamp, mean } from './stats'

const CONFIDENCE_WINDOW_DAYS = 7

export function computeConfidence(
  resolved: ResolvedMetric[],
  observations: Observation[],
  connections: SourceConnection[],
  patientId: string,
  asOf: string,
): DataConfidence {
  const patientResolved = resolved.filter(
    (r) => r.patient_id === patientId && r.date <= asOf,
  )
  const patientObservations = observations.filter(
    (o) => o.patient_id === patientId && o.date <= asOf,
  )
  const patientConnections = connections.filter((c) => c.patient_id === patientId)

  const cutoff = new Date(asOf)
  cutoff.setDate(cutoff.getDate() - CONFIDENCE_WINDOW_DAYS)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const recentResolved = patientResolved.filter(
    (r) => r.date > cutoffStr && r.date <= asOf,
  )
  const recentObservations = patientObservations.filter(
    (o) => o.date > cutoffStr && o.date <= asOf,
  )

  const wearTimePoints = recentResolved.filter((r) => r.metric === 'wear_time')
  const wearTimePct =
    wearTimePoints.length > 0
      ? mean(wearTimePoints.map((p) => (p.value / 1440) * 100))
      : 0

  const allDates = new Set(recentResolved.map((r) => r.date))
  const expectedDays = CONFIDENCE_WINDOW_DAYS
  const missingDays = expectedDays - allDates.size

  const implausibleCount = recentObservations.filter(
    (o) => o.quality_flag === 'implausible',
  ).length

  const conflictCount = recentResolved.filter((r) => r.conflict).length
  const multiSourceCount = recentResolved.filter(
    (r) => r.candidates.length > 1,
  ).length

  let sourceAgreement: DataConfidence['factors']['source_agreement']
  if (multiSourceCount === 0) {
    sourceAgreement = 'single_source'
  } else if (conflictCount > 0) {
    sourceAgreement = 'conflict'
  } else {
    sourceAgreement = 'agree'
  }

  const activeConnections = patientConnections.filter(
    (c) => c.status === 'connected' || c.status === 'stale',
  ).length

  let score = 1.0
  score *= clamp(wearTimePct / 100, 0, 1)
  score *= clamp(1 - missingDays / expectedDays, 0, 1)
  score *= clamp(1 - implausibleCount / 10, 0, 1)
  if (sourceAgreement === 'conflict') score *= 0.85
  if (activeConnections === 0) score *= 0.5

  score = clamp(score, 0, 1)

  let level: DataConfidence['level']
  if (score >= 0.7) level = 'high'
  else if (score >= 0.4) level = 'medium'
  else level = 'low'

  const reasons: string[] = []
  if (wearTimePct < 50) reasons.push(`Wear time ${Math.round(wearTimePct)}%`)
  if (missingDays > 2) reasons.push(`${missingDays} missing days`)
  if (implausibleCount > 0)
    reasons.push(`${implausibleCount} implausible reading${implausibleCount > 1 ? 's' : ''}`)
  if (sourceAgreement === 'conflict') reasons.push('Source conflict detected')
  if (activeConnections === 0) reasons.push('No active connections')

  const summary =
    reasons.length > 0
      ? reasons.join('; ')
      : 'Data quality good across all sources'

  return {
    level,
    score: Math.round(score * 100) / 100,
    factors: {
      wear_time_pct: Math.round(wearTimePct),
      missing_days: missingDays,
      implausible_count: implausibleCount,
      source_agreement: sourceAgreement,
    },
    summary,
  }
}

export function computeConfidenceForAll(
  resolved: ResolvedMetric[],
  observations: Observation[],
  connections: SourceConnection[],
  patientIds: string[],
  asOf: string,
): Map<string, DataConfidence> {
  const result = new Map<string, DataConfidence>()
  for (const id of patientIds) {
    result.set(id, computeConfidence(resolved, observations, connections, id, asOf))
  }
  return result
}
