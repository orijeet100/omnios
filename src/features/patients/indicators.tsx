import { ArrowDown, ArrowRight, ArrowUp, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { Indicator } from './data'

const ARROWS: Record<
  Indicator['status'],
  { Icon: LucideIcon; color: string; text: string }
> = {
  above: { Icon: ArrowUp, color: 'text-destructive', text: 'above normal' },
  below: { Icon: ArrowDown, color: 'text-destructive', text: 'below normal' },
  ok: { Icon: ArrowRight, color: 'text-success', text: 'normal' },
}

/** Measurements as small arrows: red when out of the normal range, green when normal. */
export function Indicators({
  items,
  className,
}: {
  items: Indicator[]
  className?: string
}) {
  return (
    <ul className={cn('flex flex-wrap justify-center gap-1.5', className)}>
      {items.map(({ label, status }) => {
        const { Icon, color, text } = ARROWS[status]
        return (
          <li key={label}>
            <Badge variant='outline' className='gap-1'>
              <Icon className={color} aria-hidden />
              {label}
              <span className='sr-only'>{text}</span>
            </Badge>
          </li>
        )
      })}
    </ul>
  )
}
