import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { getApiAdapter } from '@/api'
import type { PatientChart } from '@/contracts'
import {
  sendPrescriptions,
  type PrescriptionResult,
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
import {
  suggestPrescription,
  type Suggestion,
} from '@/features/ehr/suggest-prescription'

export const Route = createFileRoute('/_app/ehr/prescriptions/$patientId')({
  component: PrescriptionPage,
})

/** The "AI is suggesting" step shows at least this long, even when the answer is ready. */
const SUGGESTING_MS = 2000

const SOURCE_LABELS: Record<Suggestion['source'], string> = {
  runlog: 'Suggested by RunLog AI',
  builtin: 'Built-in suggestion (RunLog AI not available)',
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type PlanDraft = TreatmentPlan & {
  enabled: boolean
  dispense_quantity: number
  dispense_unit: string
  days_supply: number
}

function PrescriptionPage() {
  const { patientId } = Route.useParams()
  const chart = getApiAdapter().getEhrChart(patientId)

  if (!chart) return <div className='p-6'>Patient not found</div>
  return <Prescription chart={chart} />
}

function Prescription({ chart }: { chart: PatientChart }) {
  const patientId = chart.patient_id
  const { data: suggestion } = useQuery({
    queryKey: ['rx-suggestion', patientId],
    queryFn: async () => {
      const deviations = getApiAdapter().getDeviations(patientId)
      const [result] = await Promise.all([
        suggestPrescription(chart, deviations),
        wait(SUGGESTING_MS),
      ])
      return result
    },
    // A fresh suggestion, and a fresh 2 seconds, every time the page opens.
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
  })

  return (
    <div className='mx-auto w-full max-w-[110rem] space-y-6 px-4 py-6 sm:px-6'>
      <Button asChild variant='ghost' size='sm' className='-ms-3'>
        <Link to='/ehr'>
          <ArrowLeft />
          Inbox
        </Link>
      </Button>

      <div className='grid grid-cols-1 items-start gap-4 lg:grid-cols-3'>
        <div className='space-y-4 lg:col-span-2'>
          <OmniosInsightsCard patientId={patientId} patientName={chart.name} />
          {suggestion ? (
            <PlanEditor chart={chart} suggestion={suggestion} />
          ) : (
            <Card>
              <CardContent>
                <p
                  role='status'
                  className='flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground'
                >
                  <Loader2 className='size-4 animate-spin' aria-hidden />
                  AI is suggesting a prescription…
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <PatientChartCard chart={chart} />
      </div>
    </div>
  )
}

function PlanEditor({
  chart,
  suggestion,
}: {
  chart: PatientChart
  suggestion: Suggestion
}) {
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState<PrescriptionResult | null>(null)
  const [plans, setPlans] = useState<PlanDraft[]>(() =>
    suggestion.plans.map((plan) => ({
      ...plan,
      enabled: true,
      dispense_quantity: 30,
      dispense_unit: 'Each',
      days_supply: 30,
    }))
  )
  const selected = plans.filter((plan) => plan.enabled)

  const updatePlan = (index: number, patch: Partial<PlanDraft>) =>
    setPlans((all) =>
      all.map((plan, i) => (i === index ? { ...plan, ...patch } : plan))
    )

  const sendPrescription = async () => {
    setIsSending(true)
    try {
      setSent(
        await sendPrescriptions(
          {
            id: chart.patient_id,
            name: chart.name,
            age: chart.age,
            sex: chart.sex,
          },
          selected
        )
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not send the prescription.'
      )
    } finally {
      setIsSending(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Suggested prescription</CardTitle>
          <p className='text-xs text-muted-foreground'>
            {SOURCE_LABELS[suggestion.source]}
          </p>
        </CardHeader>
        <CardContent className='space-y-4'>
          {plans.length === 0 && (
            <p className='text-sm text-muted-foreground'>
              No prescription is suggested for these conditions.
            </p>
          )}
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`rounded-lg border p-4 transition-colors ${
                plan.enabled ? 'bg-card' : 'bg-muted/20 opacity-70'
              }`}
            >
              <label className='flex cursor-pointer items-center gap-2'>
                <input
                  type='checkbox'
                  checked={plan.enabled}
                  onChange={(e) =>
                    updatePlan(index, { enabled: e.target.checked })
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
                  updatePlan(index, { treatment: e.target.value })
                }
                className='mt-3 font-medium'
              />
              <Textarea
                value={plan.instructions}
                disabled={!plan.enabled}
                onChange={(e) =>
                  updatePlan(index, { instructions: e.target.value })
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
                      updatePlan(index, {
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
                      updatePlan(index, { dispense_unit: e.target.value })
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
                      updatePlan(index, {
                        days_supply: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            </div>
          ))}

          {!sent && (
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
              <p className='font-medium'>
                {sent.live
                  ? 'Photon prescription confirmed'
                  : 'Prescription simulated'}
              </p>
              <p className='text-sm text-muted-foreground'>
                {sent.live
                  ? `Rx ID: ${sent.prescriptionIds.join(', ')}`
                  : 'No Photon token set, so nothing was sent.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
