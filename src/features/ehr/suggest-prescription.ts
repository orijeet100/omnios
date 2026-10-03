import { z } from 'zod'
import {
  CONDITION_LABELS,
  METRICS,
  type MetricDeviation,
  type PatientChart,
} from '@/contracts'
import {
  getTreatmentPlansForConditions,
  type TreatmentPlan,
} from '@/integrations/photon'
import {
  createPatientProject,
  findPatientProject,
  isAbort,
  isRunlogConfigured,
  openAgentRun,
  sendAgentMessage,
  streamAgentRun,
} from '@/integrations/runlog'
import { notableChanges, sexLabel } from '@/features/patients/data'

/** How long RunLog gets to answer before the built-in suggestion is used. */
const RUNLOG_TIMEOUT_MS = 60_000

export type Suggestion = {
  plans: TreatmentPlan[]
  /** Where the plans came from, so the screen never passes off one as the other. */
  source: 'runlog' | 'builtin'
}

const suggestedPlansSchema = z.array(
  z.object({
    condition: z.string(),
    treatment: z.string().min(1),
    instructions: z.string(),
  })
)

/** The first JSON array in the reply, even when it is wrapped in prose or a code fence. */
export function parsePlans(reply: string): TreatmentPlan[] {
  const start = reply.indexOf('[')
  const end = reply.lastIndexOf(']')
  if (start < 0 || end < start) return []
  try {
    const parsed = suggestedPlansSchema.safeParse(
      JSON.parse(reply.slice(start, end + 1))
    )
    return parsed.success
      ? parsed.data.map(({ condition, treatment, instructions }) => ({
          match: condition,
          treatment,
          instructions,
        }))
      : []
  } catch {
    return []
  }
}

function buildPrompt(chart: PatientChart, changes: MetricDeviation[]) {
  const medication = chart.medications.map((m) => m.label).join(', ')
  const moved = changes
    .map(
      (c) =>
        `${METRICS[c.metric].label} ${c.baseline_median} to ${c.current} ${c.unit}`
    )
    .join('; ')
  return [
    'A physician is reviewing a patient flagged by OmniOS wearable monitoring (synthetic demo patient). Suggest a prescription for the physician to review and edit.',
    `Patient: ${chart.age}-year-old ${sexLabel(chart.sex)}.`,
    `Conditions: ${chart.conditions.map((c) => `${CONDITION_LABELS[c]} (code ${c})`).join(', ')}.`,
    `Current medication: ${medication || 'none'}.`,
    `Changes from baseline: ${moved || 'none'}.`,
    'Suggest at most one medication per condition code.',
    'Reply with ONLY a JSON array and no other text: [{"condition":"<code>","treatment":"<generic drug name first, then strength and frequency>","instructions":"<one or two plain sentences>"}]',
  ].join('\n')
}

/** Ask RunLog's agent, bound to this patient's own project, and read the streamed reply. */
async function askRunlog(patientId: string, prompt: string): Promise<string> {
  const project =
    (await findPatientProject(patientId)) ??
    (await createPatientProject(patientId))
  const runId = await openAgentRun(project.projectId, 'Prescription suggestion')
  await sendAgentMessage(runId, project.projectId, prompt)

  const parts = new Map<string, string>()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RUNLOG_TIMEOUT_MS)
  try {
    await new Promise<void>((resolve, reject) => {
      streamAgentRun(
        runId,
        project.projectId,
        {
          onDelta: (id, delta) => parts.set(id, (parts.get(id) ?? '') + delta),
          onFinish: () => {
            resolve()
            controller.abort()
          },
          onError: (message) => reject(new Error(message)),
        },
        controller.signal
      ).then(resolve, (error) =>
        reject(isAbort(error) ? new Error('RunLog timed out') : error)
      )
    })
  } finally {
    clearTimeout(timer)
    controller.abort()
  }

  // Ids are `messageId:partIdx`; the parts of one answer read in index order.
  const partIndex = (id: string) => Number(id.slice(id.lastIndexOf(':') + 1))
  return [...parts.entries()]
    .sort(([a], [b]) => partIndex(a) - partIndex(b))
    .map(([, text]) => text)
    .join('')
}

/** RunLog's suggestion, or the built-in one when RunLog is off or fails. */
export async function suggestPrescription(
  chart: PatientChart,
  deviations: MetricDeviation[]
): Promise<Suggestion> {
  if (isRunlogConfigured()) {
    try {
      const prompt = buildPrompt(
        chart,
        notableChanges(chart.patient_id, deviations)
      )
      const plans = parsePlans(await askRunlog(chart.patient_id, prompt))
      if (plans.length > 0) return { plans, source: 'runlog' }
    } catch {
      // Fall through: the physician still gets a suggestion, labelled as built-in.
    }
  }
  return {
    plans: getTreatmentPlansForConditions(chart.conditions),
    source: 'builtin',
  }
}
