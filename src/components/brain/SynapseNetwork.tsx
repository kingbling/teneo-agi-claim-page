import { useRef, useMemo, memo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SpaceCluster, NetworkConnection } from '@/types/agent'
import { useAgentStore } from '@/stores/agentStore'
import { NETWORK_SPEEDS, getNetworkSpeedMultiplier } from '@/types/agent'

const BRAIN_SCALE = { x: 1.3, y: 1.0, z: 1.1 }
const CURVE_SEGMENTS = 24  // Segments per bezier curve

interface SynapseNetworkProps {
  spaceClusters: SpaceCluster[]
  maxConnectionDistance?: number
  particlesPerConnection?: number
  opacity?: number
}

interface Connection {
  from: THREE.Vector3
  to: THREE.Vector3
  midpoint: THREE.Vector3  // For bezier curve
  distance: number
  fromRatio: number
  toRatio: number
  useCount: number
  speedMultiplier: number
  brightness: number
}

interface DiscoveredNode {
  position: THREE.Vector3
  discoveryRatio: number
  spaceCount: number
}

// Build network with curved bezier midpoints
// Now shows ALL synapses, not just discovered ones - undiscovered appear dimmer
function buildNetwork(
  clusters: SpaceCluster[],
  networkConnections: NetworkConnection[],
  maxDistance: number
): { nodes: DiscoveredNode[]; connections: Connection[] } {
  // Use all clusters, not just discovered ones
  const nodes: DiscoveredNode[] = clusters.map(c => ({
    position: new THREE.Vector3(
      c.positionX * BRAIN_SCALE.x,
      c.positionY * BRAIN_SCALE.y,
      c.positionZ * BRAIN_SCALE.z
    ),
    discoveryRatio: c.discoveredCount / Math.max(1, c.spaceCount),
    spaceCount: c.spaceCount
  }))

  if (clusters.length < 2) return { nodes, connections: [] }

  const networkMap = new Map<string, NetworkConnection>()
  networkConnections.forEach(nc => {
    networkMap.set(`${nc.fromSpaceId}-${nc.toSpaceId}`, nc)
    networkMap.set(`${nc.toSpaceId}-${nc.fromSpaceId}`, nc)
  })

  const connections: Connection[] = []
  const connectionSet = new Set<string>()

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const distance = nodes[i].position.distanceTo(nodes[j].position)

      if (distance <= maxDistance) {
        const key = `${i}-${j}`
        if (!connectionSet.has(key)) {
          connectionSet.add(key)

          const avgDiscoveryRatio = (nodes[i].discoveryRatio + nodes[j].discoveryRatio) / 2
          const simulatedUseCount = Math.floor(avgDiscoveryRatio * NETWORK_SPEEDS.USE_COUNT_FOR_MAX * 0.5)
          const speedMultiplier = getNetworkSpeedMultiplier(simulatedUseCount)
          // Undiscovered connections are dimmer (0.15 base), discovered get brighter (up to 1.0)
          const baseBrightness = avgDiscoveryRatio > 0 ? 0.3 : 0.15
          const brightness = baseBrightness + (speedMultiplier - 1.0) / (NETWORK_SPEEDS.ON_NETWORK_MAX - 1.0) * 0.7

          // Calculate curved midpoint - push outward from brain center
          const midpoint = nodes[i].position.clone().add(nodes[j].position).multiplyScalar(0.5)
          const direction = midpoint.clone().normalize()
          // Curve amount based on distance - longer connections curve more
          const curveAmount = 0.08 + distance * 0.05
          midpoint.add(direction.multiplyScalar(curveAmount))

          connections.push({
            from: nodes[i].position.clone(),
            to: nodes[j].position.clone(),
            midpoint,
            distance,
            fromRatio: nodes[i].discoveryRatio,
            toRatio: nodes[j].discoveryRatio,
            useCount: simulatedUseCount,
            speedMultiplier,
            brightness
          })
        }
      }
    }
  }

  return { nodes, connections }
}

