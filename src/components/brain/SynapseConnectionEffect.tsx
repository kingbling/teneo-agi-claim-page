import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SynapseNode, RevealPhase } from '@/types'

// Configuration
const MAX_CONNECTION_DISTANCE = 0.5
const MAX_CONNECTIONS = 3
const SPARK_COUNT = 200

// Spark types
interface Spark {
  position: THREE.Vector3
  velocity: THREE.Vector3
  origin: THREE.Vector3
  target: THREE.Vector3 | null
  life: number
  maxLife: number
  size: number
  type: 'orbit' | 'beam' | 'burst' | 'ambient'
  beamProgress: number
  delay: number
}

interface Props {
  synapseNodes: SynapseNode[]
  pendingSynapseId: string | null
  revealPhase: RevealPhase
}

export function SynapseConnectionEffect({ synapseNodes, pendingSynapseId, revealPhase }: Props) {
  const brainScale = { x: 1.3, y: 1.0, z: 1.1 }
  const brainRadius = 1.2
  const pushOut = 0.05

  // Don't render anything when idle
  if (revealPhase === 'idle' || !pendingSynapseId) {
    return null
  }

  // Find pending node
  const pendingNode = synapseNodes.find((n) => n.id === pendingSynapseId)
  if (!pendingNode) return null

  // Calculate pending position (normalized to brain surface)
  const rawLen = Math.sqrt(
    pendingNode.position[0] ** 2 +
    pendingNode.position[1] ** 2 +
    pendingNode.position[2] ** 2
  )
  const nx = pendingNode.position[0] / rawLen
  const ny = pendingNode.position[1] / rawLen
  const nz = pendingNode.position[2] / rawLen

  const px = nx * brainScale.x * brainRadius
  const py = ny * brainScale.y * brainRadius
  const pz = nz * brainScale.z * brainRadius
  const pLen = Math.sqrt(px * px + py * py + pz * pz)
  const pendingPos = new THREE.Vector3(
    px + (px / pLen) * pushOut,
    py + (py / pLen) * pushOut,
    pz + (pz / pLen) * pushOut
  )

  // Find nearby connected nodes
  const nearbyNodes = synapseNodes
    .filter((n) => n.state === 'connected')
    .map((node) => {
      const dx = node.position[0] - pendingNode.position[0]
      const dy = node.position[1] - pendingNode.position[1]
      const dz = node.position[2] - pendingNode.position[2]
      const rawDist = Math.sqrt(dx * dx + dy * dy + dz * dz)

      const nodeRawLen = Math.sqrt(
        node.position[0] ** 2 + node.position[1] ** 2 + node.position[2] ** 2
      )
      const nnx = node.position[0] / nodeRawLen
      const nny = node.position[1] / nodeRawLen
      const nnz = node.position[2] / nodeRawLen

      const x = nnx * brainScale.x * brainRadius
      const y = nny * brainScale.y * brainRadius
      const z = nnz * brainScale.z * brainRadius
      const len = Math.sqrt(x * x + y * y + z * z)

      return {
        id: node.id,
        pos: new THREE.Vector3(
          x + (x / len) * pushOut,
          y + (y / len) * pushOut,
          z + (z / len) * pushOut
        ),
        dist: rawDist,
      }
    })
    .filter((n) => n.dist <= MAX_CONNECTION_DISTANCE)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, MAX_CONNECTIONS)

  return (
    <group>
      {/* Core glow at synapse position */}
      <CoreGlow position={pendingPos} phase={revealPhase} />

      {/* Spark particle system */}
      <SparkSystem
        origin={pendingPos}
        targets={nearbyNodes.map((n) => n.pos)}
        phase={revealPhase}
      />

      {/* Electric beams during connecting+ phases */}
      {(revealPhase === 'connecting' || revealPhase === 'activating' || revealPhase === 'complete') &&
        nearbyNodes.map((node, i) => (
          <ElectricBeam
            key={node.id}
            start={pendingPos}
            end={node.pos}
            phase={revealPhase}
            delay={i * 0.15}
          />
        ))}
    </group>
  )
}

