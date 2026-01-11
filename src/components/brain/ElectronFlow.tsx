import { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SpaceCluster, SpaceDiscoveryEvent } from '@/types/agent'

const BRAIN_SCALE = { x: 1.3, y: 1.0, z: 1.1 }

interface ElectronFlowProps {
  recentDiscoveries: SpaceDiscoveryEvent[]
  spaceClusters: SpaceCluster[]
  maxParticlesPerPath?: number
  effectDuration?: number
}

interface ActiveEffect {
  id: string
  sourcePosition: THREE.Vector3
  paths: THREE.QuadraticBezierCurve3[]
  startTime: number
  duration: number
}

// Find nearby undiscovered clusters to create electron paths to
function findNearbyTargets(
  sourcePosition: THREE.Vector3,
  spaceClusters: SpaceCluster[],
  maxTargets: number = 5,
  maxDistance: number = 0.8
): THREE.Vector3[] {
  // Calculate distances to all clusters
  const withDistances = spaceClusters
    .filter(c => c.discoveredCount < c.spaceCount * 0.8) // Mostly undiscovered
    .map(cluster => {
      const pos = new THREE.Vector3(
        cluster.positionX * BRAIN_SCALE.x,
        cluster.positionY * BRAIN_SCALE.y,
        cluster.positionZ * BRAIN_SCALE.z
      )
      return {
        position: pos,
        distance: sourcePosition.distanceTo(pos)
      }
    })
    .filter(item => item.distance > 0.05 && item.distance <= maxDistance) // Not too close, not too far
    .sort((a, b) => a.distance - b.distance)

  // If not enough nearby, extend range
  if (withDistances.length < 3) {
    const extended = spaceClusters
      .map(cluster => {
        const pos = new THREE.Vector3(
          cluster.positionX * BRAIN_SCALE.x,
          cluster.positionY * BRAIN_SCALE.y,
          cluster.positionZ * BRAIN_SCALE.z
        )
        return {
          position: pos,
          distance: sourcePosition.distanceTo(pos)
        }
      })
      .filter(item => item.distance > 0.05)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxTargets)

    return extended.map(item => item.position)
  }

  return withDistances.slice(0, maxTargets).map(item => item.position)
}

// Generate bezier curve with organic arc
function generateBezierPath(
  source: THREE.Vector3,
  target: THREE.Vector3
): THREE.QuadraticBezierCurve3 {
  const mid = new THREE.Vector3().addVectors(source, target).multiplyScalar(0.5)
  const direction = new THREE.Vector3().subVectors(target, source).normalize()
  const distance = source.distanceTo(target)

  // Create perpendicular vector
  const up = new THREE.Vector3(0, 1, 0)
  let perpendicular = new THREE.Vector3().crossVectors(direction, up).normalize()

  if (perpendicular.length() < 0.1) {
    perpendicular = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(1, 0, 0)).normalize()
  }

  // Random arc direction
  const randomAngle = Math.random() * Math.PI * 2
  perpendicular.applyAxisAngle(direction, randomAngle)

  // Control point with arc
  const arcHeight = distance * 0.3 * (0.8 + Math.random() * 0.4)
  const controlPoint = mid.clone().add(perpendicular.multiplyScalar(arcHeight))

  return new THREE.QuadraticBezierCurve3(source, controlPoint, target)
}

// Vertex shader for electron particles
const VERTEX_SHADER = `
  attribute vec3 aPathStart;
  attribute vec3 aPathControl;
  attribute vec3 aPathEnd;
  attribute float aPathIndex;
  attribute float aLifetimeOffset;

  uniform float uTime;
  uniform float uEffectStartTime;
  uniform float uEffectDuration;

  varying float vProgress;
  varying float vPathIndex;
  varying float vAlpha;

  // Quadratic bezier evaluation
  vec3 bezier(vec3 p0, vec3 p1, vec3 p2, float t) {
    float oneMinusT = 1.0 - t;
    return oneMinusT * oneMinusT * p0 +
           2.0 * oneMinusT * t * p1 +
           t * t * p2;
  }

  void main() {
    float effectAge = uTime - uEffectStartTime;
    float effectProgress = clamp(effectAge / uEffectDuration, 0.0, 1.0);

    vec3 pathPosition;
    float particleSize;

    if (aPathIndex < 0.0) {
      // Burst particle - expand outward from source
      float burstProgress = min(effectProgress * 3.0, 1.0); // Complete burst in first third
      vec3 burstDir = normalize(position - aPathStart);
      float burstDist = 0.15 * burstProgress * (1.0 + aLifetimeOffset * 0.5);
      pathPosition = aPathStart + burstDir * burstDist;

      // Burst particles fade quickly
      vAlpha = (1.0 - burstProgress) * 0.8;
      particleSize = mix(10.0, 4.0, burstProgress);
      vProgress = 0.0;
    } else {
      // Trail particle - follow bezier path
      float travelStart = 0.1 + aLifetimeOffset * 0.25;
      float travelDuration = 0.75;

      float pathProgress = (effectProgress - travelStart) / travelDuration;
      pathProgress = clamp(pathProgress, 0.0, 1.0);

      // Ease-out for natural deceleration
      pathProgress = 1.0 - pow(1.0 - pathProgress, 2.0);

      pathPosition = bezier(aPathStart, aPathControl, aPathEnd, pathProgress);

      // Add jitter for electron "uncertainty"
      vec3 tangent = normalize(aPathEnd - aPathStart);
      vec3 up = vec3(0.0, 1.0, 0.0);
      vec3 perp1 = normalize(cross(tangent, up));
      vec3 perp2 = normalize(cross(tangent, perp1));

      float jitter = 0.015 * (1.0 - pathProgress);
      pathPosition += perp1 * sin(uTime * 25.0 + aLifetimeOffset * 100.0) * jitter;
      pathPosition += perp2 * cos(uTime * 30.0 + aLifetimeOffset * 100.0) * jitter;

      vProgress = pathProgress;

      // Fade: wait for travel to start, then fade near end
      float fadeIn = smoothstep(travelStart, travelStart + 0.1, effectProgress);
      float fadeOut = 1.0 - smoothstep(0.7, 0.95, pathProgress);
      vAlpha = fadeIn * fadeOut * 0.9;

      particleSize = mix(5.0, 2.5, pathProgress);
    }

    vPathIndex = aPathIndex;

    vec4 mvPosition = modelViewMatrix * vec4(pathPosition, 1.0);
    gl_PointSize = particleSize;
    gl_Position = projectionMatrix * mvPosition;
  }
`

