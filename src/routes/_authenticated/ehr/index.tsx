import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { getApiAdapter } from '@/api'
import { Bell, Check, X, FileText, Pill, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'

export const Route = createFileRoute('/_authenticated/ehr/')({
  component: EhrPage,
})

function EhrPage() {
  const [actingId, setActingId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState<Record<string, string>>({})
  const [addingNote, setAddingNote] = useState<string | null>(null)

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getApiAdapter().listNotifications(),
  })

  const handleAcknowledge = (notificationId: string) => {
    setActingId(notificationId)
    getApiAdapter().actOnNotification(
      notificationId,
      'acknowledge',
      'clinician-001'
    )
    toast.success('Notification acknowledged')
    setActingId(null)
  }

  const handleDismiss = (notificationId: string) => {
    setActingId(notificationId)
    getApiAdapter().actOnNotification(
      notificationId,
      'dismiss',
      'clinician-001'
    )
    toast.success('Notification dismissed')
    setActingId(null)
  }

  const handleAddNote = (notificationId: string) => {
    const text = noteText[notificationId]?.trim()
    if (!text) return
    getApiAdapter().actOnNotification(
      notificationId,
      'add_plan_note',
      'clinician-001',
      text
    )
    toast.success('Plan note added')
    setAddingNote(null)
    setNoteText((prev) => ({ ...prev, [notificationId]: '' }))
  }

  if (isLoading || !notifications) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-8 w-64' />
        <Skeleton className='h-96' />
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>EHR Notifications</h1>
          <p className='text-sm text-muted-foreground'>
            {notifications.filter((n) => n.status === 'unread').length} unread
            notifications
          </p>
        </div>
        <Badge variant='secondary' className='text-xs'>
          Synthetic data — EHR mockup
        </Badge>
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className='pt-6 text-center text-muted-foreground'>
            <Bell className='mx-auto mb-2 h-8 w-8 opacity-50' />
            <p>No notifications</p>
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-4'>
          {notifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              acting={actingId === notification.id}
              noteText={noteText[notification.id] ?? ''}
              addingNote={addingNote === notification.id}
              onNoteTextChange={(text) =>
                setNoteText((prev) => ({ ...prev, [notification.id]: text }))
              }
              onAddNote={() => setAddingNote(notification.id)}
              onCancelNote={() => setAddingNote(null)}
              onSubmitNote={() => handleAddNote(notification.id)}
              onAcknowledge={() => handleAcknowledge(notification.id)}
              onDismiss={() => handleDismiss(notification.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function NotificationCard({
  notification,
  acting,
  noteText,
  addingNote,
  onNoteTextChange,
  onAddNote,
  onCancelNote,
  onSubmitNote,
  onAcknowledge,
  onDismiss,
}: {
  notification: any
  acting: boolean
  noteText: string
  addingNote: boolean
  onNoteTextChange: (text: string) => void
  onAddNote: () => void
  onCancelNote: () => void
  onSubmitNote: () => void
  onAcknowledge: () => void
  onDismiss: () => void
}) {
  const { data: context } = useQuery({
    queryKey: ['ehr-context', notification.patient_id],
    queryFn: () => getApiAdapter().getEhrContext(notification.patient_id),
  })

  const { data: insight } = useQuery({
    queryKey: ['insight', notification.patient_id],
    queryFn: () => getApiAdapter().getInsight(notification.patient_id),
  })

  const chart = context?.chart

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Bell className='h-4 w-4' />
            <CardTitle className='text-base'>
              Patient: {chart?.name ?? notification.patient_id}
            </CardTitle>
          </div>
          <Badge
            variant={
              notification.status === 'unread'
                ? 'default'
                : notification.status === 'acknowledged'
                  ? 'secondary'
                  : 'outline'
            }
          >
            {notification.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          {chart && (
            <div className='rounded-lg border p-4'>
              <p className='mb-2 text-sm font-medium'>Patient Context</p>
              <div className='grid gap-2 md:grid-cols-2'>
                <div>
                  <p className='text-xs text-muted-foreground'>Age / Sex</p>
                  <p className='text-sm'>
                    {chart.age}y {chart.sex}
                  </p>
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>Conditions</p>
                  <div className='flex flex-wrap gap-1'>
                    {chart.conditions.map((c: string) => (
                      <Badge key={c} variant='outline' className='text-xs'>
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>Medications</p>
                  {chart.medications.map((m: any, i: number) => (
                    <p key={i} className='text-sm'>
                      {m.label}
                    </p>
                  ))}
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>Recent Labs</p>
                  {chart.labs.map((l: any, i: number) => (
                    <p key={i} className='text-sm'>
                      {l.name}: {l.value} {l.unit}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {insight && (
            <div className='rounded-lg bg-muted p-4'>
              <p className='mb-2 text-sm font-medium'>OmniOS Insight</p>
              <div className='space-y-2 text-sm'>
                <div>
                  <p className='text-xs text-muted-foreground'>What changed</p>
                  <p>{insight.what_changed}</p>
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>Suggestion</p>
                  <p className='font-medium text-blue-600'>
                    {insight.suggestion}
                  </p>
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>Confidence</p>
                  <p>{insight.confidence}</p>
                </div>
              </div>
            </div>
          )}

          {notification.plan_notes.length > 0 && (
            <div className='space-y-2'>
              <p className='text-sm font-medium'>Plan Notes</p>
              {notification.plan_notes.map((note: any) => (
                <div key={note.id} className='rounded-lg border p-3'>
                  <p className='text-sm'>{note.text}</p>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    {note.author} • {new Date(note.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}

          {addingNote && (
            <div className='space-y-2'>
              <Textarea
                value={noteText}
                onChange={(e) => onNoteTextChange(e.target.value)}
                placeholder='Add a plan note...'
                rows={3}
              />
              <div className='flex items-center gap-2'>
                <Button size='sm' onClick={onSubmitNote}>
                  <Plus className='mr-1 h-3 w-3' />
                  Add Note
                </Button>
                <Button size='sm' variant='ghost' onClick={onCancelNote}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <Separator />

          <div className='flex items-center gap-2'>
            <Link
              to='/ehr/prescriptions/$patientId'
              params={{ patientId: notification.patient_id }}
            >
              <Button size='sm' className='mr-2'>
                <Pill className='mr-1 h-3 w-3' />
                Proceed to prescription
              </Button>
            </Link>
            {notification.status === 'unread' && (
              <>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={onAcknowledge}
                  disabled={acting}
                >
                  <Check className='mr-1 h-3 w-3' />
                  Acknowledge
                </Button>
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={onDismiss}
                  disabled={acting}
                >
                  <X className='mr-1 h-3 w-3' />
                  Dismiss
                </Button>
              </>
            )}
            {notification.status !== 'unread' && !addingNote && (
              <Button size='sm' variant='outline' onClick={onAddNote}>
                <FileText className='mr-1 h-3 w-3' />
                Add Plan Note
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
