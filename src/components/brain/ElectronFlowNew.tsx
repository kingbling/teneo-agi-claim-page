import { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SpaceDiscoveryEvent, SpaceCluster } from '@/types/agent'
import { BRAIN_SCALE, TRANCE_CONFIG } from './core/brainConstants'
import { useAgentStore } from '@/stores/agentStore'

interface ElectronFlowProps {
  recentDiscoveries: SpaceDiscoveryEvent[]
  spaceClusters?: SpaceCluster[]
  maxFlows?: number
}

interface ElectronFlow {
  id: string
  startPoint: THREE.Vector3
  endPoint: THREE.Vector3
  controlPoint1: THREE.Vector3
  controlPoint2: THREE.Vector3
  startTime: number
  duration: number
}

// Vertex shader for electron particles
const ELECTRON_VERTEX_SHADER = `
  attribute float aProgress;
  attribute float aSize;

  uniform float uTime;

  varying float vProgress;

  void main() {
    vProgress = aProgress;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // Pulse effect
    float pulse = 1.0 + sin(uTime * 5.0 + aProgress * 10.0) * 0.3;
    gl_PointSize = aSize * pulse * (200.0 / -mvPosition.z);

    gl_Position = projectionMatrix * mvPosition;
  }
`

// Fragment shader for electron particles
const ELECTRON_FRAGMENT_SHADER = `
  varying float vProgress;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    // Soft circular falloff
    float alpha = 1.0 - smoothstep(0.2, 0.5, dist);

    // Electric blue-cyan color with white core
    vec3 color = mix(
      vec3(0.2, 0.8, 1.0), // Cyan
      vec3(1.0, 1.0, 1.0), // White core
      1.0 - dist * 2.0
    );

    gl_FragColor = vec4(color, alpha * 0.9);
  }
`

const PARTICLES_PER_FLOW = 20
const FLOW_DURATION = 2.0 // seconds in scaled time

// Find the nearest neighbor cluster to a position
function findNearestNeighbor(
  position: THREE.Vector3,
  clusters: SpaceCluster[],
  excludeId?: string
): THREE.Vector3 | null {
  let nearestDist = Infinity
  let nearestPos: THREE.Vector3 | null = null

  for (const cluster of clusters) {
    if (cluster.id === excludeId) continue

    const clusterPos = new THREE.Vector3(
      cluster.positionX * BRAIN_SCALE.x,
      cluster.positionY * BRAIN_SCALE.y,
      cluster.positionZ * BRAIN_SCALE.z
    )

    const dist = position.distanceTo(clusterPos)
    if (dist < nearestDist && dist > 0.05) {
      nearestDist = dist
      nearestPos = clusterPos
    }
  }

  return nearestPos
}

// Generate a point on cubic bezier curve
function cubicBezier(
  t: number,
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  p3: THREE.Vector3
): THREE.Vector3 {
  const u = 1 - t
  const tt = t * t
  const uu = u * u
  const uuu = uu * u
  const ttt = tt * t

  const result = new THREE.Vector3()
  result.copy(p0).multiplyScalar(uuu)
  result.add(p1.clone().multiplyScalar(3 * uu * t))
  result.add(p2.clone().multiplyScalar(3 * u * tt))
  result.add(p3.clone().multiplyScalar(ttt))

  return result
}