// Vertex shader for glowing bezier curves with animated dash
const CURVE_VERTEX_SHADER = `
  attribute float aProgress;
  attribute float aBrightness;
  attribute float aSpeedMultiplier;
  attribute float aConnectionIndex;

  uniform float uTime;

  varying float vProgress;
  varying float vBrightness;
  varying float vSpeedMultiplier;
  varying float vConnectionIndex;

  void main() {
    vProgress = aProgress;
    vBrightness = aBrightness;
    vSpeedMultiplier = aSpeedMultiplier;
    vConnectionIndex = aConnectionIndex;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Fragment shader for glowing animated dash pattern - like electric synapses
const CURVE_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uOpacity;

  varying float vProgress;
  varying float vBrightness;
  varying float vSpeedMultiplier;
  varying float vConnectionIndex;

  void main() {
    // Animated dash pattern - scrolling electricity effect
    float dashSpeed = 0.8 + vSpeedMultiplier * 0.3;
    float dashFreq = 12.0 + vBrightness * 8.0;  // More dashes on bright paths
    float phase = vConnectionIndex * 1.37;  // Unique phase per connection

    // Create flowing dash animation
    float dashPattern = sin((vProgress - uTime * dashSpeed + phase) * dashFreq * 3.14159);
    float dash = smoothstep(-0.2, 0.5, dashPattern);

    // Add secondary faster dash for sparkle effect
    float sparkle = sin((vProgress - uTime * dashSpeed * 2.5 + phase) * dashFreq * 2.0 * 3.14159);
    float sparkleMask = smoothstep(0.3, 0.8, sparkle) * 0.3;

    // Color gradient: cyan core → blue edges, brighter with usage
    vec3 cyanCore = vec3(0.46, 0.9, 0.92);     // Bright cyan
    vec3 blueEdge = vec3(0.0, 0.27, 1.0);      // Deep blue
    vec3 whiteCore = vec3(0.9, 1.0, 1.0);      // Almost white for hot paths

    // Mix based on progress along line for gradient effect
    vec3 baseColor = mix(cyanCore, blueEdge, vProgress);

    // Brighten based on usage (Death Stranding style)
    baseColor = mix(baseColor, whiteCore, vBrightness * 0.5);

    // Add sparkle highlights
    baseColor += sparkleMask * vec3(0.3, 0.5, 0.5) * vBrightness;

    // Pulsing glow effect
    float pulse = 0.7 + 0.3 * sin(uTime * (2.0 + vSpeedMultiplier) + vConnectionIndex);

    // Alpha based on dash pattern and brightness - increased for visibility
    float alpha = dash * (0.25 + vBrightness * 0.45) * pulse;

    // Constant glow layer for visibility even without dash
    float constantGlow = 0.08 + vBrightness * 0.12;
    alpha = max(alpha, constantGlow);

    gl_FragColor = vec4(baseColor * pulse, alpha * uOpacity);
  }
`

// Vertex shader for discovered node markers (gold) - enhanced glow
const NODE_VERTEX_SHADER = `
  attribute float aDiscoveryRatio;
  attribute float aSpaceCount;

  uniform float uTime;
  uniform vec3 uCameraPosition;

  varying float vDiscoveryRatio;
  varying float vDistScale;

  void main() {
    vDiscoveryRatio = aDiscoveryRatio;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float distToCamera = distance(position, uCameraPosition);

    // Match camera range (1.5 to 6.0) - allow full scaling when zoomed in
    float distScale = smoothstep(6.0, 1.5, distToCamera);
    vDistScale = distScale;

    // Stronger pulse for discovered nodes
    float pulse = 1.0 + 0.3 * sin(uTime * 3.0 + position.x * 10.0);

    // Larger base size for better visibility
    float baseSize = 14.0 + aDiscoveryRatio * 20.0 + log(aSpaceCount + 1.0) * 3.0;

    gl_PointSize = baseSize * max(0.1, vDistScale) * pulse;
    gl_Position = projectionMatrix * mvPosition;
  }
`

