import { useEffect, useState } from 'react'
import type { PointCloud } from '@/contracts'
import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Skeleton } from '@/components/ui/skeleton'
import { loadPointCloud, type LoadedPointCloud } from './load-point-cloud'

const POINT_SIZE = 0.006
const FIELD_OF_VIEW = 35
const SPIN_SPEED = 1.5
/** Space around the scan, as a multiple of its height. */
const FRAMING = 1.2

function Cloud({ positions, colors }: LoadedPointCloud) {
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach='attributes-position' args={[positions, 3]} />
        <bufferAttribute attach='attributes-color' args={[colors, 3, true]} />
      </bufferGeometry>
      <pointsMaterial size={POINT_SIZE} vertexColors sizeAttenuation />
    </points>
  )
}

/**
 * The 3D reconstruction from the scan, as a coloured point cloud. It spins
 * slowly; drag to turn it and scroll to zoom.
 */
export function PointCloudViewer({ cloud }: { cloud: PointCloud }) {
  const [loaded, setLoaded] = useState<LoadedPointCloud | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadPointCloud(cloud)
      .then((data) => !cancelled && setLoaded(data))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [cloud])

  // Back the camera off just far enough to fit the whole scan.
  const distance =
    (cloud.size_m[1] / 2 / Math.tan((FIELD_OF_VIEW / 2) * (Math.PI / 180))) *
    FRAMING

  if (failed) {
    return (
      <p className='p-6 text-sm text-muted-foreground'>3D scan unavailable.</p>
    )
  }
  if (!loaded) return <Skeleton className='size-full' />

  return (
    <Canvas
      camera={{ position: [0, 0, distance], fov: FIELD_OF_VIEW }}
      dpr={[1, 2]}
    >
      <Cloud {...loaded} />
      <OrbitControls
        autoRotate
        autoRotateSpeed={SPIN_SPEED}
        enablePan={false}
        enableDamping
        minDistance={distance * 0.4}
        maxDistance={distance * 2}
      />
    </Canvas>
  )
}
