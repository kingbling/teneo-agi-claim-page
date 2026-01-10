import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BRAIN_REGION_VERTEX_SHADER, BRAIN_REGION_FRAGMENT_SHADER } from './core/shaderUtils'
import { LOD_PARTICLE_COUNTS } from './core/brainConstants'
import { FUNCTIONAL_BRAIN_REGIONS } from '@/constants/brainRegions'

interface SynapseParticlesMinimalProps {
  count?: number
  selectedRegionIndex?: number
  highlightIntensity?: number
  lodLevel?: number  // 0 = close (most detail), 1 = medium, 2 = far (least detail)
}

// Perlin-like noise for organic surface detail
function noise3D(x: number, y: number, z: number): number {
  const p = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180]

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const lerp = (t: number, a: number, b: number) => a + t * (b - a)
  const grad = (hash: number, x: number, y: number, z: number) => {
    const h = hash & 15
    const u = h < 8 ? x : y
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
  }

  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z)
  const u = fade(x), v = fade(y), w = fade(z)
  const A = p[X] + Y, AA = p[A & 255] + Z, AB = p[(A + 1) & 255] + Z
  const B = p[(X + 1) & 255] + Y, BA = p[B & 255] + Z, BB = p[(B + 1) & 255] + Z

  return lerp(w, lerp(v, lerp(u, grad(p[AA & 255], x, y, z), grad(p[BA & 255], x - 1, y, z)),
    lerp(u, grad(p[AB & 255], x, y - 1, z), grad(p[BB & 255], x - 1, y - 1, z))),
    lerp(v, lerp(u, grad(p[(AA + 1) & 255], x, y, z - 1), grad(p[(BA + 1) & 255], x - 1, y, z - 1)),
    lerp(u, grad(p[(AB + 1) & 255], x, y - 1, z - 1), grad(p[(BB + 1) & 255], x - 1, y - 1, z - 1))))
}

/**
 * Assign a particle to a brain region based on its position.
 */
function assignParticleToRegion(x: number, y: number, z: number): number {
  // Sort regions by volume (smaller first) to prioritize specific regions
  const sortedRegions = [...FUNCTIONAL_BRAIN_REGIONS].sort((a, b) => {
    const volumeA = (a.bounds.xMax - a.bounds.xMin) *
                    (a.bounds.yMax - a.bounds.yMin) *
                    (a.bounds.zMax - a.bounds.zMin)
    const volumeB = (b.bounds.xMax - b.bounds.xMin) *
                    (b.bounds.yMax - b.bounds.yMin) *
                    (b.bounds.zMax - b.bounds.zMin)
    return volumeA - volumeB
  })

  // Check each region's bounds
  for (const region of sortedRegions) {
    const b = region.bounds
    if (x >= b.xMin && x <= b.xMax &&
        y >= b.yMin && y <= b.yMax &&
        z >= b.zMin && z <= b.zMax) {
      return FUNCTIONAL_BRAIN_REGIONS.findIndex(r => r.id === region.id)
    }
  }

  // No direct match - find nearest region
  let minDistance = Infinity
  let nearestIndex = 0

  for (let i = 0; i < FUNCTIONAL_BRAIN_REGIONS.length; i++) {
    const b = FUNCTIONAL_BRAIN_REGIONS[i].bounds
    const centerX = (b.xMin + b.xMax) / 2
    const centerY = (b.yMin + b.yMax) / 2
    const centerZ = (b.zMin + b.zMax) / 2

    const distance = Math.sqrt(
      (x - centerX) ** 2 +
      (y - centerY) ** 2 +
      (z - centerZ) ** 2
    )

    if (distance < minDistance) {
      minDistance = distance
      nearestIndex = i
    }
  }

  return nearestIndex
}

