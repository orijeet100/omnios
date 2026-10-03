import { Outlet, useLocation } from '@tanstack/react-router'
import { Separator } from '@/components/ui/separator'
import { NotificationBell } from '@/components/notification-bell'
import { SkipToMain } from '@/components/skip-to-main'
import { ThemeSwitch } from '@/components/theme-switch'
import { ViewToggle } from '@/components/view-toggle'

export function AppLayout() {
  const physician = useLocation().pathname.startsWith('/ehr')

  return (
    <div className='flex min-h-svh flex-col bg-sidebar'>
      <SkipToMain />
      <header className='sticky top-0 z-50 h-16 w-full border-b bg-background'>
        <div className='flex h-full items-center gap-4 px-4 sm:px-6'>
          <div className='flex items-center gap-2'>
            <img
              src='/logo.png'
              alt=''
              className='size-9 shrink-0 rounded-lg'
            />
            <div className='grid leading-tight'>
              <span className='text-sm font-semibold'>OmniOS</span>
              <span className='text-xs text-muted-foreground'>Care team</span>
            </div>
          </div>
          <Separator orientation='vertical' className='h-6' />
          <div className='ms-auto flex items-center gap-2'>
            <ViewToggle physician={physician} />
            {physician && <NotificationBell />}
            <ThemeSwitch />
          </div>
        </div>
      </header>
      <div className='flex-1 bg-background'>
        <Outlet />
      </div>
    </div>
  )
}