// Fragment shader for electron particles
const FRAGMENT_SHADER = `
  varying float vProgress;
  varying float vPathIndex;
  varying float vAlpha;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    float softness = 1.0 - smoothstep(0.1, 0.5, dist);

    // Bright cyan core, fading to darker blue
    vec3 coreColor = vec3(0.4, 0.95, 1.0);
    vec3 edgeColor = vec3(0.1, 0.4, 0.8);
    vec3 color = mix(coreColor, edgeColor, vProgress * 0.6);

    // Add slight purple tint variation per path
    float pathTint = max(0.0, vPathIndex) * 0.08;
    color = mix(color, vec3(0.6, 0.4, 1.0), pathTint);

    // Bright core
    float core = smoothstep(0.25, 0.0, dist);
    color = mix(color, vec3(1.0), core * 0.6);

    float alpha = softness * vAlpha;

    gl_FragColor = vec4(color, alpha);
  }
`

// Individual effect renderer
function ElectronFlowEffect({
  effect,
  maxParticlesPerPath,
  onComplete
}: {
  effect: ActiveEffect
  maxParticlesPerPath: number
  onComplete: () => void
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const startTimeRef = useRef<number>(-1)

  const burstParticleCount = 60
  const totalParticles = effect.paths.length * maxParticlesPerPath + burstParticleCount

  // Generate particle attributes
  const particleData = useMemo(() => {
    const positions = new Float32Array(totalParticles * 3)
    const pathStarts = new Float32Array(totalParticles * 3)
    const pathControls = new Float32Array(totalParticles * 3)
    const pathEnds = new Float32Array(totalParticles * 3)
    const pathIndices = new Float32Array(totalParticles)
    const lifetimeOffsets = new Float32Array(totalParticles)

    let particleIdx = 0

    // Burst particles
    for (let i = 0; i < burstParticleCount; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 0.02 + Math.random() * 0.08

      positions[particleIdx * 3] = effect.sourcePosition.x + r * Math.sin(phi) * Math.cos(theta)
      positions[particleIdx * 3 + 1] = effect.sourcePosition.y + r * Math.cos(phi)
      positions[particleIdx * 3 + 2] = effect.sourcePosition.z + r * Math.sin(phi) * Math.sin(theta)

      pathStarts[particleIdx * 3] = effect.sourcePosition.x
      pathStarts[particleIdx * 3 + 1] = effect.sourcePosition.y
      pathStarts[particleIdx * 3 + 2] = effect.sourcePosition.z

      pathControls.set([effect.sourcePosition.x, effect.sourcePosition.y, effect.sourcePosition.z], particleIdx * 3)
      pathEnds.set([effect.sourcePosition.x, effect.sourcePosition.y, effect.sourcePosition.z], particleIdx * 3)

      pathIndices[particleIdx] = -1 // Mark as burst particle
      lifetimeOffsets[particleIdx] = Math.random()

      particleIdx++
    }

    // Path particles
    effect.paths.forEach((path, pathIdx) => {
      for (let i = 0; i < maxParticlesPerPath; i++) {
        const start = path.v0
        const control = path.v1
        const end = path.v2

        positions[particleIdx * 3] = start.x
        positions[particleIdx * 3 + 1] = start.y
        positions[particleIdx * 3 + 2] = start.z

        pathStarts[particleIdx * 3] = start.x
        pathStarts[particleIdx * 3 + 1] = start.y
        pathStarts[particleIdx * 3 + 2] = start.z

        pathControls[particleIdx * 3] = control.x
        pathControls[particleIdx * 3 + 1] = control.y
        pathControls[particleIdx * 3 + 2] = control.z

        pathEnds[particleIdx * 3] = end.x
        pathEnds[particleIdx * 3 + 1] = end.y
        pathEnds[particleIdx * 3 + 2] = end.z

        pathIndices[particleIdx] = pathIdx
        lifetimeOffsets[particleIdx] = Math.random()

        particleIdx++
      }
    })

    return { positions, pathStarts, pathControls, pathEnds, pathIndices, lifetimeOffsets }
  }, [effect, maxParticlesPerPath, totalParticles, burstParticleCount])

  useFrame((state) => {
    if (!materialRef.current) return

    const time = state.clock.elapsedTime

    if (startTimeRef.current < 0) {
      startTimeRef.current = time
    }

    const effectAge = time - startTimeRef.current

    materialRef.current.uniforms.uTime.value = time
    materialRef.current.uniforms.uEffectStartTime.value = startTimeRef.current

    if (effectAge > effect.duration) {
      onComplete()
    }
  })

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[particleData.positions, 3]} />
        <bufferAttribute attach="attributes-aPathStart" args={[particleData.pathStarts, 3]} />
        <bufferAttribute attach="attributes-aPathControl" args={[particleData.pathControls, 3]} />
        <bufferAttribute attach="attributes-aPathEnd" args={[particleData.pathEnds, 3]} />
        <bufferAttribute attach="attributes-aPathIndex" args={[particleData.pathIndices, 1]} />
        <bufferAttribute attach="attributes-aLifetimeOffset" args={[particleData.lifetimeOffsets, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={{
          uTime: { value: 0 },
          uEffectStartTime: { value: 0 },
          uEffectDuration: { value: effect.duration },
        }}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

export function ElectronFlow({
  recentDiscoveries = [],
  spaceClusters = [],
  maxParticlesPerPath = 25,
  effectDuration = 2.0
}: Partial<ElectronFlowProps> = {}) {
  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([])
  const processedDiscoveries = useRef<Set<string>>(new Set())

  // Watch for new discoveries
  useEffect(() => {
    if (!recentDiscoveries?.length || !spaceClusters?.length) return

    const newDiscoveries = recentDiscoveries.filter(d => {
      const key = `${d.spaceId}-${d.timestamp}`
      if (processedDiscoveries.current.has(key)) return false
      processedDiscoveries.current.add(key)
      return true
    })

    if (newDiscoveries.length === 0) return

    const newEffects = newDiscoveries.map(discovery => {
      // Find the cluster that contains this space (or closest match)
      // Since spaceId might not match clusterId directly, find nearest cluster
      const sourceCluster = spaceClusters.find(c => c.id === discovery.spaceId) ||
        spaceClusters[Math.floor(Math.random() * spaceClusters.length)]

      if (!sourceCluster) return null

      const sourcePosition = new THREE.Vector3(
        sourceCluster.positionX * BRAIN_SCALE.x,
        sourceCluster.positionY * BRAIN_SCALE.y,
        sourceCluster.positionZ * BRAIN_SCALE.z
      )

      const targetPositions = findNearbyTargets(sourcePosition, spaceClusters)
      const paths = targetPositions.map(targetPos => generateBezierPath(sourcePosition, targetPos))

      if (paths.length === 0) {
        // Create some random paths if no nearby targets
        const randomPaths = []
        for (let i = 0; i < 4; i++) {
          const randomTarget = new THREE.Vector3(
            sourcePosition.x + (Math.random() - 0.5) * 0.5,
            sourcePosition.y + (Math.random() - 0.5) * 0.5,
            sourcePosition.z + (Math.random() - 0.5) * 0.5
          )
          randomPaths.push(generateBezierPath(sourcePosition, randomTarget))
        }
        return {
          id: `${discovery.spaceId}-${discovery.timestamp}`,
          sourcePosition,
          paths: randomPaths,
          startTime: -1,
          duration: effectDuration
        }
      }

      return {
        id: `${discovery.spaceId}-${discovery.timestamp}`,
        sourcePosition,
        paths,
        startTime: -1,
        duration: effectDuration
      }
    }).filter(Boolean) as ActiveEffect[]

    if (newEffects.length > 0) {
      setActiveEffects(prev => [...prev, ...newEffects])
    }

    // Cleanup old processed entries
    if (processedDiscoveries.current.size > 200) {
      const entries = Array.from(processedDiscoveries.current)
      entries.slice(0, 100).forEach(e => processedDiscoveries.current.delete(e))
    }
  }, [recentDiscoveries, spaceClusters, effectDuration])

  return (
    <group>
      {activeEffects.map(effect => (
        <ElectronFlowEffect
          key={effect.id}
          effect={effect}
          maxParticlesPerPath={maxParticlesPerPath}
          onComplete={() => {
            setActiveEffects(prev => prev.filter(e => e.id !== effect.id))
          }}
        />
      ))}
    </group>
  )
}
