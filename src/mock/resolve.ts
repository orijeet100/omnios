import {
  METRICS,
  RESOLUTION_PRECEDENCE,
  type Observation,
  type ResolvedMetric,
} from '../contracts'

/**
 * The resolution pipeline. For each patient, metric and day:
 * - gather every source's observation (nothing is deleted),
 * - the winner is the first source in RESOLUTION_PRECEDENCE with an `ok` value,
 * - if `ok` candidates disagree by more than the metric's tolerance, flag a conflict.
 * Days where no source has an `ok` value produce no resolved point (a gap).
 *
 * This is real logic, not mock logic: the backend can port it as is.
 */
export function resolve(observations: Observation[]): ResolvedMetric[] {
  const groups = new Map<string, Observation[]>()
  for (const o of observations) {
    const key = `${o.patient_id}|${o.date}|${o.metric}`
    const g = groups.get(key)
    if (g) g.push(o)
    else groups.set(key, [o])
  }

  const out: ResolvedMetric[] = []
  for (const group of groups.values()) {
    const first = group[0]
    const ok = group.filter((o) => o.quality_flag === 'ok')
    if (ok.length === 0) continue

    const order = RESOLUTION_PRECEDENCE[first.metric]
    const winner = [...ok].sort(
      (a, b) => order.indexOf(a.source_id) - order.indexOf(b.source_id)
    )[0]

    const values = ok.map((o) => o.value)
    const spread =
      ok.length > 1 ? Math.max(...values) - Math.min(...values) : null

    out.push({
      patient_id: first.patient_id,
      date: first.date,
      metric: first.metric,
      value: winner.value,
      unit: winner.unit,
      resolved_from: winner.source_id,
      strategy: group.length === 1 ? 'single_source' : 'precedence',
      candidates: group.map((o) => ({
        source_id: o.source_id,
        value: o.value,
        quality_flag: o.quality_flag,
      })),
      conflict:
        spread != null && spread > METRICS[first.metric].conflictTolerance,
      spread: spread == null ? null : Math.round(spread * 100) / 100,
    })
  }
  return out
}
