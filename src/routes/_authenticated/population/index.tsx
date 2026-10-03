import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getApiAdapter } from '@/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowRight, Users, AlertTriangle, Activity, WifiOff } from 'lucide-react'
import { Link } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/population/')({
  component: PopulationPage,
})

const SEGMENT_ICONS: Record<string, React.ReactNode> = {
  bp_off: <AlertTriangle className="h-5 w-5" />,
  glucose_off: <Activity className="h-5 w-5" />,
  recovery_off: <Activity className="h-5 w-5" />,
  data_gap: <WifiOff className="h-5 w-5" />,
}

const TIER_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  watch: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
}

function PopulationPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['cohort-summary'],
    queryFn: () => getApiAdapter().getCohortSummary(),
  })

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Population Health</h1>
          <p className="text-sm text-muted-foreground">
            Cohort trends and segments — as of {data.as_of}
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          Synthetic data
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Object.entries(data.tier_counts).map(([tier, count]) => (
          <Card key={tier}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium capitalize">{tier}</p>
                  <p className="text-2xl font-bold">{count}</p>
                </div>
                <div className={`rounded-full p-2 ${TIER_COLORS[tier]}`}>
                  <Users className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Segments</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {data.trends.map((trend) => (
            <Link
              key={trend.id}
              to="/population/$segmentId"
              params={{ segmentId: trend.id.replace('trend-', '') }}
            >
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {SEGMENT_ICONS[trend.id.replace('trend-', '')]}
                      <CardTitle className="text-base">{trend.headline}</CardTitle>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{trend.patient_count} patients</span>
                    <span>•</span>
                    <span className="capitalize">{trend.direction} trend</span>
                  </div>
                  {trend.top_drivers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {trend.top_drivers.map((d) => (
                        <Badge key={d.metric} variant="outline" className="text-xs">
                          {d.metric.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
