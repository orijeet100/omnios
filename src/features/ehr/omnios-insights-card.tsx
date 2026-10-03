import { getApiAdapter } from '@/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChangesTable } from '@/features/patients/changes-table'

/** What moved against the patient's own baseline, as a table. */
export function OmniosInsightsCard({
  patientId,
  patientName,
}: {
  patientId: string
  patientName: string
}) {
  const deviations = getApiAdapter().getDeviations(patientId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>OmniOS insights for {patientName}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChangesTable
          patientId={patientId}
          deviations={deviations}
          emptyText='No changes from baseline.'
        />
      </CardContent>
    </Card>
  )
}
