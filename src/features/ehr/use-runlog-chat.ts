import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createPatientProject,
  findPatientProject,
  ingestPatientContext,
  isAbort,
  isRunlogConfigured,
  openAgentRun,
  sendAgentMessage,
  streamAgentRun,
  type RunlogProject,
} from '@/integrations/runlog'
import { buildPatientChatContext } from './patient-context'

/**
 * The clinician AI chat for one patient's Runlog project.
 *
 * On mount the patient's project is resolved, and created only when it is
 * missing. The chat opens as soon as the project resolves: the context write
 * is dispatched in the background and reported separately, because reading it
 * into the project takes longer than the clinician waits.
 *
 * The agent run and its stream are opened on the first question and kept for
 * the thread, so follow-ups land in the same conversation.
 */

export type ChatStatus = 'disabled' | 'preparing' | 'ready' | 'error'

/** What the mount effect drives. `disabled` is derived from the environment. */
type RunStatus = Exclude<ChatStatus, 'disabled'>

export interface ChatMessage {
  id: string
  role: 'clinician' | 'assistant'
  text: string
  /** Set on the empty assistant row shown while the first token is on its way. */
  pending?: boolean
}

export interface RunlogChat {
  status: ChatStatus
  /** True until the context write has been dispatched. Never blocks input. */
  contextPending: boolean
  /** True while a question is in flight. */
  busy: boolean
  messages: ChatMessage[]
  send: (text: string) => void
  error: string | null
}

export function useRunlogChat(patientId: string, title: string): RunlogChat {
  const configured = isRunlogConfigured()

  const [openPatient, setOpenPatient] = useState(patientId)
  const [runStatus, setRunStatus] = useState<RunStatus>('preparing')
  const [contextPending, setContextPending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState<string | null>(null)

  const projectRef = useRef<RunlogProject | null>(null)
  const runRef = useRef<string | null>(null)
  const streamAbortRef = useRef<AbortController | null>(null)
  /** Message ids already shown, so a replayed turn is not appended twice. */
  const seenRef = useRef(new Set<string>())
  /** The empty assistant row shown while the first token is on its way. */
  const placeholderRef = useRef<string | null>(null)

  const teardownStream = useCallback(() => {
    streamAbortRef.current?.abort()
    streamAbortRef.current = null
    runRef.current = null
  }, [])

  // Opening a different patient resets the thread. Adjusting state during
  // render is React's pattern for a prop change; doing it in the effect body
  // would cascade an extra render on every mount.
  if (openPatient !== patientId) {
    setOpenPatient(patientId)
    setRunStatus('preparing')
    setContextPending(false)
    setBusy(false)
    setMessages([])
    setError(null)
  }

  useEffect(() => {
    if (!configured) return

    let cancelled = false
    teardownStream()
    seenRef.current = new Set()
    placeholderRef.current = null

    async function prepare() {
      let project = await findPatientProject(patientId)
      if (!project) project = await createPatientProject(patientId)
      if (cancelled) return

      projectRef.current = project
      setRunStatus('ready')

      // Dispatched, not awaited: the clinician can ask while Runlog reads the
      // context, and a slow corpus must not look like a broken chat.
      setContextPending(true)
      try {
        await ingestPatientContext(
          project.projectId,
          buildPatientChatContext(patientId),
          patientId
        )
      } catch {
        // The chat still works; answers just may not find the context yet.
      } finally {
        if (!cancelled) setContextPending(false)
      }
    }

    prepare().catch((cause: unknown) => {
      if (cancelled) return
      setError(cause instanceof Error ? cause.message : 'Runlog is unavailable')
      setRunStatus('error')
    })

    return () => {
      cancelled = true
      teardownStream()
    }
  }, [patientId, configured, teardownStream])

  const handleDelta = useCallback((partId: string, delta: string) => {
    const messageId = partId.split(':')[0] ?? partId
    const isNew = !seenRef.current.has(messageId)
    if (isNew) seenRef.current.add(messageId)

    setMessages((prev) => {
      const placeholder = placeholderRef.current
      placeholderRef.current = null
      const withoutPlaceholder = placeholder
        ? prev.filter((m) => m.id !== placeholder)
        : prev

      if (isNew) {
        return [
          ...withoutPlaceholder,
          { id: messageId, role: 'assistant', text: delta },
        ]
      }
      return withoutPlaceholder.map((m) =>
        m.id === messageId ? { ...m, text: m.text + delta } : m
      )
    })
  }, [])

  const handleFinish = useCallback(() => {
    setBusy(false)
    setMessages((prev) => {
      const placeholder = placeholderRef.current
      if (!placeholder) return prev
      // The turn ended before any token arrived, so the row has nothing in it.
      placeholderRef.current = null
      return prev.filter((m) => m.id !== placeholder)
    })
  }, [])

  const ensureStream = useCallback(
    (projectId: string, runId: string) => {
      if (streamAbortRef.current) return
      const controller = new AbortController()
      streamAbortRef.current = controller

      streamAgentRun(
        runId,
        projectId,
        {
          onDelta: handleDelta,
          onFinish: handleFinish,
          onError: (message) => {
            setError(message)
            setBusy(false)
          },
        },
        controller.signal
      )
        .catch((cause: unknown) => {
          if (isAbort(cause)) return
          setError(
            cause instanceof Error ? cause.message : 'The answer stream ended'
          )
        })
        .finally(() => {
          if (streamAbortRef.current === controller) {
            streamAbortRef.current = null
          }
        })
    },
    [handleDelta, handleFinish]
  )

  const send = useCallback(
    (text: string) => {
      const project = projectRef.current
      const trimmed = text.trim()
      if (!project || !trimmed || busy) return

      setError(null)
      setBusy(true)

      const placeholder = `pending-${Date.now()}`
      placeholderRef.current = placeholder
      setMessages((prev) => [
        ...prev,
        { id: `clinician-${Date.now()}`, role: 'clinician', text: trimmed },
        { id: placeholder, role: 'assistant', text: '', pending: true },
      ])

      const ask = async () => {
        let runId = runRef.current
        if (!runId) {
          runId = await openAgentRun(project.projectId, title)
          runRef.current = runId
        }
        // The stream opens before the question and stays open. It replays any
        // turn that already finished, so nothing is missed either way.
        ensureStream(project.projectId, runId)
        await sendAgentMessage(runId, project.projectId, trimmed)
      }

      ask().catch((cause: unknown) => {
        setError(
          cause instanceof Error ? cause.message : 'Runlog is unavailable'
        )
        handleFinish()
      })
    },
    [busy, ensureStream, handleFinish, title]
  )

  const status: ChatStatus = configured ? runStatus : 'disabled'

  return { status, contextPending, busy, messages, send, error }
}
