import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { getApiAdapter } from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Zap, Clock, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_app/demo/')({
  component: DemoControls,
})

function DemoControls() {
  const queryClient = useQueryClient()

  const handleWorsen = () => {
    const adapter = getApiAdapter()
    const worklist = adapter.listWorklist()
    const routed = worklist.find((w) => w.status === 'routed')
    if (routed) {
      adapter.worsenPatient(routed.patient_id)
      queryClient.invalidateQueries({ queryKey: ['worklist'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success(`Patient ${routed.name} worsened — check for re-escalation.`)
    } else {
      const anyPatient = worklist[0]
      if (anyPatient) {
        adapter.worsenPatient(anyPatient.patient_id)
        queryClient.invalidateQueries({ queryKey: ['worklist'] })
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
        toast.success(`Patient ${anyPatient.name} worsened.`)
      }
    }
  }

  const handleAdvanceClock = () => {
    getApiAdapter().advanceClock(7)
    queryClient.invalidateQueries({ queryKey: ['worklist'] })
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
    toast.success('Clock advanced 7 days.')
  }

  const handleRunSync = () => {
    getApiAdapter().runSync()
    toast.success('Sync completed (demo mode).')
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Demo Controls</h1>
          <p className="text-sm text-muted-foreground">
            Trigger demo scenarios to showcase the platform
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-4 w-4 text-red-500" />
              Worsen Patient
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Pushes a routed patient past the re-escalation threshold. The patient will return to the top of the worklist.
            </p>
            <Button onClick={handleWorsen} variant="destructive" className="w-full">
              <Zap className="h-4 w-4 mr-2" />
              Worsen Patient
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Advance Clock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Advances the demo clock by 7 days. Snoozed patients may become due again.
            </p>
            <Button onClick={handleAdvanceClock} className="w-full">
              <Clock className="h-4 w-4 mr-2" />
              Advance 7 Days
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-green-500" />
              Run Sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Simulates a 24h sync. New data may trigger new flags and insights.
            </p>
            <Button onClick={handleRunSync} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Sync
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