function generateBrainSynapses(count: number) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const regionIds = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    // Uniform spherical distribution on surface
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = 1.0

    // Spherical to cartesian
    let x = r * Math.sin(phi) * Math.cos(theta)
    let y = r * Math.cos(phi)
    let z = r * Math.sin(phi) * Math.sin(theta)

    // Brain shape deformations
    const grooveDepth = Math.exp(-Math.abs(x) * 6) * 0.15
    const grooveFactor = 1.0 - grooveDepth * Math.max(0, y)
    const frontalBulge = Math.max(0, z * 0.5 + 0.5) * Math.max(0, y * 0.5 + 0.3) * 0.2
    const temporalBulge = Math.max(0, Math.abs(x) - 0.3) * Math.max(0, -y * 0.5 + 0.3) * Math.max(0, z * 0.5 + 0.5) * 0.25
    const occipitalBulge = Math.max(0, -z * 0.5 + 0.3) * Math.max(0, y * 0.3 + 0.3) * 0.15
    const cerebellumBulge = Math.max(0, -z * 0.5 + 0.2) * Math.max(0, -y * 0.5 + 0.2) * (1 - Math.abs(x) * 0.8) * 0.2
    const bottomFlatten = Math.max(0, -y - 0.5) * 0.15
    const shapeMod = grooveFactor + frontalBulge + temporalBulge + occipitalBulge + cerebellumBulge - bottomFlatten

    // Surface wrinkles
    const wrinkle1 = noise3D(x * 4, y * 4, z * 4) * 0.08
    const wrinkle2 = noise3D(x * 8, y * 8, z * 8) * 0.04
    const wrinkle3 = noise3D(x * 2, y * 2, z * 2) * 0.06

    const len = Math.sqrt(x * x + y * y + z * z)
    const nx = x / len, ny = y / len, nz = z / len

    x = x * shapeMod + nx * (wrinkle1 + wrinkle2 + wrinkle3)
    y = y * shapeMod + ny * (wrinkle1 + wrinkle2 + wrinkle3)
    z = z * shapeMod + nz * (wrinkle1 + wrinkle2 + wrinkle3)

    // Assign region BEFORE final scaling
    const regionIndex = assignParticleToRegion(x, y, z)
    regionIds[i] = regionIndex

    // Final brain proportions
    positions[i * 3] = x * 1.35 * 1.2
    positions[i * 3 + 1] = y * 1.0 * 1.2
    positions[i * 3 + 2] = z * 1.15 * 1.2

    // Region-based coloring
    const region = FUNCTIONAL_BRAIN_REGIONS[regionIndex]
    let cr = region.color.r
    let cg = region.color.g
    let cb = region.color.b

    // Slight random variation within region color
    const variation = 0.9 + Math.random() * 0.2
    cr *= variation
    cg *= variation
    cb *= variation

    // Random bright highlights (active synapses)
    const brightRoll = Math.random()
    if (brightRoll > 0.98) {
      cr = Math.min(1.0, cr * 1.8)
      cg = Math.min(1.0, cg * 1.8)
      cb = Math.min(1.0, cb * 1.8)
    } else if (brightRoll > 0.93) {
      cr *= 1.4
      cg *= 1.4
      cb *= 1.4
    }

    colors[i * 3] = cr
    colors[i * 3 + 1] = cg
    colors[i * 3 + 2] = cb

    // Sizes
    const sizeRoll = Math.random()
    if (sizeRoll > 0.98) {
      sizes[i] = 1.8
    } else if (sizeRoll > 0.92) {
      sizes[i] = 1.3
    } else {
      sizes[i] = 1.0
    }
  }

  return { positions, colors, sizes, regionIds }
}

/**
 * SynapseParticlesMinimal - Brain-shaped particle cloud with region coloring
 * Supports LOD-based particle count: more particles when zoomed in, fewer when zoomed out
 */
export function SynapseParticlesMinimal({
  count,
  selectedRegionIndex = -1,
  highlightIntensity = 0,
  lodLevel = 1,
}: SynapseParticlesMinimalProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  // Calculate particle count based on LOD level or use provided count
  const particleCount = count ?? (
    lodLevel === 0 ? LOD_PARTICLE_COUNTS.lod0 :
    lodLevel === 2 ? LOD_PARTICLE_COUNTS.lod2 :
    LOD_PARTICLE_COUNTS.lod1
  )

  const { positions, colors, sizes, regionIds } = useMemo(() => {
    return generateBrainSynapses(particleCount)
  }, [particleCount])

  // Update uniforms when region selection changes
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uSelectedRegion.value = selectedRegionIndex
      materialRef.current.uniforms.uHighlightIntensity.value = highlightIntensity
    }
  }, [selectedRegionIndex, highlightIntensity])

  // Update highlight intensity each frame for smooth animation
  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uHighlightIntensity.value = highlightIntensity
    }
  })

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aRegionId" args={[regionIds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={{
          uSelectedRegion: { value: selectedRegionIndex },
          uHighlightIntensity: { value: highlightIntensity },
        }}
        vertexShader={BRAIN_REGION_VERTEX_SHADER}
        fragmentShader={BRAIN_REGION_FRAGMENT_SHADER}
        transparent
        depthWrite={false}
      />
    </points>
  )
}
