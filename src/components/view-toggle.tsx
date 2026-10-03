import { Link } from '@tanstack/react-router'
import { Stethoscope, Users, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const VIEWS: { to: '/' | '/ehr'; label: string; Icon: LucideIcon }[] = [
  { to: '/', label: 'Care Practitioner', Icon: Users },
  { to: '/ehr', label: 'Physician', Icon: Stethoscope },
]

export function ViewToggle({ physician }: { physician: boolean }) {
  return (
    <nav
      aria-label='View'
      className='flex items-center gap-1 rounded-md bg-muted p-1'
    >
      {VIEWS.map(({ to, label, Icon }) => {
        const active = (to === '/ehr') === physician
        return (
          <Link
            key={to}
            to={to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className='size-4' aria-hidden />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
