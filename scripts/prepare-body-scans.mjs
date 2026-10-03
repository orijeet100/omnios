// Prepares the Visualize body-scan export for the web app.
//
//   node scripts/prepare-body-scans.mjs
//
// Reads data/bodyscan-export.zip and writes:
//   public/scans/<scan_id>.bin          thinned, centred point cloud (see below)
//   src/mock/body-scans/scans.json      measurements in our contract shape
//
// .bin layout: N x 3 float32 (x, y, z in metres, centred) followed by
// N x 3 uint8 (red, green, blue). N is `point_cloud.points` in scans.json.
//
// Names and ages are dropped on purpose: we only use height, weight and the
// measurements. Sex is our own assignment (see SEX_BY_MEMBER), not Visualize's.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { unzipSync } from 'fflate'

const ZIP = 'data/bodyscan-export.zip'
const POINTS = 60_000
const SEED = 20261003

/** Our assignment per scan, decided by the project owner. */
const SEX_BY_MEMBER = {
  member_demo_1: 'M',
  member_demo_2: 'M',
  member_demo_3: 'F',
}

function mulberry32(seed) {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (x, digits = 2) =>
  x == null ? undefined : Math.round(x * 10 ** digits) / 10 ** digits

/** Reads a binary little-endian PLY with x y z (float) and r g b (uint8). */
function readPly(bytes) {
  const text = new TextDecoder('latin1').decode(bytes.subarray(0, 600))
  const headerEnd = text.indexOf('end_header') + 'end_header\n'.length
  const count = Number(/element vertex (\d+)/.exec(text)[1])
  const view = new DataView(bytes.buffer, bytes.byteOffset + headerEnd)
  const stride = 15
  return { count, view, stride }
}

function thin({ count, view, stride }, rng) {
  // Pick POINTS random vertices, in order, by walking the list once.
  const keep = Math.min(POINTS, count)
  const chosen = []
  for (let i = 0, need = keep; i < count && need > 0; i++) {
    if (rng() < need / (count - i)) {
      chosen.push(i)
      need--
    }
  }
  const positions = new Float32Array(keep * 3)
  const colors = new Uint8Array(keep * 3)
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  chosen.forEach((vertex, n) => {
    const base = vertex * stride
    for (let axis = 0; axis < 3; axis++) {
      const value = view.getFloat32(base + axis * 4, true)
      positions[n * 3 + axis] = value
      min[axis] = Math.min(min[axis], value)
      max[axis] = Math.max(max[axis], value)
    }
    for (let channel = 0; channel < 3; channel++) {
      colors[n * 3 + channel] = view.getUint8(base + 12 + channel)
    }
  })
  const centre = min.map((lo, axis) => (lo + max[axis]) / 2)
  for (let n = 0; n < keep; n++) {
    for (let axis = 0; axis < 3; axis++) positions[n * 3 + axis] -= centre[axis]
  }
  const size = max.map((hi, axis) => hi - min[axis])
  return { keep, positions, colors, size }
}

const files = unzipSync(new Uint8Array(readFileSync(ZIP)))
const exported = JSON.parse(new TextDecoder().decode(files['export.json']))
mkdirSync('public/scans', { recursive: true })
mkdirSync('src/mock/body-scans', { recursive: true })

const scans = exported.scans.map((entry, index) => {
  const { result } = entry
  const m = result.measurements
  const sex = SEX_BY_MEMBER[entry.memberId]
  if (!sex) throw new Error(`No sex assigned for ${entry.memberId}`)

  const cloud = thin(readPly(files[entry.pointCloudFile]), mulberry32(SEED + index))
  const binary = new Uint8Array(cloud.keep * 15)
  binary.set(new Uint8Array(cloud.positions.buffer), 0)
  binary.set(cloud.colors, cloud.keep * 12)
  writeFileSync(`public/scans/${result.scanId}.bin`, binary)

  return {
    scan_id: result.scanId,
    sex,
    scanned_at: result.occurredAt,
    model_version: result.modelVersion,
    status: 'completed',
    source: 'visualize',
    subject: {
      height_in: round(result.subject.heightIn, 1),
      weight_lb: round(result.subject.weightLb, 1),
    },
    measurements: {
      body_fat_percent: round(m.bodyFatPercent, 1),
      bmi: round(m.bmi, 1),
      lean_muscle_mass_lb: round(m.leanMuscleMassLb, 1),
      bone_mineral_content_lb: round(m.boneMineralContentLb, 1),
      girths: {
        neck_in: round(m.girths.neckIn, 1),
        waist_in: round(m.girths.waistIn, 1),
        lower_waist_in: round(m.girths.lowerWaistIn, 1),
        hip_in: round(m.girths.hipIn, 1),
      },
      advanced: {
        waist_hip_ratio: round(m.advanced.waistHipRatio, 2),
        waist_height_ratio: round(m.advanced.waistHeightRatio, 2),
        central_adiposity_index: round(m.advanced.centralAdiposityIndex, 2),
        fat_mass_index: round(m.advanced.fatMassIndex, 1),
        skeletal_muscle_index: round(m.advanced.skeletalMuscleIndex, 1),
        muscle_preservation_index: round(m.advanced.musclePreservationIndex, 1),
      },
      body_fat_formula: m.bodyFatFormula,
      duration_seconds: round(m.duration, 0),
    },
    point_cloud: {
      url: `/scans/${result.scanId}.bin`,
      points: cloud.keep,
      /** Extent in metres: [x, y, z]; y is up. */
      size_m: cloud.size.map((s) => round(s, 3)),
    },
  }
})

writeFileSync('src/mock/body-scans/scans.json', JSON.stringify(scans, null, 2) + '\n')
console.log(`Wrote ${scans.length} scans, ${POINTS} points each.`)
