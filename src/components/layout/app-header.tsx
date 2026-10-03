import { Badge } from '@/components/ui/badge'
import { ThemeSwitch } from '@/components/theme-switch'
import { Header } from './header'

/** Shared page header: all demo patients are synthetic, and the UI says so. */
export function AppHeader() {
  return (
    <Header fixed>
      <div className='ms-auto flex items-center gap-2'>
        <Badge variant='outline'>Synthetic data</Badge>
        <ThemeSwitch />
      </div>
    </Header>
  )
}
