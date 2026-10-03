import type { BodyScan } from '@/contracts'
import { Indicators } from '../indicators'
import { ratioIndicators } from './targets'

type Stat = { label: string; value: string }

const show = (value: number | undefined, unit: string): string =>
  value == null ? '–' : `${value}${unit === '%' ? '' : ' '}${unit}`

function statsFor(scan: BodyScan): Stat[] {
  const m = scan.measurements
  const g = m?.girths
  const a = m?.advanced
  return [
    { label: 'Weight', value: show(scan.subject.weight_lb, 'lb') },
    { label: 'Height', value: show(scan.subject.height_in, 'in') },
    { label: 'BMI', value: show(m?.bmi, '') },
    { label: 'Body fat', value: show(m?.body_fat_percent, '%') },
    { label: 'Lean muscle', value: show(m?.lean_muscle_mass_lb, 'lb') },
    { label: 'Bone mass', value: show(m?.bone_mineral_content_lb, 'lb') },
    { label: 'Neck', value: show(g?.neck_in, 'in') },
    { label: 'Waist', value: show(g?.waist_in, 'in') },
    { label: 'Lower waist', value: show(g?.lower_waist_in, 'in') },
    { label: 'Hip', value: show(g?.hip_in, 'in') },
    { label: 'Waist-hip', value: show(a?.waist_hip_ratio, '') },
    { label: 'Waist-height', value: show(a?.waist_height_ratio, '') },
  ]
}

/** The scan's numbers, with markers for the two waist ratios. */
export function ScanMetrics({ scan, sex }: { scan: BodyScan; sex: 'F' | 'M' }) {
  const a = scan.measurements?.advanced
  return (
    <div className='space-y-4'>
      <Indicators
        items={ratioIndicators(a?.waist_hip_ratio, a?.waist_height_ratio, sex)}
        className='justify-start'
      />
      <dl className='grid grid-cols-2 gap-x-4 gap-y-3'>
        {statsFor(scan).map(({ label, value }) => (
          <div key={label}>
            <dt className='text-xs text-muted-foreground'>{label}</dt>
            <dd className='text-sm font-medium tabular-nums'>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
