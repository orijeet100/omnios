import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { getApiAdapter } from '@/api'
import {
  createPrescription,
  type PhotonPrescription,
} from '@/integrations/photon'
import { ArrowLeft, Pill, CheckCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute(
  '/_authenticated/ehr/prescriptions/$patientId'
)({
  component: PrescriptionPage,
})

function PrescriptionPage() {
  const { patientId } = Route.useParams()
  const [prescription, setPrescription] = useState<PhotonPrescription | null>(
    null
  )
  const [loading, setLoading] = useState(false)

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => getApiAdapter().getPatient(patientId),
  })

  const { data: chart } = useQuery({
    queryKey: ['ehr-chart', patientId],
    queryFn: () => getApiAdapter().getEhrChart(patientId),
  })

  const handlePrescribe = async () => {
    setLoading(true)
    try {
      const result = await createPrescription(
        {
          patient_id: patientId,
          treatment_name: 'Medication review recommended',
          dispense_quantity: 30,
          dispense_unit: 'tablets',
          days_supply: 30,
          instructions: 'Take as directed by clinician',
          diagnoses:
            patient?.patient.conditions.map((c) => c.toUpperCase()) ?? [],
        },
        patient?.patient.name ?? 'Unknown'
      )
      setPrescription(result)
      toast.success('Prescription created via Photon sandbox.')
    } catch (error) {
      toast.error(
        `Photon API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
    setLoading(false)
  }

  if (!patient || !chart) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-8 w-64' />
        <Skeleton className='h-96' />
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-4'>
        <Link to='/ehr'>
          <ArrowLeft className='h-5 w-5 text-muted-foreground hover:text-foreground' />
        </Link>
        <div>
          <h1 className='text-2xl font-bold'>New Prescription</h1>
          <p className='text-sm text-muted-foreground'>
            Photon Health integration (demo mode)
          </p>
        </div>
        <Badge variant='secondary' className='ml-auto text-xs'>
          Synthetic data
        </Badge>
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Patient Context</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Name
                </p>
                <p className='text-sm'>{chart.name}</p>
              </div>
              <Separator />
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Age / Sex
                </p>
                <p className='text-sm'>
                  {chart.age}y {chart.sex}
                </p>
              </div>
              <Separator />
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Conditions
                </p>
                <div className='mt-1 flex flex-wrap gap-1'>
                  {chart.conditions.map((c) => (
                    <Badge key={c} variant='outline' className='text-xs'>
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Medications
                </p>
                <div className='mt-1 space-y-1'>
                  {chart.medications.map((m, i) => (
                    <p key={i} className='text-sm'>
                      {m.label}
                    </p>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Recent Labs
                </p>
                <div className='mt-1 space-y-1'>
                  {chart.labs.map((l, i) => (
                    <p key={i} className='text-sm'>
                      {l.name}: {l.value} {l.unit}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prescription</CardTitle>
          </CardHeader>
          <CardContent>
            {prescription ? (
              <div className='space-y-4'>
                <div className='flex items-center gap-2 rounded-lg bg-green-50 p-4'>
                  <CheckCircle className='h-5 w-5 text-green-600' />
                  <div>
                    <p className='text-sm font-medium text-green-800'>
                      Prescription created
                    </p>
                    <p className='text-xs text-green-600'>
                      Demo mode — not sent to pharmacy
                    </p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Treatment
                  </p>
                  <p className='text-sm'>{prescription.treatment_name}</p>
                </div>
                <Separator />
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Quantity
                  </p>
                  <p className='text-sm'>
                    {prescription.dispense_quantity}{' '}
                    {prescription.dispense_unit}
                  </p>
                </div>
                <Separator />
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Days Supply
                  </p>
                  <p className='text-sm'>{prescription.days_supply}</p>
                </div>
                <Separator />
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Instructions
                  </p>
                  <p className='text-sm'>{prescription.instructions}</p>
                </div>
                <Separator />
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Diagnoses
                  </p>
                  <div className='mt-1 flex flex-wrap gap-1'>
                    {prescription.diagnoses.map((d) => (
                      <Badge key={d} variant='outline' className='text-xs'>
                        {d}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className='space-y-4'>
                <div className='rounded-lg border-2 border-dashed p-8 text-center'>
                  <Pill className='mx-auto mb-2 h-8 w-8 text-muted-foreground' />
                  <p className='text-sm text-muted-foreground'>
                    No prescription created yet
                  </p>
                </div>
                <Button
                  onClick={handlePrescribe}
                  disabled={loading}
                  className='w-full'
                >
                  {loading ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Pill className='mr-2 h-4 w-4' />
                      Proceed to prescription
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
