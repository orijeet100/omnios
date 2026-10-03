import type {
  BodyScan,
  Observation,
  PatientChart,
  ResolvedMetric,
  SourceConnection,
  WeeklyFlag,
} from '../contracts'
import { bodyScanFor } from './body-scans'
import { buildChart } from './chart'
import { buildCohort } from './cohort'
import { DATA_END, DATA_START, LAST_DAY, addDays, dateOfDay } from './dates'
import { generateObservations } from './generate'
import { resolve } from './resolve'
import type { Archetype, PatientProfile, Story } from './types'
import { computeWeeklyFlags } from './weekly'

export const DEFAULT_SEED = 20260927

/** Mock-only answer key. Never exposed by the API and never shown in the product UI. */
export type GroundTruth = {
  patient_id: string
  archetype: Archetype
  stories: Story[]
  /** ER visit date for the true-positive patients. */
  er_date: string | null
  /** First day of the planted decline, if any. */
  decline_onset_date: string | null
  /** The one-day false-alarm event, if any. */
  false_alarm_date: string | null
}

export type Dataset = {
  seed: number
  window: { start: string; end: string }
  profiles: PatientProfile[]
  charts: PatientChart[]
  observations: Observation[]
  resolved: ResolvedMetric[]
  weeklyFlags: WeeklyFlag[]
  connections: SourceConnection[]
  bodyScans: BodyScan[]
  groundTruth: GroundTruth[]
}

function buildConnections(
  profiles: PatientProfile[],
  observations: Observation[]
): SourceConnection[] {
  const lastDate = new Map<string, string>()
  for (const o of observations) {
    const key = `${o.patient_id}|${o.source_id}`
    const prev = lastDate.get(key)
    if (!prev || o.date > prev) lastDate.set(key, o.date)
  }
  return profiles.flatMap((p) =>
    p.devices.map((d) => {
      const last = lastDate.get(`${p.id}|${d.source}`) ?? null
      const swappedOut = d.to < LAST_DAY
      // Stale = no data in the last two days [DEFAULT]; a swapped-out device is disconnected.
      const status: SourceConnection['status'] = swappedOut
        ? 'disconnected'
        : last && last >= addDays(DATA_END, -1)
          ? 'connected'
          : 'stale'
      return {
        id: `${p.id}-${d.source}`,
        patient_id: p.id,
        source_id: d.source,
        status,
        last_sync_at: last ? `${addDays(last, 1)}T06:00:00Z` : null,
        last_data_date: last,
      }
    })
  )
}

export function buildDataset(seed = DEFAULT_SEED): Dataset {
  const profiles = buildCohort(seed)
  const observations = profiles.flatMap((p) => generateObservations(p, seed))
  const resolved = resolve(observations)
  return {
    seed,
    window: { start: DATA_START, end: DATA_END },
    profiles,
    charts: profiles.map((p) => buildChart(p, seed)),
    observations,
    resolved,
    weeklyFlags: computeWeeklyFlags(profiles, resolved),
    connections: buildConnections(profiles, observations),
    bodyScans: profiles.map((p) => bodyScanFor(p, seed)),
    groundTruth: profiles.map((p) => ({
      patient_id: p.id,
      archetype: p.archetype,
      stories: p.stories,
      er_date:
        p.plan.decline?.erDay != null ? dateOfDay(p.plan.decline.erDay) : null,
      decline_onset_date: p.plan.decline
        ? dateOfDay(p.plan.decline.onset)
        : null,
      false_alarm_date:
        p.plan.falseAlarmDay != null ? dateOfDay(p.plan.falseAlarmDay) : null,
    })),
  }
}

let cached: Dataset | null = null

/** Built once, then reused. */
export function getDataset(): Dataset {
  cached ??= buildDataset()
  return cached
}

export { computeSegments } from './weekly'
