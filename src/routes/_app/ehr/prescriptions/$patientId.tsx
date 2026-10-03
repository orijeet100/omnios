import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { getApiAdapter } from '@/api'
import {
  createPrescription,
  getTreatmentForConditions,
  getTreatmentInstructions,
} from '@/integrations/photon'
import { Bell, Pill, Activity, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export const Route = createFileRoute('/_app/ehr/prescriptions/$patientId')({
  component: () => <RouteComponent />,
})

function RouteComponent() {
  const { patientId } = Route.useParams()
  const adapter = getApiAdapter()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const chart = adapter.getEhrChart(patientId)
  const insight = adapter.getInsight(patientId)

  const conditions = chart?.conditions ?? []
  const defaultTreatment = getTreatmentForConditions(conditions)
  const defaultInstructions = getTreatmentInstructions(conditions)

  const [treatmentName, setTreatmentName] = useState(defaultTreatment)
  const [instructions, setInstructions] = useState(defaultInstructions)

  const handlePrescribe = async () => {
    setIsSubmitting(true)
    try {
      const result = await createPrescription(
        {
          patient_id: patientId,
          treatment_name: treatmentName,
          dispense_quantity: 30,
          dispense_unit: 'days',
          days_supply: 30,
          instructions,
          diagnoses: conditions,
        },
        chart?.name ?? 'Unknown Patient'
      )

      if (result.fromApi) {
        alert(
          `Prescription sent to Photon\nRx ID: ${result.prescription.id}\nState: ${result.prescription.state}`
        )
      } else {
        alert(
          `Prescription created (mock mode)\nRx ID: ${result.prescription.id}`
        )
      }
      navigate({ to: '/ehr' })
    } catch {
      alert('Failed to create prescription')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!chart) {
    return <div className='p-6'>Patient not found</div>
  }

  return (
    <div className='space-y-6 p-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold'>New Prescription</h1>
        <Badge variant='outline' className='gap-1'>
          <Pill className='h-3 w-3' />
          Photon RX
        </Badge>
      </div>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
        <div className='space-y-6 lg:col-span-2'>
          {insight && (
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Bell className='h-4 w-4 text-blue-600' />
                  <CardTitle>OmniOS Insight</CardTitle>
                </div>
                <CardDescription>
                  Anomaly detected from integrated data sources
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  <div>
                    <p className='text-sm font-medium text-muted-foreground'>
                      What changed
                    </p>
                    <p className='text-sm text-slate-700'>
                      {insight.what_changed}
                    </p>
                  </div>
                  <div>
                    <p className='text-sm font-medium text-muted-foreground'>
                      Versus baseline
                    </p>
                    <p className='text-sm text-slate-600'>
                      {insight.versus_baseline}
                    </p>
                  </div>
                  <div>
                    <p className='text-sm font-medium text-muted-foreground'>
                      Suggestion
                    </p>
                    <p className='text-sm font-medium text-blue-600'>
                      {insight.suggestion}
                    </p>
                  </div>
                  <div className='flex items-center gap-4 text-xs text-slate-500'>
                    <span>Confidence: {insight.confidence}</span>
                    <span>Window: {insight.window}</span>
                    <span>Sources: {insight.sources}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Treatment</CardTitle>
              <CardDescription>
                Pre-filled based on patient conditions
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div>
                <Label htmlFor='treatment'>Treatment (name + dose)</Label>
                <Input
                  id='treatment'
                  value={treatmentName}
                  onChange={(e) => setTreatmentName(e.target.value)}
                  className='mt-1'
                />
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <Label htmlFor='quantity'>Quantity</Label>
                  <Input
                    id='quantity'
                    type='number'
                    defaultValue={30}
                    min={1}
                    max={999}
                    className='mt-1'
                  />
                </div>
                <div>
                  <Label htmlFor='days-supply'>Days Supply</Label>
                  <Input
                    id='days-supply'
                    type='number'
                    defaultValue={30}
                    min={1}
                    max={365}
                    className='mt-1'
                  />
                </div>
              </div>
              <div>
                <Label htmlFor='instructions'>Instructions</Label>
                <Textarea
                  id='instructions'
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder='One tablet daily, with or without food'
                  rows={4}
                  className='mt-1'
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <User className='h-4 w-4' />
                {chart.name}
              </CardTitle>
              <CardDescription>
                {chart.age}y · {chart.sex} · MRN: {chart.patient_id}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='space-y-3'>
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Conditions
                  </p>
                  <div className='mt-1 flex flex-wrap gap-1'>
                    {chart.conditions.map((c) => (
                      <Badge key={c} variant='secondary' className='text-xs'>
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Current Medications
                  </p>
                  <div className='mt-1 space-y-1'>
                    {chart.medications.map((m) => (
                      <p key={m.label} className='text-sm'>
                        {m.label} (since{' '}
                        {new Date(m.started).toLocaleDateString()})
                      </p>
                    ))}
                  </div>
                </div>
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Recent Labs
                  </p>
                  <div className='mt-1 space-y-1'>
                    {chart.labs.slice(0, 4).map((l) => (
                      <div
                        key={l.name}
                        className='flex justify-between text-sm'
                      >
                        <span>{l.name}</span>
                        <span className='font-medium tabular-nums'>
                          {l.value} {l.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {chart.clinic_vitals && (
                  <div>
                    <p className='text-sm font-medium text-muted-foreground'>
                      Clinic Visit (
                      {new Date(chart.clinic_vitals.date).toLocaleDateString()})
                    </p>
                    <div className='mt-1 text-sm'>
                      <p>
                        BMP: {chart.clinic_vitals.bp_systolic}/
                        {chart.clinic_vitals.bp_diastolic} mmHg
                      </p>
                      <p>Weight: {chart.clinic_vitals.weight_kg} kg</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Activity className='h-4 w-4' />
                Connected Devices
              </CardTitle>
              <CardDescription>Live data from OmniOS</CardDescription>
            </CardHeader>
            <CardContent>
              <div className='space-y-2'>
                {adapter.getPatientConnections(patientId).map((conn) => (
                  <div
                    key={conn.id}
                    className='flex items-center justify-between text-sm'
                  >
                    <span>{conn.source_id.replace(/_/g, ' ')}</span>
                    <Badge
                      variant={
                        conn.status === 'connected' ? 'default' : 'secondary'
                      }
                      className='text-xs'
                    >
                      {conn.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button
            className='w-full'
            size='lg'
            disabled={isSubmitting || !treatmentName || !instructions}
            onClick={handlePrescribe}
          >
            {isSubmitting ? 'Sending...' : 'Send Prescription'}
          </Button>

          <Button
            variant='outline'
            className='w-full'
            onClick={() => navigate({ to: '/ehr' })}
          >
            Back to Inbox
          </Button>
        </div>
      </div>
    </div>
  )
}
