import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import { SynapseParticlesMinimal } from './SynapseParticlesMinimal'

/**
 * Simplified brain scene for Landing page
 * No claim logic, just auto-rotating brain visualization
 */
export function LandingBrainScene() {
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
          <LandingBrainContent />
        </Suspense>
      </Canvas>
    </div>
  )
}

function LandingBrainContent() {
  const controlsRef = useRef<OrbitControlsType>(null)

  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.update()
    }
  })

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 4]} fov={50} />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={false}
        enableRotate={false}
        autoRotate
        autoRotateSpeed={0.5}
      />

      <ambientLight intensity={0.3} />

      <group>
        <SynapseParticlesMinimal count={50000} />
      </group>
    </>
  )
}