// Fragment shader for discovered node markers - enhanced gold glow
const NODE_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uOpacity;

  varying float vDiscoveryRatio;
  varying float vDistScale;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    // Core and glow layers
    float core = smoothstep(0.15, 0.0, dist);
    float glow = smoothstep(0.5, 0.0, dist);
    float ring = smoothstep(0.5, 0.35, dist) * smoothstep(0.25, 0.32, dist);
    float outerGlow = smoothstep(0.5, 0.3, dist);

    // Gold/amber color gradient - more vibrant
    vec3 whiteCore = vec3(1.0, 1.0, 0.95);    // Bright white-gold center
    vec3 goldCore = vec3(1.0, 0.9, 0.5);      // Bright gold
    vec3 amber = vec3(1.0, 0.6, 0.1);         // Amber glow
    vec3 orangeGlow = vec3(0.9, 0.4, 0.05);   // Outer orange

    // Mix based on distance from center
    vec3 color = mix(goldCore, whiteCore, core);
    color = mix(amber, color, glow);
    color = mix(orangeGlow, color, outerGlow);

    // Brighter for higher discovery ratio
    color = mix(color, vec3(1.0, 1.0, 0.9), vDiscoveryRatio * core * 0.7);

    // Pulsing ring effect - only for discovered nodes
    float ringPulse = 0.5 + 0.5 * sin(uTime * 4.0);
    color += ring * vec3(1.0, 0.85, 0.3) * ringPulse * 0.8 * vDiscoveryRatio;

    // Scale alpha with distance to prevent overexposure when zoomed in
    float alpha = glow * (0.15 + vDiscoveryRatio * 0.35) * max(0.2, vDistScale);
    alpha = max(alpha, 0.02);  // Tiny minimum to prevent complete invisibility

    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`

// Vertex shader for electron particles flowing along curves
const ELECTRON_VERTEX_SHADER = `
  attribute float aConnectionIndex;
  attribute float aParticleIndex;
  attribute vec3 aStartPos;
  attribute vec3 aMidPos;
  attribute vec3 aEndPos;
  attribute float aSpeedMultiplier;
  attribute float aBrightness;

  uniform float uTime;
  uniform vec3 uCameraPosition;

  varying float vAlpha;
  varying float vProgress;
  varying float vDistScale;
  varying float vBrightness;
  varying float vSpeedMultiplier;

  // Quadratic bezier interpolation
  vec3 bezier(vec3 p0, vec3 p1, vec3 p2, float t) {
    float t1 = 1.0 - t;
    return t1 * t1 * p0 + 2.0 * t1 * t * p1 + t * t * p2;
  }

  void main() {
    float phase = aConnectionIndex * 0.37 + aParticleIndex * 0.23;

    // Speed scales with usage
    float baseSpeed = 0.5;
    float speed = baseSpeed * aSpeedMultiplier;
    float progress = fract(uTime * speed + phase);

    // Bidirectional flow
    float direction = mod(aParticleIndex, 2.0) < 1.0 ? 1.0 : -1.0;
    if (direction < 0.0) {
      progress = 1.0 - progress;
    }

    // Position along bezier curve
    vec3 pos = bezier(aStartPos, aMidPos, aEndPos, progress);

    // Add perpendicular wave motion
    vec3 tangent = normalize(2.0 * (1.0 - progress) * (aMidPos - aStartPos) + 2.0 * progress * (aEndPos - aMidPos));
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 perp = normalize(cross(tangent, up));
    if (length(perp) < 0.1) {
      perp = normalize(cross(tangent, vec3(1.0, 0.0, 0.0)));
    }

    float waveAmount = 0.015 + 0.01 * aSpeedMultiplier;
    float wave = sin(progress * 6.28318 * 3.0 + uTime * 5.0 + phase * 10.0) * waveAmount;
    pos += perp * wave;

    vProgress = progress;
    vBrightness = aBrightness;
    vSpeedMultiplier = aSpeedMultiplier;

    // Match camera range (1.5 to 6.0) - allow full scaling when zoomed in
    float distToCamera = distance(pos, uCameraPosition);
    float distScale = smoothstep(6.0, 1.5, distToCamera);
    vDistScale = distScale;

    // Fade at ends
    float fadeIn = smoothstep(0.0, 0.12, progress);
    float fadeOut = smoothstep(1.0, 0.88, progress);
    vAlpha = fadeIn * fadeOut;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // Scale particles with distance to prevent overexposure when zoomed in
    float usageScale = 1.0 + (aSpeedMultiplier - 1.0) * 0.4;
    float size = (6.0 + sin(progress * 3.14159) * 3.0) * max(0.15, vDistScale) * usageScale;
    gl_PointSize = size;

    gl_Position = projectionMatrix * mvPosition;
  }
