import { useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Canvas, useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { Coins, Zap, Star, Key } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Badge,
} from '@/components/ui'
import { useClaimStore } from '@/stores/claimStore'
import type { Reward, Rarity, RevealPhase } from '@/types'

export function SynapseRevealDialog() {
  const isRevealOpen = useClaimStore((state) => state.isRevealOpen)
  const revealPhase = useClaimStore((state) => state.revealPhase)
  const currentRewards = useClaimStore((state) => state.currentRewards)
  const closeReveal = useClaimStore((state) => state.closeReveal)
  const connectSynapse = useClaimStore((state) => state.connectSynapse)
  const completeReveal = useClaimStore((state) => state.completeReveal)

  useEffect(() => {
    if (isRevealOpen && revealPhase === 'idle') {
      connectSynapse()
    }
  }, [isRevealOpen, revealPhase, connectSynapse])

  const handleClose = () => {
    if (revealPhase === 'complete') {
      completeReveal()
    } else {
      closeReveal()
    }
  }

  const getPhaseTitle = () => {
    switch (revealPhase) {
      case 'locating':
        return 'Locating Neural Region...'
      case 'connecting':
        return 'Forming Connection...'
      case 'activating':
        return 'Synapse Activated!'
      case 'complete':
        return 'Neural Link Established'
      default:
        return 'Connecting Synapse...'
    }
  }

  return (
    <Dialog open={isRevealOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md overflow-hidden bg-[var(--background-primary)] p-0">
        <div className="relative">
          {/* Mini Brain Visualization */}
          <div className="h-[280px] w-full bg-[#1d1f23]">
            <Canvas
              gl={{
                antialias: false,
                alpha: false,
                powerPreference: 'high-performance',
              }}
              dpr={1}
            >
              <color attach="background" args={['#1d1f23']} />
              <MiniBrainScene phase={revealPhase} />
            </Canvas>
          </div>

          {/* Phase indicator dots */}
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
            {['locating', 'connecting', 'activating', 'complete'].map((p, i) => {
              const phases = ['locating', 'connecting', 'activating', 'complete']
              const currentIdx = phases.indexOf(revealPhase)
              const isActive = i <= currentIdx && revealPhase !== 'idle'
              return (
                <motion.div
                  key={p}
                  className={`h-1.5 rounded-full transition-colors ${
                    isActive ? 'bg-[var(--brand-teal-1)]' : 'bg-[var(--background-tertiary)]'
                  }`}
                  initial={{ width: 6 }}
                  animate={{ width: p === revealPhase ? 24 : 6 }}
                  transition={{ duration: 0.3 }}
                />
              )
            })}
          </div>
        </div>

        <div className="p-4 pt-2">
          <DialogHeader className="pb-3">
            <DialogTitle className="text-center text-base">
              <motion.span
                key={revealPhase}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {getPhaseTitle()}
              </motion.span>
            </DialogTitle>
          </DialogHeader>

          {/* Rewards Display - only show when complete */}
          <AnimatePresence mode="wait">
            {revealPhase === 'complete' && currentRewards && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="space-y-2"
              >
                {currentRewards.map((reward, index) => (
                  <motion.div
                    key={reward.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.15 }}
                  >
                    <RewardCard reward={reward} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {revealPhase === 'complete' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <Button onClick={handleClose} className="mt-4 w-full">
                Continue
              </Button>
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Mini brain visualization for the reveal dialog
function MiniBrainScene({ phase }: { phase: RevealPhase }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 3.5]} fov={50} />
      <ambientLight intensity={0.2} />
      <pointLight position={[5, 5, 5]} intensity={0.5} color="#75e6ea" />
      <pointLight position={[-5, -5, -5]} intensity={0.2} color="#0044ff" />
      <BrainOutlineRing />
      <NewSynapseEffect phase={phase} />
    </>
  )
}

// Simple ring outline to suggest brain shape
function BrainOutlineRing() {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.2
    }
  })

  return (
    <mesh ref={meshRef}>
      <torusGeometry args={[1.1, 0.02, 8, 64]} />
      <meshBasicMaterial color="#3d5a5c" transparent opacity={0.3} />
    </mesh>
  )
}

// Simplified brain particles for the mini view - sparse outline only
function MiniBrainParticles({ phase }: { phase: RevealPhase }) {
  const meshRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const { positions, opacities } = useMemo(() => {
    const count = 400 // Very few particles - just hints of shape
    const positions = new Float32Array(count * 3)
    const opacities = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      // Very tight shell - particles on outer edge only
      const r = 1.05 + Math.random() * 0.03

      const x = r * Math.sin(phi) * Math.cos(theta) * 1.3
      const y = r * Math.sin(phi) * Math.sin(theta) * 1.0
      const z = r * Math.cos(phi) * 1.1

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      opacities[i] = 0.05 + Math.random() * 0.1 // Very low opacity
    }

    return { positions, opacities }
  }, [])

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime()

      // Pulse intensity based on phase
      const phaseIntensity =
        phase === 'activating' ? 1.2 : phase === 'connecting' ? 1.1 : 1.0
      materialRef.current.uniforms.uIntensity.value = phaseIntensity
    }

    if (meshRef.current) {
      // Gentle rotation
      meshRef.current.rotation.y += 0.003
    }
  })

  const vertexShader = `
    attribute float aOpacity;
    varying float vOpacity;
    uniform float uTime;

    void main() {
      vOpacity = aOpacity;

      vec3 pos = position;
      float breathe = 1.0 + 0.02 * sin(uTime * 0.8);
      pos *= breathe;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = 2.0 * (200.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `

  const fragmentShader = `
    uniform float uTime;
    uniform float uIntensity;
    varying float vOpacity;

    void main() {
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      if (dist > 0.5) discard;

      float alpha = smoothstep(0.5, 0.0, dist) * vOpacity * 0.15;
      float pulse = 0.95 + 0.05 * sin(uTime * 2.0);

      vec3 color = vec3(0.459, 0.902, 0.918) * uIntensity * 0.5; // Very dim

      gl_FragColor = vec4(color, alpha * pulse);
    }
  `

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aOpacity"
          count={opacities.length}
          array={opacities}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={{
          uTime: { value: 0 },
          uIntensity: { value: 1.0 },
        }}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
      />
    </points>
  )
}

