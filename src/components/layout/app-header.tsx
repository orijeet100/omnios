import { ThemeSwitch } from '@/components/theme-switch'
import { Header } from './header'

/** Shared sticky page header: sidebar trigger on the left, theme switch on the right. */
export function AppHeader() {
  return (
    <Header fixed>
      <div className='ms-auto flex items-center gap-2'>
        <ThemeSwitch />
      </div>
    </Header>
  )
}
