import { Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { BrainParticles } from './BrainParticles'
import { SynapseParticles } from './SynapseParticles'
import { InteractiveSynapsePoints } from './InteractiveSynapsePoints'
import { ElectronFlow } from './ElectronFlow'
import { useClaimStore } from '@/stores/claimStore'
import type { SynapseNode } from '@/types'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'

interface BrainSceneProps {
  autoRotate?: boolean
  interactive?: boolean
}

export function BrainScene({ autoRotate = true, interactive = true }: BrainSceneProps) {
  const user = useClaimStore((state) => state.user)
  const synapseNodes = useClaimStore((state) => state.synapseNodes)
  const connectedSynapseIds = useClaimStore((state) => state.connectedSynapseIds)
  const progress = user?.journeyProgress ?? 0

  return (
    <div className="h-full w-full bg-[#1d1f23]">
      <Canvas
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        dpr={1}
        style={{ background: '#1d1f23' }}
        frameloop="always"
      >
        <color attach="background" args={['#1d1f23']} />
        <Suspense fallback={null}>
          <BrainContent
            autoRotate={autoRotate}
            interactive={interactive}
            progress={progress}
            synapseNodes={synapseNodes}
            userSynapseIds={connectedSynapseIds}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}

function BrainContent({
  autoRotate,
  interactive,
  progress,
  synapseNodes,
  userSynapseIds,
}: {
  autoRotate: boolean
  interactive: boolean
  progress: number
  synapseNodes: SynapseNode[]
  userSynapseIds: string[]
}) {
  const controlsRef = useRef<OrbitControlsType>(null)

  const handleSynapseClick = (node: SynapseNode) => {
    // Calculate world position of synapse
    const brainScale = { x: 1.3, y: 1.0, z: 1.1 }
    const brainRadius = 1.2
    const x = node.position[0] * brainScale.x * brainRadius
    const y = node.position[1] * brainScale.y * brainRadius
    const z = node.position[2] * brainScale.z * brainRadius

    // Animate camera to look at the synapse
    if (controlsRef.current) {
      // Temporarily disable auto-rotate during zoom
      controlsRef.current.autoRotate = false

      // Set new target
      controlsRef.current.target.set(x * 0.3, y * 0.3, z * 0.3)

      // Re-enable auto-rotate after a delay
      setTimeout(() => {
        if (controlsRef.current) {
          controlsRef.current.autoRotate = autoRotate
        }
      }, 3000)
    }
  }

  return (
    <>
      {/* Camera */}
      <PerspectiveCamera makeDefault position={[0, 0, 4]} fov={50} />

      {/* Controls */}
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={interactive}
        enableRotate={interactive}
        autoRotate={autoRotate}
        autoRotateSpeed={0.5}
        minDistance={2}
        maxDistance={8}
        dampingFactor={0.05}
        enableDamping
      />

      {/* Minimal lighting - no point lights to avoid artifacts */}
      <ambientLight intensity={0.3} />

      {/* Brain visualization group */}
      <group>
        {/* Subtle wireframe brain outline */}
        <BrainParticles progress={progress} />

        {/* Crisp synapse dots on brain surface */}
        <SynapseParticles count={80000} />

        {/* Interactive connected synapse points - disabled for debugging */}
        {/* <InteractiveSynapsePoints
          synapseNodes={synapseNodes}
          userSynapseIds={userSynapseIds}
          onSynapseClick={handleSynapseClick}
        /> */}

        {/* Electron flow connections */}
        <ElectronFlow synapseNodes={synapseNodes} />
      </group>
    </>
  )
}
