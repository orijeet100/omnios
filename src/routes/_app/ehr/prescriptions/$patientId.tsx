import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { getApiAdapter } from '@/api'
import {
  createPrescription,
  getTreatmentPlansForConditions,
  getPhotonSandboxUrl,
  type PhotonPrescription,
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
import { RunlogChat } from '@/features/ehr/runlog-chat'

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

  const [plans, setPlans] = useState(() =>
    getTreatmentPlansForConditions(conditions).map((p) => ({
      ...p,
      enabled: true,
      dispense_quantity: 30,
      dispense_unit: 'days',
      days_supply: 30,
    }))
  )
  const [sent, setSent] = useState<{
    prescription: PhotonPrescription
    fromApi: boolean
  } | null>(null)

  const handlePrescribe = async () => {
    setIsSubmitting(true)
    try {
      const selected = plans.filter((p) => p.enabled)
      const result = await createPrescription(
        {
          patient_id: patientId,
          treatment_name: selected.map((p) => p.treatment).join('; '),
          dispense_quantity: selected.length
            ? Math.max(...selected.map((p) => p.dispense_quantity))
            : 30,
          dispense_unit: selected.length ? selected[0].dispense_unit : 'days',
          days_supply: selected.length
            ? Math.max(...selected.map((p) => p.days_supply))
            : 30,
          instructions: selected.map((p) => p.instructions).join(' '),
          diagnoses: conditions,
        },
        chart?.name ?? 'Unknown Patient'
      )
      setSent(result)
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
              <CardTitle>Treatment plan</CardTitle>
              <CardDescription>
                Select and edit a Photon prescription card per condition.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              {plans.length === 0 && (
                <p className='text-sm text-muted-foreground'>
                  No automated treatment plan is suggested for these conditions.
                </p>
              )}
              {plans.map((plan) => (
                <div
                  key={plan.match}
                  className={`rounded-lg border p-4 transition-colors ${
                    plan.enabled
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border bg-muted/20 opacity-70'
                  }`}
                >
                  <label className='flex cursor-pointer items-center gap-2'>
                    <input
                      type='checkbox'
                      checked={plan.enabled}
                      onChange={(e) =>
                        setPlans((prev) =>
                          prev.map((p) =>
                            p.match === plan.match
                              ? { ...p, enabled: e.target.checked }
                              : p
                          )
                        )
                      }
                      className='size-4 accent-foreground'
                    />
                    <span className='text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
                      {plan.match.replace('_', ' ')}
                    </span>
                  </label>

                  <Input
                    value={plan.treatment}
                    disabled={!plan.enabled}
                    onChange={(e) =>
                      setPlans((prev) =>
                        prev.map((p) =>
                          p.match === plan.match
                            ? { ...p, treatment: e.target.value }
                            : p
                        )
                      )
                    }
                    className='mt-3 font-medium'
                  />

                  <Textarea
                    value={plan.instructions}
                    disabled={!plan.enabled}
                    onChange={(e) =>
                      setPlans((prev) =>
                        prev.map((p) =>
                          p.match === plan.match
                            ? { ...p, instructions: e.target.value }
                            : p
                        )
                      )
                    }
                    rows={3}
                    className='mt-3 text-sm'
                  />

                  <div className='mt-3 grid grid-cols-3 gap-3'>
                    <div>
                      <Label>Quantity</Label>
                      <Input
                        type='number'
                        min={1}
                        max={999}
                        value={plan.dispense_quantity}
                        disabled={!plan.enabled}
                        onChange={(e) =>
                          setPlans((prev) =>
                            prev.map((p) =>
                              p.match === plan.match
                                ? {
                                    ...p,
                                    dispense_quantity: Number(e.target.value),
                                  }
                                : p
                            )
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>Unit</Label>
                      <Input
                        value={plan.dispense_unit}
                        disabled={!plan.enabled}
                        onChange={(e) =>
                          setPlans((prev) =>
                            prev.map((p) =>
                              p.match === plan.match
                                ? { ...p, dispense_unit: e.target.value }
                                : p
                            )
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>Days supply</Label>
                      <Input
                        type='number'
                        min={1}
                        max={365}
                        value={plan.days_supply}
                        disabled={!plan.enabled}
                        onChange={(e) =>
                          setPlans((prev) =>
                            prev.map((p) =>
                              p.match === plan.match
                                ? { ...p, days_supply: Number(e.target.value) }
                                : p
                            )
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <RunlogChat patientId={patientId} patientName={chart.name} />
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
            disabled={isSubmitting || !plans.some((p) => p.enabled)}
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

          {sent && (
            <Card className='border-green-200 bg-green-50'>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Pill className='h-4 w-4 text-green-600' />
                  Photon Prescription Confirmed
                </CardTitle>
                <CardDescription>
                  {sent.fromApi
                    ? 'Sent via the Photon (Neutron Health) API'
                    : 'Captured in mock mode — set VITE_PHOTON_AUTH_TOKEN to send via the Photon API'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className='space-y-1 text-sm'>
                  <div className='flex justify-between'>
                    <dt className='text-muted-foreground'>Rx ID</dt>
                    <dd className='font-mono'>{sent.prescription.id}</dd>
                  </div>
                  <div className='flex justify-between'>
                    <dt className='text-muted-foreground'>State</dt>
                    <dd>
                      <Badge variant='secondary' className='text-xs'>
                        {sent.prescription.state}
                      </Badge>
                    </dd>
                  </div>
                  <div className='flex justify-between'>
                    <dt className='text-muted-foreground'>For</dt>
                    <dd>{sent.prescription.patient_name}</dd>
                  </div>
                  <div className='flex justify-between'>
                    <dt className='text-muted-foreground'>Diagnosis codes</dt>
                    <dd>{sent.prescription.diagnoses.join(', ')}</dd>
                  </div>
                </dl>
                <div className='mt-3 rounded border bg-background p-3'>
                  <p className='text-sm font-medium'>Prescription</p>
                  <p className='text-sm'>{sent.prescription.treatment_name}</p>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    {sent.prescription.instructions}
                  </p>
                </div>
                <pre className='mt-3 overflow-x-auto rounded bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100'>
                  {`mutation CreatePrescription {
  createPrescription(input: {
    patientId: "${sent.prescription.patient_id}",
    treatmentName: "${sent.prescription.treatment_name}",
    dispenseQuantity: ${sent.prescription.dispense_quantity},
    dispenseUnit: "${sent.prescription.dispense_unit}",
    daysSupply: ${sent.prescription.days_supply},
    diagnoses: [${sent.prescription.diagnoses.map((d) => `"${d}"`).join(', ')}]
  }) {
    id state
  }
}
# POST ${getPhotonSandboxUrl()}
# Rx ID: ${sent.prescription.id} · state: ${sent.prescription.state}`}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
