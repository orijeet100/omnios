import { getApiAdapter } from '@/api'
import { CONDITION_LABELS, METRICS, SOURCES } from '@/contracts'

/**
 * The patient context written into that patient's Runlog project, so the
 * clinician's chat is grounded in one patient's own data and nothing else.
 *
 * This is a data payload, not UI copy, so it keeps the contract's field names
 * (baseline_median, threshold) rather than the UI's vocabulary.
 */

/** How far back the daily series reaches from the insight's as-of date. */
const SERIES_LOOKBACK_DAYS = 90

/** Deviations beyond this are noise for a chat answer. */
const MAX_DEVIATIONS = 25

const ABOUT = [
  'OmniOS patient context. OmniOS is a wearable-data insight layer for care',
  "managers and population health nurses; it summarizes what a patient's own",
  'devices reported and never makes clinical decisions. Every value here comes',
  'from a synthetic demo cohort.',
  '',
  'Guidance for answering questions about this patient: report what the data',
  'shows and show the numbers behind it. Do not diagnose, and do not name a',
  'drug, a dose, or a specific treatment. Where something looks concerning,',
  'point at the metric, the window, and the data confidence, and stop there.',
].join('\n')

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

/**
 * The adapter types a resolved series' metric as a plain string, so an unknown
 * key falls back to the key itself rather than throwing on a lookup.
 */
function labelOf(metric: string): string {
  return METRICS[metric as keyof typeof METRICS]?.label ?? metric
}

export function buildPatientChatContext(patientId: string) {
  const adapter = getApiAdapter()
  const detail = adapter.getPatient(patientId)
  const chart = adapter.getEhrChart(patientId)
  const insight = adapter.getInsight(patientId)
  const connections = adapter.getPatientConnections(patientId)

  const asOf = insight?.as_of ?? null
  const from = asOf ? shiftDate(asOf, -SERIES_LOOKBACK_DAYS) : null
  const series = from ? adapter.getResolvedSeries(patientId, from, asOf!) : []
  const weeklyFlags = from
    ? adapter.getPatientWeeklyFlags(patientId, from, asOf!)
    : []

  const deviations = [...(detail?.deviations ?? [])]
    .sort((a, b) => Math.abs(b.z_score) - Math.abs(a.z_score))
    .slice(0, MAX_DEVIATIONS)
    .map((d) => ({
      metric: d.metric,
      label: labelOf(d.metric),
      unit: d.unit,
      current: d.current,
      baseline_median: d.baseline_median,
      baseline_window_days: d.baseline_window_days,
      delta_abs: d.delta_abs,
      delta_pct: d.delta_pct,
      z_score: d.z_score,
      slope_per_day_7d: d.slope_per_day_7d,
      days_out_of_range: d.days_out_of_range,
    }))

  // Where two devices disagreed beyond the metric's tolerance. A disagreement
  // lowers confidence rather than becoming a finding of its own.
  const conflicts = series.flatMap((s) =>
    s.points
      .filter((point) => point.conflict)
      .map((point) => ({
        date: point.date,
        metric: s.metric,
        label: labelOf(s.metric),
        unit: s.unit,
        spread: point.spread,
        candidates: point.candidates.map((c) => ({
          source: SOURCES[c.source_id].name,
          value: c.value,
          quality_flag: c.quality_flag,
        })),
      }))
  )

  const dailySeries = series
    .filter((s) => s.points.length > 0)
    .map((s) => ({
      metric: s.metric,
      label: labelOf(s.metric),
      unit: s.unit,
      /** One [date, value] pair per day the patient reported a value. */
      days: s.points.map((point) => [point.date, point.value]),
    }))

  return {
    about: ABOUT,
    data_notice: 'Synthetic demo data. Not real patient data.',
    as_of: asOf,
    patient: detail
      ? {
          patient_id: detail.patient.patient_id,
          name: detail.patient.name,
          age: detail.patient.age,
          sex: detail.patient.sex,
          conditions: detail.patient.conditions.map(
            (code) => CONDITION_LABELS[code]
          ),
          attributed_to_hospital: detail.patient.attributed_to_hospital,
        }
      : null,
    risk: detail
      ? {
          score: detail.risk.score,
          tier: detail.risk.tier,
          trend: detail.risk.trend,
          model_version: detail.risk.model_version,
          drivers: detail.risk.drivers.map((d) => ({
            metric: d.metric,
            label: labelOf(d.metric),
            contribution: d.contribution,
            direction: d.direction,
          })),
        }
      : null,
    data_confidence: detail
      ? {
          level: detail.confidence.level,
          score: detail.confidence.score,
          summary: detail.confidence.summary,
          factors: detail.confidence.factors,
        }
      : null,
    insight_note: insight
      ? {
          what_changed: insight.what_changed,
          versus_baseline: insight.versus_baseline,
          window: insight.window,
          confidence: insight.confidence,
          sources: insight.sources,
          suggestion: insight.suggestion,
          generated_by: insight.generated_by,
        }
      : null,
    worklist: detail
      ? {
          status: detail.worklist.status,
          primary_driver: detail.worklist.primary_driver,
          routed_at: detail.worklist.routed_at,
          snooze_until: detail.worklist.snooze_until,
          risk_at_routing: detail.worklist.risk_at_routing,
        }
      : null,
    connected_devices: connections.map((c) => ({
      source: SOURCES[c.source_id].name,
      category: SOURCES[c.source_id].category,
      status: c.status,
      last_sync_at: c.last_sync_at,
      last_data_date: c.last_data_date,
    })),
    deviations,
    device_conflicts: conflicts,
    daily_series: dailySeries,
    weekly_flags: weeklyFlags.map((f) => ({
      week_start: f.week_start,
      metric: f.metric,
      label: labelOf(f.metric),
      weekly_avg: f.weekly_avg,
      baseline: f.baseline,
      rule_kind: f.rule_kind,
      threshold: f.threshold,
      days_with_data: f.days_with_data,
      status: f.status,
    })),
    ehr_chart: chart
      ? {
          timezone: chart.timezone,
          medications: chart.medications.map((m) => ({
            drug_class: m.label,
            started: m.started,
          })),
          labs: chart.labs.map((l) => ({
            name: l.name,
            value: l.value,
            unit: l.unit,
            date: l.date,
          })),
          clinic_vitals: chart.clinic_vitals,
          encounters: chart.encounters.map((e) => ({
            type: e.type,
            date: e.date,
            reason: e.reason,
          })),
        }
      : null,
  }
}
