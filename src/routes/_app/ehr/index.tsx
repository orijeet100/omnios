import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { getApiAdapter } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { outOfRangeLabels, sexLabel } from '@/features/patients/data'
import { PatientAvatar } from '@/features/patients/patient-avatar'

export const Route = createFileRoute('/_app/ehr/')({
  component: EhrInbox,
})

const capitalize = (word: string) =>
  word.charAt(0).toUpperCase() + word.slice(1)

function EhrInbox() {
  const navigate = useNavigate()
  const adapter = getApiAdapter()
  const notifications = adapter.listNotifications()
  const unread = notifications.filter((n) => n.status === 'unread').length

  return (
    <div className='mx-auto w-full max-w-[110rem] space-y-6 px-4 py-6 sm:px-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold tracking-tight'>Inbox</h1>
        <Badge variant='outline'>{unread} new</Badge>
      </div>

      <Card className='py-0'>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='ps-6'>Patient</TableHead>
                <TableHead>Parameters outside normal range</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className='pe-6 text-end'>
                  <span className='sr-only'>Open</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className='py-12 text-center text-muted-foreground'
                  >
                    No patients sent yet.
                  </TableCell>
                </TableRow>
              ) : (
                notifications.map((n) => {
                  const chart = adapter.getEhrChart(n.patient_id)
                  const open = () =>
                    navigate({ to: `/ehr/prescriptions/${n.patient_id}` })
                  return (
                    <TableRow
                      key={n.id}
                      className='cursor-pointer'
                      onClick={open}
                    >
                      <TableCell className='ps-6'>
                        <div className='flex items-center gap-3'>
                          {chart && (
                            <PatientAvatar
                              id={chart.patient_id}
                              sex={chart.sex}
                              className='size-10'
                            />
                          )}
                          <div>
                            <div className='font-semibold'>
                              {chart?.name ?? n.patient_id}
                            </div>
                            {chart && (
                              <div className='text-xs text-muted-foreground'>
                                {chart.age} · {sexLabel(chart.sex)}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {outOfRangeLabels(n.patient_id).join(', ') || '–'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            n.status === 'unread' ? 'default' : 'outline'
                          }
                        >
                          {capitalize(n.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className='pe-6 text-end'>
                        <Button variant='outline' size='sm' onClick={open}>
                          Open
                        </Button>
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
