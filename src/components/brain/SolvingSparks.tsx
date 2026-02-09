/**
 * SolvingSparks - Spark particle effect emanating from synapses being solved
 *
 * Creates radial spark particles that burst outward from the synapse position,
 * colored to match the synapse type for visual cohesion.
 */

import { onMount, onCleanup, createEffect, createMemo } from 'solid-js'
import * as THREE from 'three'
import { useThree, useFrame } from '@/three/hooks'
import type { Ship } from '@/stores/shipStore'
import { constrainToBrainShape } from './core/brainConstants'
import type { SynapseType } from '@/types/game'

interface SolvingSparksProps {
  ship: Ship
  synapsePosition: { x: number; y: number; z: number }
  isActive: boolean
  synapseType?: SynapseType
}

// Synapse type colors (matching the synapse color scheme)
const SYNAPSE_TYPE_COLORS: Record<SynapseType, [number, number, number]> = {
  minor: [0.3, 0.8, 0.9],      // Cyan
  complex: [0.9, 0.6, 0.2],    // Orange/gold
  deep: [0.8, 0.3, 0.9],       // Purple
  unique: [1.0, 0.9, 0.3],     // Gold/yellow
}

const SPARK_COUNT = 40

// Vertex shader for spark particles
const SPARK_VERTEX_SHADER = `
  attribute float aLife;
  attribute float aSpeed;
  attribute float aAngle;
  attribute float aSize;

  uniform float uTime;
  uniform vec3 uCenter;

  varying float vLife;
  varying float vAlpha;

  void main() {
    // Calculate current life cycle (0-1, repeating)
    float cycleTime = 1.2;  // Spark lifespan in seconds
    float t = mod(uTime * aSpeed + aLife, cycleTime) / cycleTime;
    vLife = t;

    // Radial expansion from center
    float radius = t * 0.25;  // Max expansion radius
    float x = cos(aAngle) * radius;
    float y = sin(aAngle * 0.7 + uTime * 2.0) * radius * 0.3;  // Slight vertical variation
    float z = sin(aAngle) * radius;

    // Position relative to synapse center
    vec3 pos = uCenter + vec3(x, y, z);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // Size decreases as spark expands and fades
    float sizeFade = 1.0 - t;
    float distScale = 200.0 / max(-mvPosition.z, 1.0);
    gl_PointSize = clamp(aSize * sizeFade * distScale, 1.0, 12.0);

    // Alpha fades out over lifetime
    vAlpha = sizeFade * sizeFade;  // Quadratic falloff for nice fade

    gl_Position = projectionMatrix * mvPosition;
  }
`

// Fragment shader for spark particles
const SPARK_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uTime;

  varying float vLife;
  varying float vAlpha;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    // Discard outside circle
    if (dist > 0.5) discard;

    // Soft circular glow
    float glow = 1.0 - smoothstep(0.0, 0.5, dist);

    // Hot white core transitioning to synapse color
    vec3 coreColor = vec3(1.0, 1.0, 0.95);  // Near-white
    vec3 color = mix(uColor, coreColor, glow * 0.7);

    // Sparkle shimmer
    float shimmer = 0.8 + 0.2 * sin(vLife * 20.0 + uTime * 10.0);
    color *= shimmer;

    float alpha = glow * vAlpha * 0.9;

    gl_FragColor = vec4(color, alpha);
  }
`

export function SolvingSparks(props: SolvingSparksProps) {
  const { scene } = useThree()

  let points: THREE.Points | null = null
  let geometry: THREE.BufferGeometry | null = null
  let material: THREE.ShaderMaterial | null = null

  // Get color based on synapse type
  const sparkColor = createMemo(() => {
    const type = props.synapseType ?? 'minor'
    return SYNAPSE_TYPE_COLORS[type] ?? SYNAPSE_TYPE_COLORS.minor
  })

  // Compute synapse center position
  const synapseCenter = createMemo(() => {
    if (!props.synapsePosition) return new THREE.Vector3()
    const [x, y, z] = constrainToBrainShape(
      props.synapsePosition.x,
      props.synapsePosition.y,
      props.synapsePosition.z
    )
    return new THREE.Vector3(x, y, z)
  })

  onMount(() => {
    const sceneObj = scene()
    if (!sceneObj) return

    // Create geometry with particle attributes
    geometry = new THREE.BufferGeometry()

    // Initialize particle attributes
    const positions = new Float32Array(SPARK_COUNT * 3)
    const lives = new Float32Array(SPARK_COUNT)
    const speeds = new Float32Array(SPARK_COUNT)
    const angles = new Float32Array(SPARK_COUNT)
    const sizes = new Float32Array(SPARK_COUNT)

    for (let i = 0; i < SPARK_COUNT; i++) {
      // Start at center (will be offset by shader)
      positions[i * 3] = 0
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = 0

      // Random life offset for staggered emission
      lives[i] = Math.random()

      // Random speed variation
      speeds[i] = 0.6 + Math.random() * 0.8

      // Distribute angles evenly with some randomness
      angles[i] = (i / SPARK_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5

      // Random size variation
      sizes[i] = 4.0 + Math.random() * 6.0
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aLife', new THREE.BufferAttribute(lives, 1))
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
    geometry.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    // Create shader material
    const color = sparkColor()
    material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: synapseCenter() },
        uColor: { value: new THREE.Color(color[0], color[1], color[2]) },
      },
      vertexShader: SPARK_VERTEX_SHADER,
      fragmentShader: SPARK_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    // Create points
    points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    points.renderOrder = 55  // Above burn particles (50), below ships (100)
    points.visible = false
    sceneObj.add(points)

    onCleanup(() => {
      if (points && sceneObj) {
        sceneObj.remove(points)
      }
      geometry?.dispose()
      material?.dispose()
    })
  })

  // Update visibility and uniforms when props change
  createEffect(() => {
    if (!points || !material) return

    const active = props.isActive && props.ship.state === 'solving'
    points.visible = active

    if (active) {
      // Update center position
      material.uniforms.uCenter.value = synapseCenter()

      // Update color based on synapse type
      const color = sparkColor()
      material.uniforms.uColor.value.setRGB(color[0], color[1], color[2])
    }
  })

  // Animate sparks
  useFrame(({ clock }) => {
    if (material && points?.visible) {
      material.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return null
}

export default SolvingSparks
