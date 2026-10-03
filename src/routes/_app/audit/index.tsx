import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getApiAdapter } from '@/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Shield, Bell, Send, CheckCircle, Trash2, Activity, Clock } from 'lucide-react'

export const Route = createFileRoute('/_app/audit/')({
  component: AuditPage,
})

const ACTION_ICONS: Record<string, React.ReactNode> = {
  viewed_patient: <Activity className='h-4 w-4 text-blue-500' />,
  routed: <Send className='h-4 w-4 text-purple-500' />,
  acknowledged: <CheckCircle className='h-4 w-4 text-yellow-500' />,
  dismissed: <Trash2 className='h-4 w-4 text-green-500' />,
  plan_note_added: <FileText className='h-4 w-4 text-indigo-500' />,
  re_escalated: <Bell className='h-4 w-4 text-red-500' />,
  sync_completed: <Clock className='h-4 w-4 text-gray-500' />,
}

function AuditPage() {
  const { data: events, isLoading } = useQuery({
    queryKey: ['audit'],
    queryFn: () => getApiAdapter().listAudit(),
  })

  if (isLoading || !events) {
    return (
      <div className='space-y-4 p-6'>
        <Skeleton className='h-8 w-64' />
        <Skeleton className='h-96' />
      </div>
    )
  }

  return (
    <div className='p-6 space-y-6'>
      <div className='flex items-center gap-4'>
        <Shield className='h-6 w-6 text-muted-foreground' />
        <div>
          <h1 className='text-2xl font-bold'>Audit Log</h1>
          <p className='text-sm text-muted-foreground'>
            {events.length} events recorded
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className='text-sm text-muted-foreground'>No audit events yet</p>
          ) : (
            <div className='space-y-2'>
              {events.map((event) => (
                <div
                  key={event.event_id}
                  className='flex items-center justify-between rounded-lg border p-3'
                >
                  <div className='flex items-start gap-3'>
                    {ACTION_ICONS[event.action] ?? <Activity className='h-4 w-4' />}
                    <div>
                      <p className='text-sm font-medium'>
                        {event.action.replace(/_/g, ' ')}
                      </p>
                      <p className='text-xs text-muted-foreground'>{event.detail}</p>
                    </div>
                  </div>
                  <div className='text-right'>
                    <Badge variant='outline' className='text-xs capitalize'>
                      {event.actor_role}
                    </Badge>
                    <p className='text-xs text-muted-foreground mt-1'>
                      {new Date(event.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
