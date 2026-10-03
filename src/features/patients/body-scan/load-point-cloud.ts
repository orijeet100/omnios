import type { PointCloud } from '@/contracts'

export type LoadedPointCloud = {
  /** x, y, z per point, in metres, centred, y up. */
  positions: Float32Array
  /** red, green, blue per point (0-255). */
  colors: Uint8Array
}

/** Reads a prepared point-cloud file: N x 3 float32 then N x 3 uint8. */
export async function loadPointCloud(
  cloud: PointCloud
): Promise<LoadedPointCloud> {
  const response = await fetch(cloud.url)
  if (!response.ok) throw new Error(`Could not load ${cloud.url}`)
  const buffer = await response.arrayBuffer()
  const floats = cloud.points * 3
  return {
    positions: new Float32Array(buffer, 0, floats),
    colors: new Uint8Array(buffer, floats * 4, floats),
  }
}
