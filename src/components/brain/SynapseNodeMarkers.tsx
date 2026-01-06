import { useRef, useMemo, useCallback, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { SynapseNode, RevealPhase } from '@/types'

interface SynapseNodeMarkersProps {
  synapseNodes: SynapseNode[]
  userSynapseIds: string[]
  onSynapseClick?: (node: SynapseNode, position: THREE.Vector3) => void
  selectedSynapseId?: string | null
  revealPhase?: RevealPhase
  pendingSynapseId?: string | null
  opacity?: number // 0-1 for LOD cross-fade transitions
}

export function SynapseNodeMarkers({
  synapseNodes,
  userSynapseIds,
  onSynapseClick,
  selectedSynapseId,
  revealPhase = 'idle',
  pendingSynapseId,
  opacity = 1,
}: SynapseNodeMarkersProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const pendingPointRef = useRef<THREE.Points>(null)
  const pendingMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const { camera, raycaster, pointer } = useThree()

  const brainScale = useMemo(() => ({ x: 1.3, y: 1.0, z: 1.1 }), [])
  const brainRadius = 1.2

  // Filter to only connected nodes
  const connectedNodes = useMemo(
    () => synapseNodes.filter((node) => node.state === 'connected'),
    [synapseNodes]
  )

  // Find pending synapse for animation
  const pendingNode = useMemo(
    () => (pendingSynapseId ? synapseNodes.find((n) => n.id === pendingSynapseId) : null),
    [pendingSynapseId, synapseNodes]
  )

  // Calculate pending synapse position (must match main node positioning)
  const pendingPosition = useMemo(() => {
    if (!pendingNode) return null

    // Calculate rawLen to get depth variation
    const rawLen = Math.sqrt(
      pendingNode.position[0] * pendingNode.position[0] +
      pendingNode.position[1] * pendingNode.position[1] +
      pendingNode.position[2] * pendingNode.position[2]
    )

    // Preserve radial variation for volume distribution (0.35 to 1.1)
    const depthFactor = Math.max(0.35, Math.min(1.1, rawLen))

    // Normalize direction
    const nx = pendingNode.position[0] / rawLen
    const ny = pendingNode.position[1] / rawLen
    const nz = pendingNode.position[2] / rawLen

    // Scale to brain volume using depthFactor
    const x = nx * brainScale.x * brainRadius * depthFactor
    const y = ny * brainScale.y * brainRadius * depthFactor
    const z = nz * brainScale.z * brainRadius * depthFactor

    return new Float32Array([x, y, z])
  }, [pendingNode, brainScale, brainRadius])

  const userNodeSet = useMemo(() => new Set(userSynapseIds), [userSynapseIds])

  // Build positions, colors, sizes, and isUser flag for connected nodes
  const { positions, colors, sizes, isUserFlags, nodePositions } = useMemo(() => {
    const positions = new Float32Array(connectedNodes.length * 3)
    const colors = new Float32Array(connectedNodes.length * 3)
    const sizes = new Float32Array(connectedNodes.length)
    const isUserFlags = new Float32Array(connectedNodes.length)
    const nodePositions: THREE.Vector3[] = []

    connectedNodes.forEach((node, i) => {
      // Use position directly with brain scaling - preserve depth variation
      // Position is already in brain space from generation
      const rawLen = Math.sqrt(
        node.position[0] * node.position[0] +
        node.position[1] * node.position[1] +
        node.position[2] * node.position[2]
      )

      // Preserve the radial variation for volume distribution (rawLen varies from ~0.4 to ~1.0)
      const depthFactor = Math.max(0.35, Math.min(1.1, rawLen))

      // Normalize direction
      const nx = node.position[0] / rawLen
      const ny = node.position[1] / rawLen
      const nz = node.position[2] / rawLen

      // Scale to brain volume (not just surface) using depthFactor
      const x = nx * brainScale.x * brainRadius * depthFactor
      const y = ny * brainScale.y * brainRadius * depthFactor
      const z = nz * brainScale.z * brainRadius * depthFactor

      // Final position (no pushOut needed since we're in volume)
      const px = x
      const py = y
      const pz = z

      positions[i * 3] = px
      positions[i * 3 + 1] = py
      positions[i * 3 + 2] = pz
      nodePositions.push(new THREE.Vector3(px, py, pz))

      const isUserNode = userNodeSet.has(node.id)
      isUserFlags[i] = isUserNode ? 1.0 : 0.0

      // Cluster weight affects size - use log scale to handle huge weights
      const weight = node.clusterWeight ?? 1
      // Log scale: handles weights from 1 to 1,000,000+ gracefully
      // log10(1) = 0, log10(1000) = 3, log10(1000000) = 6
      const weightScale = 1.0 + Math.log10(Math.max(1, weight)) * 0.3

      if (isUserNode) {
        // Bright electric cyan for user's nodes
        colors[i * 3] = 0.2
        colors[i * 3 + 1] = 0.8
        colors[i * 3 + 2] = 0.8
        sizes[i] = 20.0
      } else {
        // Network nodes - subtle color variation by weight
        const normalizedWeight = Math.min(1, Math.log10(Math.max(1, weight)) / 6)
        colors[i * 3] = 0.25 + normalizedWeight * 0.3
        colors[i * 3 + 1] = 0.5 + normalizedWeight * 0.2
        colors[i * 3 + 2] = 0.65 - normalizedWeight * 0.2
        sizes[i] = 8.0 * weightScale // Base 8, moderate scaling
      }
    })

    return { positions, colors, sizes, isUserFlags, nodePositions }
  }, [connectedNodes, brainScale, brainRadius, userNodeSet])

  // Raycasting for hover detection
  const handlePointerMove = useCallback(() => {
    if (!pointsRef.current || connectedNodes.length === 0) return

    raycaster.setFromCamera(pointer, camera)

    // Check intersection with each synapse position
    let closestIndex: number | null = null
    let closestDist = 0.15 // Threshold distance for hover detection

    nodePositions.forEach((pos, i) => {
      const dist = raycaster.ray.distanceToPoint(pos)
      if (dist < closestDist) {
        closestDist = dist
        closestIndex = i
      }
    })

    if (closestIndex !== hoveredIndex) {
      setHoveredIndex(closestIndex)
      document.body.style.cursor = closestIndex !== null ? 'pointer' : 'auto'
    }
  }, [raycaster, pointer, camera, nodePositions, hoveredIndex, connectedNodes.length])

  const handleClick = useCallback(() => {
    if (hoveredIndex !== null && onSynapseClick) {
      const node = connectedNodes[hoveredIndex]
      const position = nodePositions[hoveredIndex]
      onSynapseClick(node, position)
    }
  }, [hoveredIndex, connectedNodes, nodePositions, onSynapseClick])

  // Map reveal phase to numeric value for shader
  const getPhaseValue = useCallback((phase: RevealPhase) => {
    switch (phase) {
      case 'locating':
        return 1.0
      case 'connecting':
        return 2.0
      case 'activating':
        return 3.0
      case 'complete':
        return 4.0
      default:
        return 0.0
    }
  }, [])

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime()
      materialRef.current.uniforms.uHoveredIndex.value = hoveredIndex ?? -1
      materialRef.current.uniforms.uCameraPosition.value.copy(camera.position)
      materialRef.current.uniforms.uOpacity.value = opacity
    }
    if (pendingMaterialRef.current) {
      pendingMaterialRef.current.uniforms.uTime.value = clock.getElapsedTime()
      pendingMaterialRef.current.uniforms.uPhase.value = getPhaseValue(revealPhase)
    }
    handlePointerMove()
  })

  const hoveredNode = hoveredIndex !== null ? connectedNodes[hoveredIndex] : null
  const hoveredPosition = hoveredIndex !== null ? nodePositions[hoveredIndex] : null

  // Check if we should show pending synapse animation
  const showPendingAnimation = pendingPosition && revealPhase !== 'idle'

  return (
    <group onClick={handleClick}>
      {/* Pending synapse animation during reveal */}
      {showPendingAnimation && pendingPosition && (
        <points key={`pending-${pendingSynapseId}`} ref={pendingPointRef} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={1}
              array={pendingPosition}
              itemSize={3}
            />
          </bufferGeometry>
          <shaderMaterial
            ref={pendingMaterialRef}
            uniforms={{
              uTime: { value: 0 },
              uPhase: { value: 0 },
            }}
            vertexShader={`
              uniform float uTime;
              uniform float uPhase;

              varying float vPhase;

              void main() {
                vPhase = uPhase;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

                // Size based on phase
                float baseSize = 25.0;
                float phaseScale = 1.0;

                if (uPhase == 1.0) {
                  // Locating - pulsing search
                  phaseScale = 0.5 + 0.5 * sin(uTime * 8.0);
                } else if (uPhase == 2.0) {
                  // Connecting - growing
                  phaseScale = 0.8 + 0.4 * sin(uTime * 4.0);
                } else if (uPhase == 3.0) {
                  // Activating - intense flash
                  phaseScale = 1.2 + 0.6 * sin(uTime * 12.0);
                } else if (uPhase == 4.0) {
                  // Complete - stable glow
                  phaseScale = 1.0 + 0.1 * sin(uTime * 2.0);
                }

                gl_PointSize = baseSize * phaseScale;
                gl_Position = projectionMatrix * mvPosition;
              }
            `}
            fragmentShader={`
              uniform float uTime;
              uniform float uPhase;

              varying float vPhase;

              void main() {
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);

                if (dist > 0.5) discard;

                // Phase-based colors
                vec3 locatingColor = vec3(0.3, 0.8, 1.0);   // Cyan search
                vec3 connectingColor = vec3(0.2, 1.0, 0.8); // Teal connect
                vec3 activatingColor = vec3(1.0, 1.0, 1.0); // White flash
                vec3 completeColor = vec3(0.2, 1.0, 1.0);   // Electric cyan

                vec3 color = locatingColor;
                float alpha = 0.0;

                if (vPhase == 1.0) {
                  // Locating - radar pulse effect
                  float radar = fract(uTime * 2.0);
                  float radarRing = smoothstep(radar - 0.1, radar, dist) * smoothstep(radar + 0.1, radar, dist);
                  color = locatingColor;
                  alpha = smoothstep(0.5, 0.0, dist) * 0.6 + radarRing * 0.8;
                } else if (vPhase == 2.0) {
                  // Connecting - growing core
                  float core = smoothstep(0.3, 0.0, dist);
                  float glow = smoothstep(0.5, 0.1, dist);
                  color = mix(connectingColor, vec3(1.0), core * 0.5);
                  alpha = glow * 0.8 + core * 0.2;
                } else if (vPhase == 3.0) {
                  // Activating - intense burst
                  float burst = smoothstep(0.5, 0.0, dist);
                  float flash = 0.5 + 0.5 * sin(uTime * 20.0);
                  color = mix(activatingColor, completeColor, 0.3);
                  alpha = burst * (0.8 + flash * 0.4);
                } else if (vPhase == 4.0) {
                  // Complete - stable user node style
                  float core = smoothstep(0.2, 0.0, dist);
                  float glow = smoothstep(0.5, 0.05, dist);
                  float ring = smoothstep(0.5, 0.42, dist) * smoothstep(0.32, 0.38, dist);
                  color = mix(completeColor, vec3(1.0), core * 0.85);
                  color = mix(color, vec3(0.3, 1.0, 1.0), ring * 0.7);
                  alpha = glow * 0.95 + ring * 0.6;
                }

                gl_FragColor = vec4(color, alpha);
              }
            `}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}

      {/* Existing connected synapse nodes */}
      {connectedNodes.length > 0 && (
        <points key={`nodes-${connectedNodes.length}`} ref={pointsRef} frustumCulled={false}>
        <bufferGeometry key={`geom-${connectedNodes.length}`}>
          <bufferAttribute
            attach="attributes-position"
            count={connectedNodes.length}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aColor"
            count={connectedNodes.length}
            array={colors}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aSize"
            count={connectedNodes.length}
            array={sizes}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aIsUser"
            count={connectedNodes.length}
            array={isUserFlags}
            itemSize={1}
          />
        </bufferGeometry>
        <shaderMaterial
          ref={materialRef}
          uniforms={{
            uTime: { value: 0 },
            uHoveredIndex: { value: -1 },
            uCameraPosition: { value: new THREE.Vector3(0, 0, 3) },
            uOpacity: { value: opacity },
          }}
          vertexShader={`
            attribute vec3 aColor;
            attribute float aSize;
            attribute float aIsUser;

            uniform float uTime;
            uniform float uHoveredIndex;
            uniform vec3 uCameraPosition;
            uniform float uOpacity;

            varying vec3 vColor;
            varying float vIsUser;
            varying float vHovered;
            varying float vDistScale;

            void main() {
              vColor = aColor;
              vIsUser = aIsUser;

              // Check if this vertex is hovered (approximate by index)
              float vertexIndex = float(gl_VertexID);
              vHovered = abs(vertexIndex - uHoveredIndex) < 0.5 ? 1.0 : 0.0;

              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

              // Distance-based scaling with LOD culling
              float distToCamera = distance(position, uCameraPosition);

              // LOD CULLING: Small points far away get culled (size = 0)
              // Large clusters (aSize > 50) always visible
              // Medium clusters visible within 3 units
              // Small clusters only visible within 1.5 units
              float lodThreshold = mix(1.5, 5.0, smoothstep(20.0, 80.0, aSize));
              float lodCull = step(distToCamera, lodThreshold);
              // User nodes never culled
              lodCull = max(lodCull, aIsUser);

              // Base scale: fade in as camera approaches
              float networkScale = smoothstep(4.0, 0.8, distToCamera);
              float userScale = smoothstep(5.5, 1.5, distToCamera);
              float distScale = mix(networkScale, userScale, aIsUser);

              // Close-up boost: moderate scaling when close
              float closeBoost = 1.0 + 2.0 * smoothstep(1.0, 0.4, distToCamera);
              float superCloseBoost = 1.0 + 3.0 * smoothstep(0.25, 0.05, distToCamera);
              distScale *= closeBoost * superCloseBoost;

              // Minimum visibility (but respect LOD culling)
              float minScale = mix(0.2, 0.4, aIsUser);
              distScale = max(distScale, minScale);

              vDistScale = distScale;

              // Synced pulsing
              float userPulse = 1.0 + 0.15 * sin(uTime * 3.0);
              float networkPulse = 1.0 + 0.03 * sin(uTime * 1.2);
              float pulse = mix(networkPulse, userPulse, aIsUser);

              // Hover scale boost
              float hoverScale = mix(1.0, 1.5, vHovered);

              // Apply LOD culling - size becomes 0 for culled points
              gl_PointSize = aSize * distScale * pulse * hoverScale * lodCull;
              gl_Position = projectionMatrix * mvPosition;
            }
          `}
          fragmentShader={`
            uniform float uOpacity;

            varying vec3 vColor;
            varying float vIsUser;
            varying float vHovered;
            varying float vDistScale;

            void main() {
              vec2 center = gl_PointCoord - vec2(0.5);
              float dist = length(center);

              // Discard outside circle
              if (dist > 0.5) discard;

              // Core glow
              float core = smoothstep(0.2, 0.0, dist);
              float glow = smoothstep(0.5, 0.05, dist);

              // Outer ring for user nodes (only when close enough)
              float ring = smoothstep(0.5, 0.42, dist) * smoothstep(0.32, 0.38, dist);
              ring *= smoothstep(0.3, 0.7, vDistScale); // Fade ring when far

              // Mix white core with colored glow - reduced intensity
              vec3 white = vec3(1.0, 1.0, 1.0);
              vec3 ringColor = vec3(0.3, 0.9, 0.9);

              // Base color with subtle white core
              vec3 color = mix(vColor, white, core * 0.5 * vDistScale);

              // Add ring for user nodes
              color = mix(color, ringColor, ring * vIsUser * 0.7);

              // Brighten on hover
              color = mix(color, white, vHovered * 0.3);

              // Alpha scales with distance - fades when far
              float baseAlpha = mix(0.35, 0.7, vIsUser);
              float distAlpha = mix(0.25, 0.75, vDistScale); // Fade alpha when far
              float alpha = glow * baseAlpha * distAlpha;

              // Ring adds to alpha
              alpha = max(alpha, ring * vIsUser * 0.6);

              // Apply LOD transition opacity
              gl_FragColor = vec4(color, alpha * uOpacity);
            }
          `}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      )}

      {/* Tooltip for hovered synapse */}
      {hoveredNode && hoveredPosition && (
        <Html
          position={[hoveredPosition.x, hoveredPosition.y + 0.18, hoveredPosition.z]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background-secondary)] px-3 py-2 shadow-lg whitespace-nowrap">
            <div className="flex items-center gap-2 mb-1">
              <div
                className={`h-2 w-2 rounded-full ${
                  userNodeSet.has(hoveredNode.id)
                    ? 'bg-[var(--brand-teal-1)]'
                    : 'bg-[var(--text-muted)]'
                }`}
              />
              <span className="text-xs font-medium text-[var(--text-primary)]">
                {userNodeSet.has(hoveredNode.id) ? 'Your Synapse' : 'Network Synapse'}
              </span>
            </div>
            <div className="text-[10px] text-[var(--text-secondary)]">
              <div>Region: <span className="capitalize text-[var(--text-primary)]">{hoveredNode.region}</span></div>
              {hoveredNode.connectedBy && (
                <div>By: <span className="font-mono text-[var(--text-primary)]">{hoveredNode.connectedBy}</span></div>
              )}
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}