// Core glow component
function CoreGlow({ position, phase }: { position: THREE.Vector3; phase: RevealPhase }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!meshRef.current || !glowRef.current) return
    const t = clock.getElapsedTime()

    let coreScale = 0.08
    let glowScale = 0.2
    let glowOpacity = 0.5

    if (phase === 'locating') {
      coreScale = 0.05 + 0.03 * Math.sin(t * 8)
      glowScale = 0.12 + 0.06 * Math.sin(t * 8)
      glowOpacity = 0.3 + 0.2 * Math.sin(t * 8)
    } else if (phase === 'connecting') {
      coreScale = 0.07 + 0.02 * Math.sin(t * 4)
      glowScale = 0.18 + 0.04 * Math.sin(t * 4)
      glowOpacity = 0.5
    } else if (phase === 'activating') {
      coreScale = 0.12 + 0.05 * Math.sin(t * 15)
      glowScale = 0.3 + 0.1 * Math.sin(t * 15)
      glowOpacity = 0.8 + 0.2 * Math.sin(t * 20)
    } else if (phase === 'complete') {
      coreScale = 0.09
      glowScale = 0.2
      glowOpacity = 0.6
    }

    meshRef.current.scale.setScalar(coreScale)
    glowRef.current.scale.setScalar(glowScale)

    const glowMat = glowRef.current.material as THREE.MeshBasicMaterial
    glowMat.opacity = glowOpacity
  })

  const coreColor = phase === 'activating' ? '#ffffff' : '#4DF0FF'
  const glowColor = phase === 'activating' ? '#ffffff' : '#00D4FF'

  return (
    <group position={position}>
      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.5} />
      </mesh>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={coreColor} transparent opacity={1} />
      </mesh>
    </group>
  )
}

