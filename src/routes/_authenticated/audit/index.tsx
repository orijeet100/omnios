import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { getApiAdapter } from '@/api'
import { ArrowLeft, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_authenticated/audit/')({
  component: AuditPage,
})

const ACTION_COLORS: Record<string, string> = {
  viewed_patient: 'bg-blue-100 text-blue-800',
  routed: 'bg-purple-100 text-purple-800',
  acknowledged: 'bg-yellow-100 text-yellow-800',
  dismissed: 'bg-green-100 text-green-800',
  plan_note_added: 'bg-indigo-100 text-indigo-800',
  re_escalated: 'bg-red-100 text-red-800',
  sync_completed: 'bg-gray-100 text-gray-800',
}

function AuditPage() {
  const { data: events, isLoading } = useQuery({
    queryKey: ['audit'],
    queryFn: () => getApiAdapter().listAudit(),
  })

  if (isLoading || !events) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-8 w-64' />
        <Skeleton className='h-96' />
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-4'>
        <Link to='/population'>
          <ArrowLeft className='h-5 w-5 text-muted-foreground hover:text-foreground' />
        </Link>
        <div>
          <h1 className='text-2xl font-bold'>Audit Log</h1>
          <p className='text-sm text-muted-foreground'>
            {events.length} events recorded
          </p>
        </div>
        <Badge variant='secondary' className='ml-auto text-xs'>
          Synthetic data
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <FileText className='h-4 w-4' />
            <CardTitle>Audit Trail</CardTitle>
          </div>
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
                  <div>
                    <p className='text-sm font-medium'>
                      {event.action.replace(/_/g, ' ')}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {event.detail}
                    </p>
                  </div>
                  <div className='text-right'>
                    <Badge
                      className={
                        ACTION_COLORS[event.action] ??
                        'bg-gray-100 text-gray-800'
                      }
                    >
                      {event.actor_role}
                    </Badge>
                    <p className='mt-1 text-xs text-muted-foreground'>
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