`

// Fragment shader for electron particles - bright cyan glow
const ELECTRON_FRAGMENT_SHADER = `
  uniform float uOpacity;
  uniform float uTime;

  varying float vAlpha;
  varying float vProgress;
  varying float vDistScale;
  varying float vBrightness;
  varying float vSpeedMultiplier;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    // Bright core with soft glow
    float core = smoothstep(0.2, 0.0, dist);
    float glow = smoothstep(0.5, 0.0, dist);
    float ring = smoothstep(0.5, 0.35, dist) * smoothstep(0.2, 0.3, dist);

    // Pulse effect
    float pulseSpeed = 3.0 + vSpeedMultiplier;
    float pulse = 0.7 + 0.3 * sin(uTime * pulseSpeed + vProgress * 6.28318);

    // Bright cyan to white gradient based on usage
    vec3 cyanGlow = vec3(0.3, 0.9, 1.0);
    vec3 whiteCore = vec3(0.95, 1.0, 1.0);
    vec3 blueOuter = vec3(0.1, 0.4, 0.8);

    vec3 color = mix(blueOuter, cyanGlow, glow);
    color = mix(color, whiteCore, core * vBrightness);

    // Ring highlight
    color += ring * vec3(0.3, 0.7, 1.0) * pulse * 0.5;

    // Shimmer effect
    float shimmer = 0.85 + 0.15 * sin(uTime * 6.0 + vProgress * 12.56637);
    color *= shimmer;

    // Scale alpha with distance to prevent overexposure when zoomed in
    float alpha = glow * vAlpha * uOpacity * (0.2 + vBrightness * 0.2) * pulse * max(0.15, vDistScale);
    alpha = max(alpha, 0.01);  // Tiny minimum

    gl_FragColor = vec4(color, alpha);
  }