export function ElectronFlowNew({ recentDiscoveries, spaceClusters, maxFlows = 5 }: ElectronFlowProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const [activeFlows, setActiveFlows] = useState<ElectronFlow[]>([])

  // Track processed discoveries to avoid duplicates
  const processedIds = useRef(new Set<string>())

  // Track scaled time for consistent flow lifecycle
  const scaledTimeRef = useRef(0)
  const lastTimeRef = useRef(0)

  // Get time scale from store for trance mode
  const userAgents = useAgentStore((state) => state.userAgents)
  const isTranceActive = userAgents.some((a) => a.tranceActive)
  const timeScale = isTranceActive ? TRANCE_CONFIG.timeScale : TRANCE_CONFIG.normalScale

  // Create new flows when discoveries happen
  useEffect(() => {
    if (recentDiscoveries.length === 0) return

    const latestDiscovery = recentDiscoveries[0]
    if (processedIds.current.has(latestDiscovery.spaceId)) return

    processedIds.current.add(latestDiscovery.spaceId)

    // Only keep last 100 processed IDs
    if (processedIds.current.size > 100) {
      const ids = Array.from(processedIds.current)
      processedIds.current = new Set(ids.slice(-50))
    }

    // Create flow to discovery position
    if (latestDiscovery.positionX !== undefined) {
      const endPoint = new THREE.Vector3(
        latestDiscovery.positionX * BRAIN_SCALE.x,
        latestDiscovery.positionY * BRAIN_SCALE.y,
        latestDiscovery.positionZ * BRAIN_SCALE.z
      )

      // Find nearest neighbor as start point, fallback to brain center
      const nearestNeighbor = spaceClusters
        ? findNearestNeighbor(endPoint, spaceClusters, latestDiscovery.spaceId)
        : null
      const startPoint = nearestNeighbor ?? new THREE.Vector3(0, 0, 0)

      // Control points for curved path between synapses
      const midpoint = startPoint.clone().add(endPoint).multiplyScalar(0.5)
      // Push curve outward from brain center for visual appeal
      const direction = midpoint.clone().normalize()
      const curveAmount = startPoint.distanceTo(endPoint) * 0.25
      midpoint.add(direction.multiplyScalar(curveAmount))

      const controlPoint1 = startPoint.clone().lerp(midpoint, 0.5)
      const controlPoint2 = midpoint.clone().lerp(endPoint, 0.5)

      const newFlow: ElectronFlow = {
        id: latestDiscovery.spaceId,
        startPoint,
        endPoint,
        controlPoint1,
        controlPoint2,
        startTime: scaledTimeRef.current,
        duration: FLOW_DURATION,
      }

      setActiveFlows(prev => [...prev.slice(-maxFlows + 1), newFlow])
    }
  }, [recentDiscoveries, spaceClusters, maxFlows])

  // Remove expired flows using scaled time
  useEffect(() => {
    const interval = setInterval(() => {
      const currentTime = scaledTimeRef.current
      setActiveFlows(prev => prev.filter(f => currentTime - f.startTime < f.duration))
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // Build geometry for all active flows
  const { positions, sizes, progresses } = useMemo(() => {
    const count = activeFlows.length * PARTICLES_PER_FLOW
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const progresses = new Float32Array(count)

    activeFlows.forEach((flow, flowIndex) => {
      for (let p = 0; p < PARTICLES_PER_FLOW; p++) {
        const i = flowIndex * PARTICLES_PER_FLOW + p
        const t = p / (PARTICLES_PER_FLOW - 1)

        const pos = cubicBezier(t, flow.startPoint, flow.controlPoint1, flow.controlPoint2, flow.endPoint)
        positions[i * 3] = pos.x
        positions[i * 3 + 1] = pos.y
        positions[i * 3 + 2] = pos.z

        sizes[i] = 4.0 + Math.sin(t * Math.PI) * 3.0
        progresses[i] = t
      }
    })

    return { positions, sizes, progresses }
  }, [activeFlows])

  // Update scaled time and animate along curves
  useFrame(({ clock }) => {
    // Update scaled time reference
    const realTime = clock.getElapsedTime()
    const delta = realTime - lastTimeRef.current
    lastTimeRef.current = realTime
    scaledTimeRef.current += delta * timeScale

    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = scaledTimeRef.current
    }

    // Animate particles along curves
    if (pointsRef.current && activeFlows.length > 0) {
      const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute
      const currentTime = scaledTimeRef.current

      activeFlows.forEach((flow, flowIndex) => {
        const elapsed = currentTime - flow.startTime
        const flowProgress = Math.min(elapsed / flow.duration, 1)

        for (let p = 0; p < PARTICLES_PER_FLOW; p++) {
          const i = flowIndex * PARTICLES_PER_FLOW + p
          // Stagger particles along the flow
          const particleT = Math.max(0, Math.min(1, flowProgress * 1.5 - (p / PARTICLES_PER_FLOW) * 0.5))

          const pos = cubicBezier(particleT, flow.startPoint, flow.controlPoint1, flow.controlPoint2, flow.endPoint)
          posAttr.setXYZ(i, pos.x, pos.y, pos.z)
        }
      })

      posAttr.needsUpdate = true
    }
  })

  if (activeFlows.length === 0) return null

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aProgress" args={[progresses, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={{ uTime: { value: 0 } }}
        vertexShader={ELECTRON_VERTEX_SHADER}
        fragmentShader={ELECTRON_FRAGMENT_SHADER}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
