import { Outlet } from '@tanstack/react-router'
import { HeartPulse } from 'lucide-react'
import { RoleToggle } from '@/components/role-toggle'
import { ThemeSwitch } from '@/components/theme-switch'
import { Separator } from '@/components/ui/separator'
import { SkipToMain } from '@/components/skip-to-main'
import { RoleProvider } from '@/context/role-provider'

export function AppLayout() {
  return (
    <RoleProvider>
      <div className='flex min-h-svh flex-col bg-sidebar'>
        <SkipToMain />
        <header className='sticky top-0 z-50 h-16 w-full border-b bg-background'>
          <div className='flex h-full items-center gap-4 px-4 sm:px-6'>
            <div className='flex items-center gap-2'>
              <div className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground'>
                <HeartPulse className='size-5' />
              </div>
              <div className='grid leading-tight'>
                <span className='text-sm font-semibold'>OmniOS</span>
                <span className='text-xs text-muted-foreground'>Care team</span>
              </div>
            </div>
            <Separator orientation='vertical' className='h-6' />
            <div className='ms-auto flex items-center gap-2'>
              <RoleToggle />
              <ThemeSwitch />
            </div>
          </div>
        </header>
        <div className='flex-1 bg-background'>
          <Outlet />
        </div>
      </div>
    </RoleProvider>
  )
}