`

export const SynapseNetwork = memo(function SynapseNetwork({
  spaceClusters,
  maxConnectionDistance = 2.0,
  particlesPerConnection = 16,
  opacity = 1
}: SynapseNetworkProps) {
  const nodeMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const curveMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const electronMaterialRef = useRef<THREE.ShaderMaterial>(null)

  const networkConnections = useAgentStore((state) => state.networkConnections)

  const network = useMemo(() => {
    return buildNetwork(spaceClusters, networkConnections, maxConnectionDistance)
  }, [spaceClusters, networkConnections, maxConnectionDistance])

  // Generate bezier curve geometry for all connections
  const curveData = useMemo(() => {
    if (network.connections.length === 0) return null

    const totalVertices = network.connections.length * CURVE_SEGMENTS
    const positions = new Float32Array(totalVertices * 3)
    const progresses = new Float32Array(totalVertices)
    const brightnesses = new Float32Array(totalVertices)
    const speedMultipliers = new Float32Array(totalVertices)
    const connectionIndices = new Float32Array(totalVertices)
    const indices: number[] = []

    let vertexIdx = 0
    network.connections.forEach((conn, connIdx) => {
      const curve = new THREE.QuadraticBezierCurve3(conn.from, conn.midpoint, conn.to)
      const points = curve.getPoints(CURVE_SEGMENTS - 1)

      const startVertexIdx = vertexIdx
      points.forEach((point, i) => {
        positions[vertexIdx * 3] = point.x
        positions[vertexIdx * 3 + 1] = point.y
        positions[vertexIdx * 3 + 2] = point.z
        progresses[vertexIdx] = i / (CURVE_SEGMENTS - 1)
        brightnesses[vertexIdx] = conn.brightness
        speedMultipliers[vertexIdx] = conn.speedMultiplier
        connectionIndices[vertexIdx] = connIdx

        // Create line segments
        if (i > 0) {
          indices.push(startVertexIdx + i - 1, startVertexIdx + i)
        }
        vertexIdx++
      })
    })

    return {
      positions,
      progresses,
      brightnesses,
      speedMultipliers,
      connectionIndices,
      indices: new Uint32Array(indices),
      count: totalVertices
    }
  }, [network.connections])

  // Generate node marker data
  const nodeData = useMemo(() => {
    if (network.nodes.length === 0) return null

    const positions = new Float32Array(network.nodes.length * 3)
    const discoveryRatios = new Float32Array(network.nodes.length)
    const spaceCounts = new Float32Array(network.nodes.length)

    network.nodes.forEach((node, i) => {
      positions[i * 3] = node.position.x
      positions[i * 3 + 1] = node.position.y
      positions[i * 3 + 2] = node.position.z
      discoveryRatios[i] = node.discoveryRatio
      spaceCounts[i] = node.spaceCount
    })

    return { positions, discoveryRatios, spaceCounts, count: network.nodes.length }
  }, [network.nodes])

  // Generate electron particle data with bezier midpoints
  const electronData = useMemo(() => {
    if (network.connections.length === 0) return null

    const totalParticles = network.connections.length * particlesPerConnection

    const positions = new Float32Array(totalParticles * 3)
    const connectionIndices = new Float32Array(totalParticles)
    const particleIndices = new Float32Array(totalParticles)
    const startPositions = new Float32Array(totalParticles * 3)
    const midPositions = new Float32Array(totalParticles * 3)
    const endPositions = new Float32Array(totalParticles * 3)
    const speedMultipliers = new Float32Array(totalParticles)
    const brightnesses = new Float32Array(totalParticles)

    let particleIdx = 0
    network.connections.forEach((conn, connIdx) => {
      for (let i = 0; i < particlesPerConnection; i++) {
        positions[particleIdx * 3] = conn.from.x
        positions[particleIdx * 3 + 1] = conn.from.y
        positions[particleIdx * 3 + 2] = conn.from.z

        connectionIndices[particleIdx] = connIdx
        particleIndices[particleIdx] = i

        startPositions[particleIdx * 3] = conn.from.x
        startPositions[particleIdx * 3 + 1] = conn.from.y
        startPositions[particleIdx * 3 + 2] = conn.from.z

        midPositions[particleIdx * 3] = conn.midpoint.x
        midPositions[particleIdx * 3 + 1] = conn.midpoint.y
        midPositions[particleIdx * 3 + 2] = conn.midpoint.z

        endPositions[particleIdx * 3] = conn.to.x
        endPositions[particleIdx * 3 + 1] = conn.to.y
        endPositions[particleIdx * 3 + 2] = conn.to.z

        speedMultipliers[particleIdx] = conn.speedMultiplier
        brightnesses[particleIdx] = conn.brightness

        particleIdx++
      }
    })

    return {
      positions,
      connectionIndices,
      particleIndices,
      startPositions,
      midPositions,
      endPositions,
      speedMultipliers,
      brightnesses,
      count: totalParticles
    }
  }, [network.connections, particlesPerConnection])

  // Time scaling for trance mode
  const userAgents = useAgentStore((state) => state.userAgents)
  const timeScale = userAgents.some(a => a.tranceActive) ? 0.05 : 1.0
  const scaledTimeRef = useRef(0)
  const lastTimeRef = useRef(0)

  useFrame(({ clock, camera }) => {
    const realTime = clock.getElapsedTime()
    const deltaTime = realTime - lastTimeRef.current
    lastTimeRef.current = realTime
    scaledTimeRef.current += deltaTime * timeScale
    const time = scaledTimeRef.current

    if (nodeMaterialRef.current) {
      nodeMaterialRef.current.uniforms.uTime.value = time
      nodeMaterialRef.current.uniforms.uOpacity.value = opacity
      nodeMaterialRef.current.uniforms.uCameraPosition.value.copy(camera.position)
    }
    if (curveMaterialRef.current) {
      curveMaterialRef.current.uniforms.uTime.value = time
      curveMaterialRef.current.uniforms.uOpacity.value = opacity
    }
    if (electronMaterialRef.current) {
      electronMaterialRef.current.uniforms.uTime.value = time
      electronMaterialRef.current.uniforms.uOpacity.value = opacity
      electronMaterialRef.current.uniforms.uCameraPosition.value.copy(camera.position)
    }
  })

  return (
    <group>
      {/* Glowing bezier curve connections with animated dash pattern */}
      {curveData && curveData.count > 0 && (
        <lineSegments frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[curveData.positions, 3]}
            />
            <bufferAttribute
              attach="attributes-aProgress"
              args={[curveData.progresses, 1]}
            />
            <bufferAttribute
              attach="attributes-aBrightness"
              args={[curveData.brightnesses, 1]}
            />
            <bufferAttribute
              attach="attributes-aSpeedMultiplier"
              args={[curveData.speedMultipliers, 1]}
            />
            <bufferAttribute
              attach="attributes-aConnectionIndex"
              args={[curveData.connectionIndices, 1]}
            />
            <bufferAttribute
              attach="index"
              args={[curveData.indices, 1]}
            />
          </bufferGeometry>
          <shaderMaterial
            ref={curveMaterialRef}
            uniforms={{
              uTime: { value: 0 },
              uOpacity: { value: opacity },
            }}
            vertexShader={CURVE_VERTEX_SHADER}
            fragmentShader={CURVE_FRAGMENT_SHADER}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>
      )}

      {/* Discovered node markers (gold) */}
      {nodeData && nodeData.count > 0 && (
        <points frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[nodeData.positions, 3]}
            />
            <bufferAttribute
              attach="attributes-aDiscoveryRatio"
              args={[nodeData.discoveryRatios, 1]}
            />
            <bufferAttribute
              attach="attributes-aSpaceCount"
              args={[nodeData.spaceCounts, 1]}
            />
          </bufferGeometry>
          <shaderMaterial
            ref={nodeMaterialRef}
            uniforms={{
              uTime: { value: 0 },
              uOpacity: { value: opacity },
              uCameraPosition: { value: new THREE.Vector3(0, 0, 5) },
            }}
            vertexShader={NODE_VERTEX_SHADER}
            fragmentShader={NODE_FRAGMENT_SHADER}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}

      {/* Electron particles flowing along bezier curves */}
      {electronData && electronData.count > 0 && (
        <points frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[electronData.positions, 3]}
            />
            <bufferAttribute
              attach="attributes-aConnectionIndex"
              args={[electronData.connectionIndices, 1]}
            />
            <bufferAttribute
              attach="attributes-aParticleIndex"
              args={[electronData.particleIndices, 1]}
            />
            <bufferAttribute
              attach="attributes-aStartPos"
              args={[electronData.startPositions, 3]}
            />
            <bufferAttribute
              attach="attributes-aMidPos"
              args={[electronData.midPositions, 3]}
            />
            <bufferAttribute
              attach="attributes-aEndPos"
              args={[electronData.endPositions, 3]}
            />
            <bufferAttribute
              attach="attributes-aSpeedMultiplier"
              args={[electronData.speedMultipliers, 1]}
            />
            <bufferAttribute
              attach="attributes-aBrightness"
              args={[electronData.brightnesses, 1]}
            />
          </bufferGeometry>
          <shaderMaterial
            ref={electronMaterialRef}
            uniforms={{
              uTime: { value: 0 },
              uOpacity: { value: opacity },
              uCameraPosition: { value: new THREE.Vector3(0, 0, 5) },
            }}
            vertexShader={ELECTRON_VERTEX_SHADER}
            fragmentShader={ELECTRON_FRAGMENT_SHADER}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}
    </group>
  )
})
