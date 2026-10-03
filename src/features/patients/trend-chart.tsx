import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatValue, type MetricSeries } from './data'

type Row = {
  date: string
  value: number | null
  abnormal: boolean
  [run: string]: number | string | boolean | null
}

const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 12 }

const shortDate = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })

function ChartTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean
  payload?: { payload?: Row }[]
  unit: string
}) {
  const row = payload?.[0]?.payload
  if (!active || !row || row.value == null) return null
  return (
    <div className='rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md'>
      <div className='text-muted-foreground'>{shortDate(row.date)}</div>
      <div
        className={cn(
          'font-medium tabular-nums',
          row.abnormal && 'text-destructive'
        )}
      >
        {formatValue(row.value, unit)}
      </div>
    </div>
  )
}

/**
 * Daily values over the whole window. The line is drawn once in the theme
 * color, then each abnormal stretch is drawn again on top in red.
 */
export function TrendChart({ series }: { series: MetricSeries }) {
  const rows: Row[] = series.points.map((point, day) => {
    const row: Row = {
      date: point.date,
      value: point.value,
      abnormal: point.abnormal,
    }
    series.runs.forEach(([start, end], run) => {
      row[`run${run}`] = day >= start && day <= end ? point.value : null
    })
    return row
  })

  const values = series.points.flatMap((p) => p.value ?? [])
  const bounds = [
    ...values,
    ...(series.reference ? [series.reference.value] : []),
  ]
  const low = Math.min(...bounds)
  const high = Math.max(...bounds)
  const pad = (high - low) * 0.1 || 1

  return (
    <ResponsiveContainer width='100%' height={190}>
      <LineChart data={rows} margin={{ top: 8, right: 64, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke='var(--border)' />
        <XAxis
          dataKey='date'
          tickFormatter={shortDate}
          interval='equidistantPreserveStart'
          minTickGap={36}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          width={40}
          domain={[Math.floor(low - pad), Math.ceil(high + pad)]}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ stroke: 'var(--border)' }}
          content={<ChartTooltip unit={series.unit} />}
        />
        {series.reference && (
          <ReferenceLine
            y={series.reference.value}
            stroke='var(--muted-foreground)'
            strokeDasharray='4 4'
            label={{
              value: series.reference.label,
              position: 'right',
              fill: 'var(--muted-foreground)',
              fontSize: 11,
            }}
          />
        )}
        <Line
          dataKey='value'
          stroke='var(--primary)'
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls
          animationDuration={500}
        />
        {series.runs.map(([start], run) => (
          <Line
            key={start}
            dataKey={`run${run}`}
            stroke='var(--destructive)'
            strokeWidth={2.5}
            dot={false}
            activeDot={false}
            connectNulls
            animationDuration={500}
            legendType='none'
            tooltipType='none'
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
