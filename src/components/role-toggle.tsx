import { useLocation, useNavigate } from '@tanstack/react-router'
import { Activity, Stethoscope, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type Role, ROLE_LABELS } from '@/context/role-provider'

const ROLE_ICONS: Record<Role, React.ReactNode> = {
  phm: <Activity className='h-4 w-4' />,
  cm: <Users className='h-4 w-4' />,
  physician: <Stethoscope className='h-4 w-4' />,
}

const ROLE_ROUTES: Record<Role, string> = {
  phm: '/',
  cm: '/patients',
  physician: '/ehr',
}

/** The highlighted role follows the current page, not a clicked flag. */
function roleForPath(pathname: string): Role {
  if (pathname.startsWith('/ehr')) return 'physician'
  if (pathname.startsWith('/patients')) return 'cm'
  return 'phm'
}

export function RoleToggle() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const role = roleForPath(pathname)

  const handleRoleChange = (newRole: Role) => {
    navigate({ to: ROLE_ROUTES[newRole] })
  }

  return (
    <div className='flex items-center gap-1 rounded-md bg-muted p-1'>
      {(['phm', 'cm', 'physician'] as Role[]).map((r) => (
        <button
          key={r}
          onClick={() => handleRoleChange(r)}
          className={cn(
            'flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-all',
            role === r
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {ROLE_ICONS[r]}
          {ROLE_LABELS[r].label}
        </button>
      ))}
    </div>
  )
}
