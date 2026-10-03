import { ArrowDown, ArrowUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Indicator } from './data'

function Status({ status }: { status: Indicator['status'] }) {
  if (status === 'ok') {
    return (
      <>
        <span className='size-2 rounded-full bg-success' aria-hidden />
        <span className='sr-only'>on target</span>
      </>
    )
  }
  const Arrow = status === 'above' ? ArrowUp : ArrowDown
  return (
    <>
      <Arrow className='text-destructive' aria-hidden />
      <span className='sr-only'>{status} target</span>
    </>
  )
}

/**
 * Measurements as small markers: a red arrow when past the target (up or
 * down), a green dot when on target.
 */
export function Indicators({
  items,
  className,
}: {
  items: Indicator[]
  className?: string
}) {
  return (
    <ul className={`flex flex-wrap justify-center gap-1.5 ${className ?? ''}`}>
      {items.map(({ label, status }) => (
        <li key={label}>
          <Badge variant='outline' className='gap-1.5'>
            <Status status={status} />
            {label}
          </Badge>
        </li>
      ))}
    </ul>
  )
}
