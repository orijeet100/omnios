import { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Activity,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getApiAdapter } from '@/api'
import { METRICS } from '@/contracts'

interface ViolationItem {
  id: string
  label: string
  metric: string
  delta: number
  z_score: number
  trend: 'up' | 'down' | 'flat'
  priority: 'high' | 'medium' | 'low'
}

const METRIC_LABELS: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(METRICS).map(([key, m]) => [key, m.label])
  ),
}

export function ViolationsList({
  patientId,
  maxVisible = 3,
  onSelect,
}: {
  patientId: string
  maxVisible?: number
  onSelect?: (metric: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const patient = getApiAdapter().getPatient(patientId)
  if (!patient) return null

  const ranked = [...patient.deviations].sort(
    (a, b) => Math.abs(b.z_score) - Math.abs(a.z_score)
  )
  const significant = ranked.filter((d) => Math.abs(d.z_score) > 1)
  const source = significant.length > 0 ? significant : ranked

  const violations: ViolationItem[] = source.slice(0, 6).map((d) => ({
    id: d.metric,
    label: METRIC_LABELS[d.metric] ?? d.metric.replace(/_/g, ' '),
    metric: d.metric,
    delta: d.delta_abs,
    z_score: d.z_score,
    trend: d.direction === 'above' ? 'up' : d.direction === 'below' ? 'down' : 'flat',
    priority:
      Math.abs(d.z_score) > 2 ? 'high' : Math.abs(d.z_score) > 1 ? 'medium' : 'low',
  }))

  if (violations.length === 0) {
    return null
  }

  const visible = expanded ? violations : violations.slice(0, maxVisible)
  const hasMore = violations.length > maxVisible

  return (
    <Card className='border border-amber-200 bg-amber-50'>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-sm'>
          <AlertCircle className='h-4 w-4 text-amber-600' />
          Top Violations
          <Badge variant='secondary' className='text-xs'>
            {violations.length} violations
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-2 pt-0'>
        {visible.map((v, index) => {
          const clickable = index < maxVisible
          const Row = clickable ? 'button' : 'div'
          return (
          <Row
            key={v.id}
            type={clickable ? 'button' : undefined}
            onClick={clickable ? () => onSelect?.(v.metric) : undefined}
            className={cn(
              'w-full rounded-lg border p-3 text-left transition-all',
              v.priority === 'high' && 'border-red-200 bg-red-50',
              v.priority === 'medium' && 'border-amber-200 bg-amber-50',
              v.priority === 'low' && 'border-gray-200 bg-gray-50',
              clickable && 'cursor-pointer hover:border-primary/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none'
            )}
          >
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <div
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full',
                    v.priority === 'high' && 'bg-red-100 text-red-600',
                    v.priority === 'medium' && 'bg-amber-100 text-amber-600',
                    v.priority === 'low' && 'bg-gray-100 text-gray-600',
                  )}
                >
                  {v.trend === 'up' ? (
                    <TrendingUp className='h-3 w-3' />
                  ) : v.trend === 'down' ? (
                    <TrendingDown className='h-3 w-3' />
                  ) : (
                    <Activity className='h-3 w-3' />
                  )}
                </div>
                <span className='text-sm font-medium'>{v.label}</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <Badge
                  variant={
                    v.priority === 'high'
                      ? 'destructive'
                      : v.priority === 'medium'
                        ? 'warning'
                        : 'secondary'
                  }
                  className='text-xs'
                >
                  Z: {v.z_score.toFixed(1)}
                </Badge>
                {clickable && (
                  <ChevronRight className='h-3.5 w-3.5 text-muted-foreground' />
                )}
              </div>
            </div>

            {(expanded || !clickable) && (
              <div className='mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground'>
                <div>
                  <span>Delta:{' '}</span>
                  <span
                    className={cn(
                      'font-medium',
                      v.delta >= 0 ? 'text-red-600' : 'text-blue-600'
                    )}
                  >
                    {v.delta >= 0 ? '+' : ''}
                    {v.delta}
                  </span>
                </div>
                <div>
                  <span>Priority: </span>
                  <span className='font-medium capitalize'>{v.priority}</span>
                </div>
              </div>
            )}
          </Row>
          )
        })}

        {hasMore && !expanded && (
          <Button
            variant='ghost'
            size='sm'
            className='w-full text-xs'
            onClick={() => setExpanded(true)}
          >
            <ChevronDown className='h-3 w-3 mr-1' />
            Show {violations.length - maxVisible} more
          </Button>
        )}

        {expanded && violations.length > maxVisible && (
          <Button
            variant='ghost'
            size='sm'
            className='w-full text-xs'
            onClick={() => setExpanded(false)}
          >
            <ChevronUp className='h-3 w-3 mr-1' />
            Show less
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
