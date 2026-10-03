import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { getApiAdapter } from '@/api'
import {
  createPrescription,
  getTreatmentPlansForConditions,
  type PhotonPrescription,
  type TreatmentPlan,
} from '@/integrations/photon'
import { ArrowLeft, CheckCircle2, Loader2, Pill } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { OmniosInsightsCard } from '@/features/ehr/omnios-insights-card'
import { PatientChartCard } from '@/features/ehr/patient-chart-card'

export const Route = createFileRoute('/_app/ehr/prescriptions/$patientId')({
  component: NewPrescription,
})

/** How long the "AI is suggesting" step shows, even when the plan is ready. */
const SUGGESTING_MS = 2000

type PlanDraft = TreatmentPlan & {
  enabled: boolean
  dispense_quantity: number
  dispense_unit: string
  days_supply: number
}

function NewPrescription() {
  const { patientId } = Route.useParams()
  const chart = getApiAdapter().getEhrChart(patientId)
  const [suggesting, setSuggesting] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState<PhotonPrescription | null>(null)
  const [plans, setPlans] = useState<PlanDraft[]>(() =>
    getTreatmentPlansForConditions(chart?.conditions ?? []).map((plan) => ({
      ...plan,
      enabled: true,
      dispense_quantity: 30,
      dispense_unit: 'days',
      days_supply: 30,
    }))
  )

  useEffect(() => {
    const timer = setTimeout(() => setSuggesting(false), SUGGESTING_MS)
    return () => clearTimeout(timer)
  }, [])

  if (!chart) return <div className='p-6'>Patient not found</div>

  const selected = plans.filter((plan) => plan.enabled)

  const updatePlan = (match: string, patch: Partial<PlanDraft>) =>
    setPlans((all) =>
      all.map((plan) => (plan.match === match ? { ...plan, ...patch } : plan))
    )

  const sendPrescription = async () => {
    setIsSending(true)
    try {
      const { prescription } = await createPrescription(
        {
          patient_id: patientId,
          treatment_name: selected.map((p) => p.treatment).join('; '),
          dispense_quantity: Math.max(
            ...selected.map((p) => p.dispense_quantity)
          ),
          dispense_unit: selected[0].dispense_unit,
          days_supply: Math.max(...selected.map((p) => p.days_supply)),
          instructions: selected.map((p) => p.instructions).join(' '),
          diagnoses: chart.conditions,
        },
        chart.name
      )
      setSent(prescription)
    } catch {
      toast.error('Could not send the prescription.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className='mx-auto w-full max-w-[110rem] space-y-6 px-4 py-6 sm:px-6'>
      <div className='space-y-3'>
        <Button asChild variant='ghost' size='sm' className='-ms-3'>
          <Link to='/ehr/patient/$patientId' params={{ patientId }}>
            <ArrowLeft />
            Back
          </Link>
        </Button>
        <h1 className='text-2xl font-bold tracking-tight'>New prescription</h1>
      </div>

      <div className='grid grid-cols-1 items-start gap-4 lg:grid-cols-3'>
        <div className='space-y-4 lg:col-span-2'>
          <OmniosInsightsCard patientId={patientId} />

          <Card>
            <CardHeader>
              <CardTitle>Suggested prescription</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              {suggesting ? (
                <p
                  role='status'
                  className='flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground'
                >
                  <Loader2 className='size-4 animate-spin' aria-hidden />
                  AI is suggesting a prescription…
                </p>
              ) : plans.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  No prescription is suggested for these conditions.
                </p>
              ) : (
                plans.map((plan) => (
                  <div
                    key={plan.match}
                    className={`rounded-lg border p-4 transition-colors ${
                      plan.enabled ? 'bg-card' : 'bg-muted/20 opacity-70'
                    }`}
                  >
                    <label className='flex cursor-pointer items-center gap-2'>
                      <input
                        type='checkbox'
                        checked={plan.enabled}
                        onChange={(e) =>
                          updatePlan(plan.match, { enabled: e.target.checked })
                        }
                        className='size-4 accent-primary'
                      />
                      <span className='text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
                        {plan.match.replace('_', ' ')}
                      </span>
                    </label>
                    <Input
                      value={plan.treatment}
                      disabled={!plan.enabled}
                      onChange={(e) =>
                        updatePlan(plan.match, { treatment: e.target.value })
                      }
                      className='mt-3 font-medium'
                    />
                    <Textarea
                      value={plan.instructions}
                      disabled={!plan.enabled}
                      onChange={(e) =>
                        updatePlan(plan.match, { instructions: e.target.value })
                      }
                      rows={3}
                      className='mt-3 text-sm'
                    />
                    <div className='mt-3 grid grid-cols-3 gap-3'>
                      <div className='space-y-1.5'>
                        <Label>Quantity</Label>
                        <Input
                          type='number'
                          min={1}
                          max={999}
                          value={plan.dispense_quantity}
                          disabled={!plan.enabled}
                          onChange={(e) =>
                            updatePlan(plan.match, {
                              dispense_quantity: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className='space-y-1.5'>
                        <Label>Unit</Label>
                        <Input
                          value={plan.dispense_unit}
                          disabled={!plan.enabled}
                          onChange={(e) =>
                            updatePlan(plan.match, {
                              dispense_unit: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className='space-y-1.5'>
                        <Label>Days supply</Label>
                        <Input
                          type='number'
                          min={1}
                          max={365}
                          value={plan.days_supply}
                          disabled={!plan.enabled}
                          onChange={(e) =>
                            updatePlan(plan.match, {
                              days_supply: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}

              {!suggesting && !sent && (
                <Button
                  className='w-full'
                  size='lg'
                  disabled={isSending || selected.length === 0}
                  onClick={sendPrescription}
                >
                  <Pill />
                  {isSending ? 'Sending…' : 'Send prescription'}
                </Button>
              )}
            </CardContent>
          </Card>

          {sent && (
            <Card className='border-success/40 bg-success/10'>
              <CardContent className='flex items-center gap-3'>
                <CheckCircle2
                  className='size-6 shrink-0 text-success'
                  aria-hidden
                />
                <div>
                  <p className='font-medium'>Photon prescription confirmed</p>
                  <p className='text-sm text-muted-foreground'>
                    RX state: {sent.state.replace(/_/g, ' ')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <PatientChartCard chart={chart} />
      </div>
    </div>
  )
}
