/**
 * Runlog client: the AI that suggests a prescription on the Physician screen.
 *
 * One Runlog project per patient id. The project is the memory boundary, so a
 * question about one patient can never retrieve another patient's data. We
 * list projects, create the patient's when it is missing, and ask an agent run
 * bound to that project.
 */

const RUNLOG_API_URL = (import.meta.env.VITE_RUNLOG_API_URL ?? '').replace(
  /\/$/,
  ''
)
const RUNLOG_API_KEY = import.meta.env.VITE_RUNLOG_API_KEY ?? ''

/** Prefix that maps a patient id to its project name. */
const PROJECT_NAME_PREFIX = 'omnios-patient-'

/** Project list page size. The API caps a page at 200. */
const PROJECT_PAGE_SIZE = 200

/** Paths, relative to the base URL. */
const PATHS = {
  projects: '/v1/projects',
  agentRuns: '/v1/api/agent-runs',
} as const

export function isRunlogConfigured(): boolean {
  return RUNLOG_API_URL.length > 0 && RUNLOG_API_KEY.length > 0
}

export function patientProjectName(patientId: string): string {
  return `${PROJECT_NAME_PREFIX}${patientId}`
}

export class RunlogError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'RunlogError'
    this.status = status
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export { isAbort }

async function readError(response: Response): Promise<string> {
  const body = await response.text().catch(() => '')
  if (!body) return `Runlog request failed (${response.status})`
  try {
    const parsed: unknown = JSON.parse(body)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'error' in parsed &&
      typeof parsed.error === 'string'
    ) {
      return parsed.error
    }
  } catch {
    return body.slice(0, 200)
  }
  return `Runlog request failed (${response.status})`
}

async function request<T>(
  path: string,
  init: RequestInit,
  projectId?: string
): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${RUNLOG_API_KEY}`)
  headers.set('Content-Type', 'application/json')
  if (projectId) headers.set('X-Project-Id', projectId)

  const response = await fetch(`${RUNLOG_API_URL}${path}`, { ...init, headers })

  if (!response.ok) {
    throw new RunlogError(await readError(response), response.status)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

// --- Projects -----------------------------------------------------------------

export interface RunlogProject {
  projectId: string
  name: string
  updatedAt?: string
}

/** One page of `GET /v1/projects`. The body is a bare array. */
async function listProjectPage(cursor?: string): Promise<{
  projects: RunlogProject[]
  nextCursor: string | null
}> {
  const query = new URLSearchParams({ limit: String(PROJECT_PAGE_SIZE) })
  if (cursor) query.set('cursor', cursor)

  const response = await fetch(
    `${RUNLOG_API_URL}${PATHS.projects}?${query.toString()}`,
    { headers: { Authorization: `Bearer ${RUNLOG_API_KEY}` } }
  )
  if (!response.ok) {
    throw new RunlogError(await readError(response), response.status)
  }

  const body: unknown = await response.json()
  if (!Array.isArray(body)) {
    throw new RunlogError('Runlog returned an unexpected project list', 502)
  }

  return {
    projects: body as RunlogProject[],
    // Absent when the cursor header is not exposed to the browser, which ends
    // the walk at the first page. Fine for a cohort of demo patients.
    nextCursor: response.headers.get('x-next-cursor'),
  }
}

export async function findPatientProject(
  patientId: string
): Promise<RunlogProject | null> {
  const wanted = patientProjectName(patientId)
  let cursor: string | undefined

  do {
    const page = await listProjectPage(cursor)
    const match = page.projects.find((p) => p.name === wanted)
    if (match) return match
    cursor = page.nextCursor ?? undefined
  } while (cursor)

  return null
}

export async function createPatientProject(
  patientId: string
): Promise<RunlogProject> {
  return request<RunlogProject>(PATHS.projects, {
    method: 'POST',
    body: JSON.stringify({ name: patientProjectName(patientId) }),
  })
}

// --- Agent runs ---------------------------------------------------------------

/** The run's id comes back as `id`; `runId` is accepted in case the API returns that. */
interface AgentRunResponse {
  id?: string
  runId?: string
}

export async function openAgentRun(
  projectId: string,
  title: string
): Promise<string> {
  const run = await request<AgentRunResponse>(
    PATHS.agentRuns,
    {
      method: 'POST',
      body: JSON.stringify({ projectId, title }),
    },
    projectId
  )
  const runId = run.id ?? run.runId
  if (!runId) throw new RunlogError('Runlog returned no run id', 502)
  return runId
}

/** Appends the question. Returns as soon as the message lands. */
export async function sendAgentMessage(
  runId: string,
  projectId: string,
  text: string
): Promise<void> {
  await request(
    `${PATHS.agentRuns}/${runId}/messages`,
    { method: 'POST', body: JSON.stringify({ text }) },
    projectId
  )
}

/**
 * Mint a ticket so the stream can be opened without the key in the URL. The
 * ticket opens one stream, within two minutes.
 */
async function mintStreamTicket(
  runId: string,
  projectId: string
): Promise<string> {
  const { ticket } = await request<{ ticket: string }>(
    `${PATHS.agentRuns}/${runId}/stream-ticket`,
    { method: 'POST', body: JSON.stringify({}) },
    projectId
  )
  return ticket
}

export interface AgentStreamHandlers {
  /** `id` is `messageId:partIdx`, so a part places itself whatever the order. */
  onDelta: (id: string, delta: string) => void
  onFinish: () => void
  onError: (message: string) => void
}

interface StreamFrame {
  type?: string
  id?: string
  delta?: string
  errorText?: string
}

function parseFrame(payload: string): StreamFrame | null {
  try {
    const parsed: unknown = JSON.parse(payload)
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed as StreamFrame
  } catch {
    return null
  }
}

/**
 * Read the run's answer as it forms, over server-sent events.
 *
 * The stream lives as long as the run and replays finished turns on reconnect,
 * so one connection serves the whole thread: a `text-delta` whose id belongs to
 * a message we have not seen starts a new answer, and `finish` closes it.
 * Resolves when the connection ends.
 */
export async function streamAgentRun(
  runId: string,
  projectId: string,
  handlers: AgentStreamHandlers,
  signal: AbortSignal
): Promise<void> {
  const ticket = await mintStreamTicket(runId, projectId)

  const response = await fetch(
    `${RUNLOG_API_URL}${PATHS.agentRuns}/${runId}/stream?ticket=${encodeURIComponent(ticket)}`,
    { headers: { Accept: 'text/event-stream' }, signal }
  )
  if (!response.ok || !response.body) {
    throw new RunlogError(await readError(response), response.status)
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += value.replace(/\r\n/g, '\n')
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''

    for (const raw of frames) {
      for (const line of raw.split('\n')) {
        if (!line.startsWith('data:')) continue
        const event = parseFrame(line.slice('data:'.length).trim())
        if (!event) continue

        if (event.type === 'text-delta' && event.id && event.delta) {
          handlers.onDelta(event.id, event.delta)
        } else if (event.type === 'finish') {
          handlers.onFinish()
        } else if (event.type === 'error') {
          handlers.onError(event.errorText ?? 'Runlog could not answer')
        }
      }
    }
  }
}