// Spark particle system using instanced mesh
function SparkSystem({
  origin,
  targets,
  phase,
}: {
  origin: THREE.Vector3
  targets: THREE.Vector3[]
  phase: RevealPhase
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const sparksRef = useRef<Spark[]>([])
  const startTimeRef = useRef<number | null>(null)
  const lastPhaseRef = useRef<RevealPhase>(phase)

  // Pre-allocate geometry and material
  const geometry = useMemo(() => new THREE.PlaneGeometry(0.015, 0.015), [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
        },
        vertexShader: `
          varying vec3 vColor;
          varying float vAlpha;

          void main() {
            vColor = instanceColor;

            // Extract alpha from color (stored in blue channel overflow)
            vAlpha = 1.0;

            vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);

            // Billboard: face camera
            vec3 cameraRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
            vec3 cameraUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);

            vec3 scale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), 1.0);
            vec3 pos = vec3(instanceMatrix[3].xyz);
            pos += cameraRight * position.x * scale.x;
            pos += cameraUp * position.y * scale.y;

            gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          varying float vAlpha;

          void main() {
            vec2 center = gl_PointCoord - vec2(0.5);
            float dist = length(gl_FragCoord.xy * 0.001 - vec2(0.5));

            // Radial gradient
            vec2 uv = gl_FragCoord.xy;
            float d = length(uv - vec2(0.5));

            // Hot white core
            float core = smoothstep(0.4, 0.0, d);
            vec3 white = vec3(1.0);
            vec3 color = mix(vColor, white, core * 0.9);

            // Soft edges
            float alpha = smoothstep(0.5, 0.1, d) * vAlpha;

            gl_FragColor = vec4(color, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    []
  )

  // Initialize/reset sparks when phase changes
  useEffect(() => {
    if (phase !== lastPhaseRef.current) {
      lastPhaseRef.current = phase
      startTimeRef.current = null
      initializeSparks(phase, origin, targets)
    }
  }, [phase, origin, targets])

  const initializeSparks = (currentPhase: RevealPhase, pos: THREE.Vector3, targetPositions: THREE.Vector3[]) => {
    const sparks: Spark[] = []

    if (currentPhase === 'locating') {
      // Orbital/spiral sparks
      for (let i = 0; i < 50; i++) {
        const angle = (i / 50) * Math.PI * 4
        const radius = 0.08 + (i / 50) * 0.12
        sparks.push({
          position: pos.clone(),
          velocity: new THREE.Vector3(
            Math.cos(angle) * 0.03,
            (Math.random() - 0.5) * 0.02,
            Math.sin(angle) * 0.03
          ),
          origin: pos.clone(),
          target: null,
          life: 1,
          maxLife: 0.8 + Math.random() * 0.4,
          size: 0.012 + Math.random() * 0.008,
          type: 'orbit',
          beamProgress: 0,
          delay: i * 0.02,
        })
      }
    } else if (currentPhase === 'connecting') {
      // Beam sparks traveling to targets
      targetPositions.forEach((target, ti) => {
        for (let i = 0; i < 20; i++) {
          sparks.push({
            position: pos.clone(),
            velocity: new THREE.Vector3(),
            origin: pos.clone(),
            target: target.clone(),
            life: 1,
            maxLife: 1.5,
            size: 0.015 + Math.random() * 0.01,
            type: 'beam',
            beamProgress: -0.3 - (i / 20) * 0.5, // Staggered start
            delay: ti * 0.15,
          })
        }
      })
    } else if (currentPhase === 'activating') {
      // Burst explosion
      for (let i = 0; i < 150; i++) {
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        const speed = 0.4 + Math.random() * 0.8

        sparks.push({
          position: pos.clone(),
          velocity: new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta) * speed,
            Math.sin(phi) * Math.sin(theta) * speed,
            Math.cos(phi) * speed
          ),
          origin: pos.clone(),
          target: null,
          life: 1,
          maxLife: 0.3 + Math.random() * 0.4,
          size: 0.02 + Math.random() * 0.015,
          type: 'burst',
          beamProgress: 0,
          delay: Math.random() * 0.1,
        })
      }
    } else if (currentPhase === 'complete') {
      // Ambient drifting sparks
      for (let i = 0; i < 30; i++) {
        sparks.push({
          position: pos.clone().add(
            new THREE.Vector3(
              (Math.random() - 0.5) * 0.15,
              (Math.random() - 0.5) * 0.15,
              (Math.random() - 0.5) * 0.15
            )
          ),
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.02,
            (Math.random() - 0.5) * 0.02,
            (Math.random() - 0.5) * 0.02
          ),
          origin: pos.clone(),
          target: null,
          life: 1,
          maxLife: 2 + Math.random() * 2,
          size: 0.008 + Math.random() * 0.006,
          type: 'ambient',
          beamProgress: 0,
          delay: 0,
        })
      }
    }

    // Pad to SPARK_COUNT
    while (sparks.length < SPARK_COUNT) {
      sparks.push({
        position: new THREE.Vector3(9999, 9999, 9999), // Off-screen
        velocity: new THREE.Vector3(),
        origin: pos.clone(),
        target: null,
        life: 0,
        maxLife: 1,
        size: 0,
        type: 'ambient',
        beamProgress: 0,
        delay: 0,
      })
    }

    sparksRef.current = sparks.slice(0, SPARK_COUNT)
  }

  // Initialize on first render
  useEffect(() => {
    initializeSparks(phase, origin, targets)
  }, [])

  const matrix = useMemo(() => new THREE.Matrix4(), [])
  const color = useMemo(() => new THREE.Color(), [])

  useFrame(({ clock }) => {
    if (!meshRef.current || sparksRef.current.length === 0) return

    if (startTimeRef.current === null) {
      startTimeRef.current = clock.getElapsedTime()
    }
    const elapsed = clock.getElapsedTime() - startTimeRef.current
    const dt = 0.016

    sparksRef.current.forEach((spark, i) => {
      if (elapsed < spark.delay) {
        // Not started yet
        matrix.makeScale(0, 0, 0)
        matrix.setPosition(9999, 9999, 9999)
        meshRef.current!.setMatrixAt(i, matrix)
        return
      }

      const sparkElapsed = elapsed - spark.delay

      // Update based on type
      switch (spark.type) {
        case 'orbit':
          // Spiral motion
          spark.velocity.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.15)
          spark.velocity.y += (Math.random() - 0.5) * 0.005
          spark.position.add(spark.velocity.clone().multiplyScalar(dt * 60))

          // Pull back toward origin
          const toOrigin = spark.origin.clone().sub(spark.position)
          spark.position.add(toOrigin.multiplyScalar(0.02))

          spark.life -= dt / spark.maxLife
          if (spark.life <= 0) {
            // Respawn
            spark.position.copy(spark.origin)
            spark.life = 1
          }
          break

        case 'beam':
          if (spark.target) {
            spark.beamProgress += dt * 1.8
            if (spark.beamProgress >= 0 && spark.beamProgress <= 1) {
              spark.position.lerpVectors(spark.origin, spark.target, spark.beamProgress)
              // Add wobble
              spark.position.x += Math.sin(sparkElapsed * 25 + i) * 0.003
              spark.position.y += Math.cos(sparkElapsed * 25 + i) * 0.003
            }
            spark.life = spark.beamProgress > 1 ? Math.max(0, spark.life - dt * 4) : 1
          }
          break

        case 'burst':
          spark.position.add(spark.velocity.clone().multiplyScalar(dt * 60))
          spark.velocity.y -= 0.3 * dt // Gravity
          spark.velocity.multiplyScalar(0.97) // Drag
          spark.life -= dt / spark.maxLife
          break

        case 'ambient':
          spark.position.add(spark.velocity.clone().multiplyScalar(dt * 60))
          // Gentle drift back
          const drift = spark.origin.clone().sub(spark.position)
          spark.position.add(drift.multiplyScalar(0.01))
          spark.life -= dt / spark.maxLife
          if (spark.life <= 0) {
            spark.position.copy(spark.origin).add(
              new THREE.Vector3(
                (Math.random() - 0.5) * 0.15,
                (Math.random() - 0.5) * 0.15,
                (Math.random() - 0.5) * 0.15
              )
            )
            spark.life = 1
          }
          break
      }

      // Update instance matrix
      const scale = spark.size * Math.max(0, spark.life)
      matrix.makeScale(scale, scale, 1)
      matrix.setPosition(spark.position.x, spark.position.y, spark.position.z)
      meshRef.current!.setMatrixAt(i, matrix)

      // Update instance color
      const lifeColor = spark.life
      if (spark.type === 'burst') {
        // White -> yellow -> orange fade
        color.setRGB(1, 0.8 + lifeColor * 0.2, lifeColor * 0.3)
      } else if (spark.type === 'beam') {
        // Teal with white tips
        color.setRGB(0.3 + lifeColor * 0.7, 0.9 + lifeColor * 0.1, 1)
      } else {
        // Cyan
        color.setRGB(0.3, 0.9, 1)
      }
      meshRef.current!.setColorAt(i, color)
    })

    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  })

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, SPARK_COUNT]} frustumCulled={false}>
      <planeGeometry args={[0.015, 0.015]} />
    </instancedMesh>
  )
}

// Electric beam with stable geometry
function ElectricBeam({
  start,
  end,
  phase,
  delay,
}: {
  start: THREE.Vector3
  end: THREE.Vector3
  phase: RevealPhase
  delay: number
}) {
  const lineRef = useRef<THREE.Line>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const startTimeRef = useRef<number | null>(null)

  // Create stable geometry ONCE
  const geometry = useMemo(() => {
    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
    const avgLen = (start.length() + end.length()) / 2
    midPoint.normalize().multiplyScalar(avgLen * 1.05)

    const curve = new THREE.CatmullRomCurve3([start, midPoint, end])
    const points = curve.getPoints(24)
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [start.x, start.y, start.z, end.x, end.y, end.z])

  useFrame(({ clock }) => {
    if (!materialRef.current) return

    if (startTimeRef.current === null) {
      startTimeRef.current = clock.getElapsedTime()
    }

    const elapsed = clock.getElapsedTime() - startTimeRef.current - delay
    const progress = Math.max(0, Math.min(1, elapsed * 2))

    materialRef.current.uniforms.uTime.value = clock.getElapsedTime()
    materialRef.current.uniforms.uProgress.value = progress
    materialRef.current.uniforms.uIntensity.value = phase === 'activating' ? 1.5 : 1.0
  })

  return (
    <line ref={lineRef} geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        uniforms={{
          uTime: { value: 0 },
          uProgress: { value: 0 },
          uIntensity: { value: 1 },
        }}
        vertexShader={`
          varying float vProgress;
          attribute float lineProgress;

          void main() {
            // Calculate progress along line (0-1)
            vProgress = position.z; // Will use position for now

            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform float uProgress;
          uniform float uIntensity;

          void main() {
            // Electric cyan color
            vec3 color = vec3(0.3, 0.9, 1.0) * uIntensity;

            // Pulsing effect
            float pulse = 0.7 + 0.3 * sin(uTime * 10.0);

            // Fade based on reveal progress
            float alpha = uProgress * pulse * 0.8;

            gl_FragColor = vec4(color, alpha);
          }
        `}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </line>
  )
}
