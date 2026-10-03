import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getApiAdapter } from '@/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Link } from '@tanstack/react-router'
import { TrendingUp, TrendingDown, Minus, Send, Zap, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'

export const Route = createFileRoute('/_authenticated/worklist/')({
  component: WorklistPage,
})

const TREND_ICONS: Record<string, React.ReactNode> = {
  up: <TrendingUp className="h-4 w-4 text-red-500" />,
  down: <TrendingDown className="h-4 w-4 text-blue-500" />,
  flat: <Minus className="h-4 w-4 text-gray-500" />,
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  routed: 'bg-purple-100 text-purple-800',
  acknowledged: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  re_escalated: 'bg-red-100 text-red-800',
}

function WorklistPage() {
  const [routingId, setRoutingId] = useState<string | null>(null)
  const [worseningId, setWorseningId] = useState<string | null>(null)

  const { data: worklist, isLoading } = useQuery({
    queryKey: ['worklist'],
    queryFn: () => getApiAdapter().listWorklist(),
  })

  const handleRoute = (patientId: string) => {
    setRoutingId(patientId)
    const result = getApiAdapter().routePatient(patientId, 'cm-001')
    if (result) {
      toast.success('Request submitted (demo mode).')
    }
    setRoutingId(null)
  }

  const handleWorsen = (patientId: string) => {
    setWorseningId(patientId)
    const result = getApiAdapter().worsenPatient(patientId)
    if (result) {
      toast.success('Patient worsened — check for re-escalation.')
    }
    setWorseningId(null)
  }

  const handleAdvanceClock = () => {
    getApiAdapter().advanceClock(7)
    toast.success('Clock advanced 7 days.')
  }

  if (isLoading || !worklist) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Worklist</h1>
          <p className="text-sm text-muted-foreground">
            Ranked by clinical risk — {worklist.length} patients
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          Synthetic data
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <CardTitle>Demo Controls</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleAdvanceClock}>
              <Clock className="h-3 w-3 mr-1" />
              Advance Clock 7 Days
            </Button>
            <span className="text-xs text-muted-foreground">
              Use "Worsen" on a routed patient to trigger re-escalation
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Patient Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {worklist.map((patient) => (
              <div
                key={patient.patient_id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <Link
                  to="/patients/$patientId"
                  params={{ patientId: patient.patient_id }}
                  className="flex items-center gap-4 flex-1"
                >
                  <div>
                    <p className="font-medium">{patient.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {patient.age}y {patient.sex} • {patient.conditions.join(', ')}
                    </p>
                  </div>
                </Link>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    {TREND_ICONS[patient.risk_trend]}
                    <span className="text-sm capitalize">{patient.risk_trend}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{patient.risk_score}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {patient.risk_tier}
                    </p>
                  </div>
                  <Badge className={STATUS_COLORS[patient.status]}>
                    {patient.status.replace(/_/g, ' ')}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRoute(patient.patient_id)}
                    disabled={routingId === patient.patient_id || patient.status === 'routed'}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Route
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleWorsen(patient.patient_id)}
                    disabled={worseningId === patient.patient_id}
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    Worsen
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
