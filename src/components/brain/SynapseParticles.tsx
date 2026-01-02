import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface SynapseParticlesProps {
  count?: number
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

function generateBrainSynapses(count: number): {
  positions: Float32Array
  colors: Float32Array
  sizes: Float32Array
} {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    // Uniform spherical distribution
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = 1.0

    // Spherical to cartesian (Y-up)
    let x = r * Math.sin(phi) * Math.cos(theta)
    let y = r * Math.cos(phi)
    let z = r * Math.sin(phi) * Math.sin(theta)

    // === BRAIN SHAPE DEFORMATIONS ===

    // 1. Central groove (longitudinal fissure) - indent along top center
    const grooveDepth = Math.exp(-Math.abs(x) * 6) * 0.15
    const grooveFactor = 1.0 - grooveDepth * Math.max(0, y)

    // 2. Frontal lobe - bulge at front-top
    const frontalBulge = Math.max(0, z * 0.5 + 0.5) * Math.max(0, y * 0.5 + 0.3) * 0.2

    // 3. Temporal lobes - bulges on sides below middle
    const temporalBulge = Math.max(0, Math.abs(x) - 0.3) * Math.max(0, -y * 0.5 + 0.3) * Math.max(0, z * 0.5 + 0.5) * 0.25

    // 4. Occipital lobe - bulge at back
    const occipitalBulge = Math.max(0, -z * 0.5 + 0.3) * Math.max(0, y * 0.3 + 0.3) * 0.15

    // 5. Cerebellum - smaller bulge at back-bottom
    const cerebellumBulge = Math.max(0, -z * 0.5 + 0.2) * Math.max(0, -y * 0.5 + 0.2) * (1 - Math.abs(x) * 0.8) * 0.2

    // 6. Flatten bottom
    const bottomFlatten = Math.max(0, -y - 0.5) * 0.15

    // Combined shape modifier
    const shapeMod = grooveFactor + frontalBulge + temporalBulge + occipitalBulge + cerebellumBulge - bottomFlatten

    // 7. Surface wrinkles (sulci/gyri) using noise
    const wrinkle1 = noise3D(x * 4, y * 4, z * 4) * 0.08
    const wrinkle2 = noise3D(x * 8, y * 8, z * 8) * 0.04
    const wrinkle3 = noise3D(x * 2, y * 2, z * 2) * 0.06

    // Apply deformations
    const len = Math.sqrt(x * x + y * y + z * z)
    const nx = x / len, ny = y / len, nz = z / len

    x = x * shapeMod + nx * (wrinkle1 + wrinkle2 + wrinkle3)
    y = y * shapeMod + ny * (wrinkle1 + wrinkle2 + wrinkle3)
    z = z * shapeMod + nz * (wrinkle1 + wrinkle2 + wrinkle3)

    // Final brain proportions
    positions[i * 3] = x * 1.35 * 1.2     // Wider
    positions[i * 3 + 1] = y * 1.0 * 1.2  // Normal height
    positions[i * 3 + 2] = z * 1.15 * 1.2 // Deeper

    // === COLORS - Regional variation ===

    // Base color: dark blue-gray
    let cr = 0.22, cg = 0.28, cb = 0.32

    // Height gradient - top is slightly more cyan
    const heightFactor = (y + 1) / 2 // 0 to 1
    cr += heightFactor * 0.05
    cg += heightFactor * 0.12
    cb += heightFactor * 0.15

    // Frontal region - slightly warmer
    if (z > 0.3 && y > -0.2) {
      cr += 0.08
      cg += 0.05
    }

    // Random bright highlights (active synapses)
    const brightRoll = Math.random()
    if (brightRoll > 0.97) {
      // Bright teal
      cr = 0.45; cg = 0.9; cb = 0.92
    } else if (brightRoll > 0.9) {
      // Medium teal
      cr *= 1.5; cg *= 1.8; cb *= 1.9
    }

    colors[i * 3] = cr
    colors[i * 3 + 1] = cg
    colors[i * 3 + 2] = cb

    // === SIZES - Small crisp dots ===
    const sizeRoll = Math.random()
    if (sizeRoll > 0.98) {
      sizes[i] = 1.8  // Rare slightly larger
    } else if (sizeRoll > 0.92) {
      sizes[i] = 1.3  // Medium
    } else {
      sizes[i] = 1.0  // Standard (most)
    }
  }

  return { positions, colors, sizes }
}

export function SynapseParticles({ count = 80000 }: SynapseParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const { positions, colors, sizes } = useMemo(() => {
    return generateBrainSynapses(count)
  }, [count])

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime()
    }
    // Removed independent rotation - let OrbitControls handle all rotation
  })

  const vertexShader = `
    attribute vec3 aColor;
    attribute float aSize;

    uniform float uTime;

    varying vec3 vColor;
    varying float vDepth;

    void main() {
      vColor = aColor;

      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

      // Depth for fog effect (front brighter, back dimmer)
      vDepth = -mvPosition.z;

      // Tiny crisp dots - 1-2 pixels
      gl_PointSize = aSize * 1.5;

      gl_Position = projectionMatrix * mvPosition;
    }
  `

  const fragmentShader = `
    varying vec3 vColor;
    varying float vDepth;

    void main() {
      // Hard square pixel - completely crisp
      gl_FragColor = vec4(vColor, 0.85);
    }
  `

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aColor"
          count={count}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSize"
          count={count}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={{
          uTime: { value: 0 },
        }}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
      />
    </points>
  )
}
