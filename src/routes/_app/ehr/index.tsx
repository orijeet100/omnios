import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { getApiAdapter } from '@/api'
import { useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Clock, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/ehr/')({
  component: () => <RouteComponent />,
})

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-800'
    case 'medium':
      return 'bg-amber-100 text-amber-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

function getPriorityIcon(priority: string) {
  switch (priority) {
    case 'high':
      return <AlertTriangle className='h-4 w-4 text-red-600' />
    case 'medium':
      return <Clock className='h-4 w-4 text-amber-600' />
    default:
      return <Clock className='h-4 w-4 text-gray-600' />
  }
}

function RouteComponent() {
  const navigate = useNavigate()
  const adapter = getApiAdapter()
  const notifications = adapter.listNotifications()

  useEffect(() => {
    const adapter = getApiAdapter()
    adapter.runSync()
  }, [])

  return (
    <div className='p-6 space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>EHR Inbox</h1>
          <p className='text-sm text-muted-foreground'>Notifications from OmniOS platform</p>
        </div>
        <Badge variant='outline' className='gap-1'>
          <AlertTriangle className='h-3 w-3' />
          {notifications.filter((n) => n.status === 'unread').length} new
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Insight</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className='py-12 text-center text-slate-500'>
                    No notifications
                  </TableCell>
                </TableRow>
              ) : (
                notifications.map((n) => {
                  const ehrContext = adapter.getEhrContext(n.patient_id)
                  const chart = ehrContext.chart
                  return (
                    <TableRow
                      key={n.id}
                      className='group cursor-pointer hover:bg-muted/50'
                      onClick={() => navigate({ to: `/ehr/patient/${n.patient_id}` })}
                    >
                      <TableCell>
                        <div className='flex items-center gap-3'>
                          <div className='flex h-10 w-10 items-center justify-center rounded-full bg-slate-200'>
                            <User className='h-5 w-5 text-slate-600' />
                          </div>
                          <div>
                            <div className='font-semibold'>{chart?.name || n.patient_id}</div>
                            <div className='text-sm text-slate-500'>
                              {chart?.age}y · {chart?.sex} · MRN: {n.patient_id}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center gap-2'>
                          {getPriorityIcon(n.priority ?? 'medium')}
                          <Badge className={cn('text-xs', getPriorityColor(n.priority ?? 'low'))}>
                            {n.priority ?? 'medium'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className='max-w-xs'>
                          <div className='line-clamp-2 text-sm'>
                            {n.message || ehrContext.insight?.what_changed || 'Patient trending outside normal parameters'}
                          </div>
                          {ehrContext.insight?.suggestion && (
                            <div className='mt-1 text-xs italic text-slate-500'>
                              {ehrContext.insight.suggestion}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={n.status === 'unread' ? 'default' : 'outline'}
                          className='text-xs'
                        >
                          {n.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
