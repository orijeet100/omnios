import { useNavigate } from '@tanstack/react-router'
import { getApiAdapter } from '@/api'
import { Bell } from 'lucide-react'
import { useNotifications } from '@/hooks/use-notifications'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const formatSent = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

/** Physician view: every patient the care practitioner has sent over. */
export function NotificationBell() {
  const navigate = useNavigate()
  const adapter = getApiAdapter()
  const notifications = useNotifications()
  const unread = notifications.filter((n) => n.status === 'unread').length

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='icon' className='relative rounded-full'>
          <Bell className='size-[1.2rem]' aria-hidden />
          {unread > 0 && (
            <span className='absolute -end-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[0.625rem] leading-none font-medium text-primary-foreground tabular-nums'>
              {unread}
            </span>
          )}
          <span className='sr-only'>Notifications ({unread} new)</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-72'>
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className='px-2 py-6 text-center text-sm text-muted-foreground'>
            No patients sent yet.
          </p>
        ) : (
          notifications.map((n) => {
            const chart = adapter.getEhrChart(n.patient_id)
            return (
              <DropdownMenuItem
                key={n.id}
                onClick={() =>
                  navigate({ to: `/ehr/prescriptions/${n.patient_id}` })
                }
              >
                <span className='min-w-0 flex-1'>
                  <span className='block truncate font-medium'>
                    {chart?.name ?? n.patient_id}
                  </span>
                  <span className='block text-xs text-muted-foreground'>
                    {chart && `${chart.age} · ${chart.sex} · `}
                    {formatSent(n.created_at)}
                  </span>
                </span>
                {n.status === 'unread' && (
                  <span
                    role='img'
                    aria-label='New'
                    className='size-2 shrink-0 rounded-full bg-primary'
                  />
                )}
              </DropdownMenuItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
