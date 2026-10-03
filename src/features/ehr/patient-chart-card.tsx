import { getApiAdapter } from '@/api'
import { CONDITION_LABELS, type PatientChart } from '@/contracts'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { sexLabel } from '@/features/patients/data'
import { PatientAvatar } from '@/features/patients/patient-avatar'

const LAB_LABELS: Record<PatientChart['labs'][number]['name'], string> = {
  a1c: 'A1c',
  egfr: 'eGFR',
  potassium: 'Potassium',
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString()

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className='space-y-2'>
      <h3 className='text-sm font-medium text-muted-foreground'>{title}</h3>
      {children}
    </section>
  )
}

/** The patient's EHR record: who they are, what they take, and how they were last seen. */
export function PatientChartCard({ chart }: { chart: PatientChart }) {
  const devices = getApiAdapter().getPatientConnections(chart.patient_id)

  return (
    <Card>
      <CardHeader className='flex-row items-center gap-4'>
        <PatientAvatar
          id={chart.patient_id}
          sex={chart.sex}
          className='size-16'
        />
        <div>
          <CardTitle className='text-lg'>{chart.name}</CardTitle>
          <p className='text-sm text-muted-foreground'>
            {chart.age} · {sexLabel(chart.sex)} · MRN {chart.patient_id}
          </p>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <Section title='Conditions'>
          <div className='flex flex-wrap gap-1.5'>
            {chart.conditions.map((condition) => (
              <Badge key={condition} variant='secondary'>
                {CONDITION_LABELS[condition]}
              </Badge>
            ))}
          </div>
        </Section>
        <Separator />
        <Section title='Current medication'>
          <ul className='space-y-1 text-sm'>
            {chart.medications.map((medication) => (
              <li key={medication.label} className='flex justify-between gap-2'>
                <span>{medication.label}</span>
                <span className='text-muted-foreground'>
                  since {formatDate(medication.started)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
        <Separator />
        <Section title='Labs'>
          <ul className='space-y-1 text-sm'>
            {chart.labs.map((lab) => (
              <li key={lab.name} className='flex justify-between gap-2'>
                <span>{LAB_LABELS[lab.name]}</span>
                <span className='font-medium tabular-nums'>
                  {lab.value} {lab.unit}
                </span>
              </li>
            ))}
          </ul>
        </Section>
        <Separator />
        <Section title='Clinical visits'>
          <ul className='space-y-1 text-sm'>
            {chart.encounters.map((visit) => (
              <li key={visit.id} className='flex justify-between gap-2'>
                <span className='capitalize'>
                  {visit.type} · {visit.reason}
                </span>
                <span className='text-muted-foreground'>
                  {formatDate(visit.date)}
                </span>
              </li>
            ))}
          </ul>
          {chart.clinic_vitals && (
            <p className='text-sm text-muted-foreground'>
              Last clinic visit: BP {chart.clinic_vitals.bp_systolic}/
              {chart.clinic_vitals.bp_diastolic} mmHg ·{' '}
              {chart.clinic_vitals.weight_kg} kg
            </p>
          )}
        </Section>
        <Separator />
        <Section title='Connected devices'>
          <ul className='space-y-1 text-sm'>
            {devices.map((device) => (
              <li key={device.id} className='flex justify-between gap-2'>
                <span className='capitalize'>
                  {device.source_id.replace(/_/g, ' ')}
                </span>
                <Badge
                  variant={
                    device.status === 'connected' ? 'default' : 'secondary'
                  }
                >
                  {device.status}
                </Badge>
              </li>
            ))}
          </ul>
        </Section>
      </CardContent>
    </Card>
  )
}
