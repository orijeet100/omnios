import { lazy, Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { getBodyScan } from '../data'
import { ScanMetrics } from './scan-metrics'

// The 3D libraries are large, so they load only when this tab is opened.
const PointCloudViewer = lazy(() =>
  import('./point-cloud-viewer').then((m) => ({ default: m.PointCloudViewer }))
)

/** The Visualize body scan: the 3D reconstruction next to the measurements. */
export function BodyScanPanel({
  patientId,
  sex,
}: {
  patientId: string
  sex: 'F' | 'M'
}) {
  const scan = getBodyScan(patientId)
  if (!scan?.measurements) {
    return <p className='text-sm text-muted-foreground'>No body scan.</p>
  }

  return (
    <div className='grid gap-6 md:grid-cols-2'>
      <div className='h-80 overflow-hidden rounded-xl border bg-muted/30'>
        {scan.point_cloud && (
          <Suspense fallback={<Skeleton className='size-full' />}>
            <PointCloudViewer cloud={scan.point_cloud} />
          </Suspense>
        )}
      </div>
      <ScanMetrics scan={scan} sex={sex} />
    </div>
  )
}