// The new synapse forming effect
function NewSynapseEffect({ phase }: { phase: RevealPhase }) {
  const groupRef = useRef<THREE.Group>(null)
  const synapseRef = useRef<THREE.Mesh>(null)
  const connectionsRef = useRef<THREE.Points>(null)
  const connectionMatRef = useRef<THREE.ShaderMaterial>(null)

  // Target position for the new synapse (on brain surface)
  const targetPos = useMemo(() => new THREE.Vector3(0.6, 0.4, 0.8), [])

  // Connection lines from nearby points
  const connectionPositions = useMemo(() => {
    const count = 60
    const positions = new Float32Array(count * 3)
    const progresses = new Float32Array(count)

    // Create 3 connection paths
    const sources = [
      new THREE.Vector3(-0.4, 0.6, 0.6),
      new THREE.Vector3(0.8, -0.2, 0.5),
      new THREE.Vector3(0.2, 0.8, 0.4),
    ]

    let idx = 0
    sources.forEach((source) => {
      const pointsPerPath = 20
      for (let i = 0; i < pointsPerPath; i++) {
        const t = i / (pointsPerPath - 1)
        const pos = new THREE.Vector3().lerpVectors(source, targetPos, t)

        // Add slight curve
        const mid = 0.5 - Math.abs(t - 0.5)
        pos.multiplyScalar(1 + mid * 0.1)

        positions[idx * 3] = pos.x
        positions[idx * 3 + 1] = pos.y
        positions[idx * 3 + 2] = pos.z
        progresses[idx] = t

        idx++
      }
    })

    return { positions, progresses }
  }, [targetPos])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()

    // Animate synapse appearance
    if (synapseRef.current) {
      const showSynapse = phase === 'connecting' || phase === 'activating' || phase === 'complete'

      if (showSynapse) {
        const scale =
          phase === 'activating'
            ? 0.08 + 0.015 * Math.sin(t * 8)
            : phase === 'complete'
              ? 0.07
              : Math.min((t % 2) * 0.1, 0.06)

        synapseRef.current.scale.setScalar(scale)
      } else {
        synapseRef.current.scale.setScalar(0)
      }
    }

    // Animate connections
    if (connectionMatRef.current) {
      const showConnections = phase === 'connecting' || phase === 'activating' || phase === 'complete'
      connectionMatRef.current.uniforms.uTime.value = t
      connectionMatRef.current.uniforms.uVisible.value = showConnections ? 1.0 : 0.0
      connectionMatRef.current.uniforms.uPhase.value =
        phase === 'activating' ? 1.3 : phase === 'complete' ? 1.1 : 1.0
    }

    // Rotate the whole group slightly
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.2
    }
  })

  const synapseVertexShader = `
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `

  const synapseFragmentShader = `
    uniform float uIntensity;
    varying vec3 vNormal;

    void main() {
      float rim = 1.0 - max(0.0, dot(vNormal, vec3(0.0, 0.0, 1.0)));
      rim = pow(rim, 2.0);

      vec3 color = vec3(0.459, 0.902, 0.918) * uIntensity; // #75e6ea
      float alpha = 0.6 + rim * 0.3;

      gl_FragColor = vec4(color, alpha);
    }
  `

  const connectionVertexShader = `
    attribute float aProgress;
    varying float vProgress;
    uniform float uTime;

    void main() {
      vProgress = aProgress;

      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = 3.0 * (200.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `

  const connectionFragmentShader = `
    uniform float uTime;
    uniform float uVisible;
    uniform float uPhase;
    varying float vProgress;

    void main() {
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      if (dist > 0.5) discard;

      // Electron animation along the path
      float electronT = fract(uTime * 0.8);
      float electronDist = abs(vProgress - electronT);
      electronDist = min(electronDist, 1.0 - electronDist);
      float electron = smoothstep(0.1, 0.0, electronDist);

      // Base path visibility
      float pathAlpha = 0.15 + electron * 0.85;

      vec3 color = vec3(0.459, 0.902, 0.918) * uPhase;
      float alpha = smoothstep(0.5, 0.0, dist) * pathAlpha * uVisible;

      gl_FragColor = vec4(color, alpha);
    }
  `

  return (
    <group ref={groupRef}>
      {/* New synapse sphere - simple glowing dot */}
      <mesh ref={synapseRef} position={targetPos}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial color="#75e6ea" transparent opacity={0.9} />
      </mesh>

      {/* Connection lines */}
      <points ref={connectionsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={connectionPositions.positions.length / 3}
            array={connectionPositions.positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aProgress"
            count={connectionPositions.progresses.length}
            array={connectionPositions.progresses}
            itemSize={1}
          />
        </bufferGeometry>
        <shaderMaterial
          ref={connectionMatRef}
          uniforms={{
            uTime: { value: 0 },
            uVisible: { value: 0 },
            uPhase: { value: 1.0 },
          }}
          vertexShader={connectionVertexShader}
          fragmentShader={connectionFragmentShader}
          transparent
          depthWrite={false}
        />
      </points>
    </group>
  )
}

function RewardCard({ reward }: { reward: Reward }) {
  const rarityColors: Record<Rarity, string> = {
    common: 'border-[var(--rarity-common)]/50',
    uncommon: 'border-[var(--rarity-uncommon)]/50',
    rare: 'border-[var(--rarity-rare)]/50',
    legendary: 'border-[var(--rarity-legendary)]/50',
  }

  const rarityBg: Record<Rarity, string> = {
    common: 'bg-[var(--rarity-common)]/5',
    uncommon: 'bg-[var(--rarity-uncommon)]/5',
    rare: 'bg-[var(--rarity-rare)]/5',
    legendary: 'bg-[var(--rarity-legendary)]/10',
  }

  const getRewardIcon = () => {
    const iconClass = 'h-4 w-4'
    switch (reward.type) {
      case 'AGI_TOKENS':
        return <Coins className={`${iconClass} text-[var(--rarity-common)]`} />
      case 'MULTIPLIER':
        return <Zap className={`${iconClass} text-[var(--rarity-uncommon)]`} />
      case 'STAKING_BOOST':
        return <Star className={`${iconClass} text-[var(--rarity-rare)]`} />
      case 'NEURAL_KEY':
        return <Key className={`${iconClass} text-[var(--rarity-legendary)]`} />
    }
  }

  const getRewardText = () => {
    switch (reward.type) {
      case 'AGI_TOKENS':
        return `${reward.amount} AGI`
      case 'MULTIPLIER':
        return `${reward.value}x Multiplier`
      case 'STAKING_BOOST':
        return `Tier ${reward.tier} Staking`
      case 'NEURAL_KEY':
        return `${reward.keyType.charAt(0).toUpperCase() + reward.keyType.slice(1)} Key`
    }
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 ${rarityColors[reward.rarity]} ${rarityBg[reward.rarity]}`}
    >
      <div className="rounded-md bg-[var(--background-tertiary)] p-1.5">
        {getRewardIcon()}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-[var(--text-primary)]">
          {getRewardText()}
        </div>
      </div>
      <Badge variant={reward.rarity} className="text-[10px] capitalize">
        {reward.rarity}
      </Badge>
    </div>
  )
}
