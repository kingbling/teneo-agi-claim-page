import { useRef, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useClaimStore } from '@/stores/claimStore'

export function SynapseNodes() {
  const synapseNodes = useClaimStore((state) => state.synapseNodes)
  const selectedNodeId = useClaimStore((state) => state.selectedNodeId)
  const selectNode = useClaimStore((state) => state.selectNode)

  // Only show a subset of nodes for performance (visible ones)
  const visibleNodes = synapseNodes.slice(0, 30)

  return (
    <group>
      {visibleNodes.map((node) => (
        <SynapseNode
          key={node.id}
          id={node.id}
          position={node.position}
          state={node.state}
          region={node.region}
          isSelected={selectedNodeId === node.id}
          onSelect={() => selectNode(node.id)}
        />
      ))}
    </group>
  )
}

interface SynapseNodeProps {
  id: string
  position: [number, number, number]
  state: 'locked' | 'available' | 'connected'
  region: string
  isSelected: boolean
  onSelect: () => void
}

function SynapseNode({
  id,
  position,
  state,
  region,
  isSelected,
  onSelect,
}: SynapseNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  // Colors based on state
  const colors = {
    locked: '#3f4142',
    available: '#75e6ea',
    connected: '#41cba4',
  }

  const emissiveIntensity = {
    locked: 0,
    available: 0.5,
    connected: 0.8,
  }

  // Animation
  useFrame(({ clock }) => {
    if (!meshRef.current) return

    const t = clock.getElapsedTime()

    // Pulse animation for available nodes
    if (state === 'available') {
      const scale = 1 + 0.2 * Math.sin(t * 3)
      meshRef.current.scale.setScalar(scale)
    }

    // Gentle pulse for connected nodes
    if (state === 'connected') {
      const scale = 1 + 0.05 * Math.sin(t * 2)
      meshRef.current.scale.setScalar(scale)
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (state !== 'locked') {
      onSelect()
    }
  }

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (state !== 'locked') {
      setHovered(true)
      document.body.style.cursor = 'pointer'
    }
  }

  const handlePointerOut = () => {
    setHovered(false)
    document.body.style.cursor = 'default'
  }

  const size = state === 'locked' ? 0.02 : 0.035

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial
          color={colors[state]}
          emissive={colors[state]}
          emissiveIntensity={hovered ? emissiveIntensity[state] + 0.5 : emissiveIntensity[state]}
          transparent
          opacity={state === 'locked' ? 0.3 : 1}
        />
      </mesh>

      {/* Glow effect for non-locked nodes */}
      {state !== 'locked' && (
        <mesh scale={1.5}>
          <sphereGeometry args={[size, 8, 8]} />
          <meshBasicMaterial
            color={colors[state]}
            transparent
            opacity={0.15}
          />
        </mesh>
      )}

      {/* Tooltip on hover */}
      {hovered && (
        <Html position={[0, 0.1, 0]} center>
          <div className="whitespace-nowrap rounded-lg bg-[var(--background-secondary)] px-3 py-2 text-xs shadow-lg border border-[var(--card-border)]">
            <div className="font-semibold text-[var(--text-primary)]">
              {state === 'available' ? 'Available Synapse' : `Synapse ${id.split('_')[1]}`}
            </div>
            <div className="text-[var(--text-tertiary)] capitalize">{region} Lobe</div>
          </div>
        </Html>
      )}
    </group>
  )
}
