import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { getApiAdapter } from '@/api'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell, Pill, Activity, User, CalendarDays } from 'lucide-react'
import {
  getTreatmentForConditions,
  getTreatmentInstructions,
  getPhotonSandboxUrl,
} from '@/integrations/photon'

export const Route = createFileRoute('/_app/ehr/patient/$patientId')({
  component: () => <RouteComponent />,
})

function RouteComponent() {
  const { patientId } = Route.useParams()
  const adapter = getApiAdapter()
  const navigate = useNavigate()

  const chart = adapter.getEhrChart(patientId)
  const insight = adapter.getInsight(patientId)

  if (!chart) {
    return <div className='p-6'>Patient not found</div>
  }

  const suggestedTreatment = getTreatmentForConditions(chart.conditions)
  const suggestedInstructions = getTreatmentInstructions(chart.conditions)

  return (
    <div className='p-6 space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold'>Patient Details</h1>
        <Button
          size='sm'
          onClick={() => navigate({ to: `/ehr/prescriptions/${patientId}` })}
        >
          <Pill className='h-4 w-4' />
          Prescribe
        </Button>
      </div>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
        <div className='lg:col-span-2 space-y-6'>
          {insight && (
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Bell className='h-4 w-4 text-blue-600' />
                  <CardTitle>OmniOS Insight</CardTitle>
                </div>
                <CardDescription>Anomaly detected from integrated data sources</CardDescription>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  <div>
                    <p className='text-sm font-medium text-muted-foreground'>What changed</p>
                    <p className='text-sm text-slate-700'>{insight.what_changed}</p>
                  </div>
                  <div>
                    <p className='text-sm font-medium text-muted-foreground'>Versus baseline</p>
                    <p className='text-sm text-slate-600'>{insight.versus_baseline}</p>
                  </div>
                  <div>
                    <p className='text-sm font-medium text-muted-foreground'>Suggestion</p>
                    <p className='text-sm font-medium text-blue-600'>{insight.suggestion}</p>
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
              <CardTitle className='flex items-center gap-2'>
                <CalendarDays className='h-4 w-4' />
                Encounters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-2'>
                {chart.encounters.length === 0 ? (
                  <p className='text-sm text-slate-500'>No encounters</p>
                ) : (
                  chart.encounters.map((e) => (
                    <div key={e.id} className='flex items-center justify-between text-sm'>
                      <span className='capitalize'>{e.type} · {e.reason}</span>
                      <span className='text-slate-500'>{new Date(e.date).toLocaleDateString()}</span>
                    </div>
                  ))
                )}
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
                  <p className='text-sm font-medium text-muted-foreground'>Conditions</p>
                  <div className='mt-1 flex flex-wrap gap-1'>
                    {chart.conditions.map((c) => (
                      <Badge key={c} variant='secondary' className='text-xs'>
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>Current Medications</p>
                  <div className='mt-1 space-y-1'>
                    {chart.medications.map((m) => (
                      <p key={m.label} className='text-sm'>{m.label} (since {new Date(m.started).toLocaleDateString()})</p>
                    ))}
                  </div>
                </div>
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>Recent Labs</p>
                  <div className='mt-1 space-y-1'>
                    {chart.labs.slice(0, 4).map((l) => (
                      <div key={l.name} className='flex justify-between text-sm'>
                        <span>{l.name}</span>
                        <span className='font-medium tabular-nums'>{l.value} {l.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {chart.clinic_vitals && (
                  <div>
                    <p className='text-sm font-medium text-muted-foreground'>Clinic Visit ({new Date(chart.clinic_vitals.date).toLocaleDateString()})</p>
                    <div className='mt-1 text-sm'>
                      <p>BMP: {chart.clinic_vitals.bp_systolic}/{chart.clinic_vitals.bp_diastolic} mmHg</p>
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
                  <div key={conn.id} className='flex items-center justify-between text-sm'>
                    <span>{conn.source_id.replace(/_/g, ' ')}</span>
                    <Badge variant={conn.status === 'connected' ? 'default' : 'secondary'} className='text-xs'>
                      {conn.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Pill className='h-4 w-4 text-blue-600' />
                Photon Prescription
              </CardTitle>
              <CardDescription>
                Suggested from conditions via the Photon API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className='text-sm font-medium'>{suggestedTreatment}</p>
              <p className='mt-1 text-xs text-muted-foreground'>
                {suggestedInstructions}
              </p>
              <pre className='mt-3 overflow-x-auto rounded bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100'>
{`# No Rx submitted yet — sent via Photon when the clinician taps Prescribe
mutation CreatePrescription {
  createPrescription(input: {
    patientId: "${chart.patient_id}"
    treatmentName: "${suggestedTreatment}"
    diagnoses: [${chart.conditions.map((c) => `"${c}"`).join(', ')}]
  }) { id state }
}
# POST ${getPhotonSandboxUrl()}`}
              </pre>
            </CardContent>
          </Card>

          <Button variant='outline' className='w-full' onClick={() => navigate({ to: '/ehr' })}>
            Back to Inbox
          </Button>
        </div>
      </div>
    </div>
  )
}
