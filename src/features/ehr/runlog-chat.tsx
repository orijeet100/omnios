import { useEffect, useRef, useState } from 'react'
import { Bot, SendHorizontal, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useRunlogChat, type ChatMessage } from './use-runlog-chat'

/**
 * Clinician-facing AI chat, grounded in the open patient's own Runlog project.
 * It reads and reports; it does not decide, and prescriptions still go through
 * the EHR's own form above.
 */

const STARTER_QUESTIONS = [
  'Why is this patient flagged?',
  'Which measurements changed, and by how much?',
  'How reliable is this data?',
] as const

function MessageRow({ message }: { message: ChatMessage }) {
  if (message.pending) {
    return (
      <div className='flex justify-start'>
        <div className='rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground'>
          Reading this patient&apos;s data...
        </div>
      </div>
    )
  }

  const isClinician = message.role === 'clinician'

  return (
    <div className={cn('flex', isClinician ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
          isClinician ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {message.text}
      </div>
    </div>
  )
}

export function RunlogChat({
  patientId,
  patientName,
}: {
  patientId: string
  patientName: string
}) {
  const { status, contextPending, busy, messages, send, error } = useRunlogChat(
    patientId,
    `Patient ${patientName} context`
  )
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages])

  const submit = () => {
    if (!draft.trim() || busy) return
    send(draft)
    setDraft('')
  }

  const canAsk = status === 'ready' && !busy

  return (
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between gap-2'>
          <CardTitle className='flex items-center gap-2 text-sm font-medium'>
            <Bot className='h-4 w-4' />
            Ask about this patient
          </CardTitle>
          <Badge variant='outline' className='gap-1 text-xs'>
            Runlog AI
          </Badge>
        </div>
        <CardDescription className='text-xs'>
          Synthetic demo data. Answers are generated, not clinical advice.
        </CardDescription>
      </CardHeader>

      <CardContent className='space-y-3'>
        {status === 'disabled' ? (
          <p className='text-sm text-muted-foreground'>
            Set VITE_RUNLOG_API_KEY and VITE_RUNLOG_API_URL to enable this chat.
          </p>
        ) : status === 'error' ? (
          <div className='flex items-start gap-2 text-sm text-destructive'>
            <TriangleAlert className='mt-0.5 h-4 w-4 shrink-0' />
            <span>{error ?? 'The chat could not start.'}</span>
          </div>
        ) : (
          <>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge
                variant='outline'
                className={cn(
                  'text-xs capitalize',
                  status === 'preparing' && 'text-muted-foreground'
                )}
              >
                {status === 'preparing' ? 'Opening project' : 'Ready'}
              </Badge>
              {contextPending && (
                <span className='text-xs text-muted-foreground'>
                  Writing patient context
                </span>
              )}
            </div>

            {messages.length === 0 ? (
              <div className='flex flex-wrap gap-2'>
                {STARTER_QUESTIONS.map((question) => (
                  <Button
                    key={question}
                    variant='outline'
                    size='sm'
                    disabled={!canAsk}
                    onClick={() => send(question)}
                  >
                    {question}
                  </Button>
                ))}
              </div>
            ) : (
              <div
                ref={scrollRef}
                className='max-h-80 space-y-3 overflow-y-auto pr-1'
              >
                {messages.map((message) => (
                  <MessageRow key={message.id} message={message} />
                ))}
              </div>
            )}

            {error && (
              <div className='flex items-start gap-2 text-xs text-destructive'>
                <TriangleAlert className='mt-0.5 h-3 w-3 shrink-0' />
                <span>{error}</span>
              </div>
            )}

            <div className='flex items-end gap-2'>
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    submit()
                  }
                }}
                placeholder='Ask about this patient’s data'
                rows={2}
                disabled={!canAsk}
                className='text-sm'
              />
              <Button
                size='icon'
                onClick={submit}
                disabled={!canAsk || !draft.trim()}
                aria-label='Send'
              >
                <SendHorizontal className='h-4 w-4' />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
