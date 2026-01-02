import { useState, useCallback } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { SynapseNode } from '@/types'

interface InteractiveSynapsePointsProps {
  synapseNodes: SynapseNode[]
  userSynapseIds: string[]
  onSynapseClick?: (node: SynapseNode) => void
}

interface HoveredSynapse {
  node: SynapseNode
  position: THREE.Vector3
}

export function InteractiveSynapsePoints({
  synapseNodes,
  userSynapseIds,
  onSynapseClick,
}: InteractiveSynapsePointsProps) {
  const [hovered, setHovered] = useState<HoveredSynapse | null>(null)
  const userNodeSet = new Set(userSynapseIds)

  // Brain scale factors (must match BrainParticles)
  const brainScale = { x: 1.3, y: 1.0, z: 1.1 }
  const brainRadius = 1.2

  // Filter to only connected nodes
  const connectedNodes = synapseNodes.filter((node) => node.state === 'connected')

  const handlePointerOver = useCallback((node: SynapseNode, position: THREE.Vector3) => {
    document.body.style.cursor = 'pointer'
    setHovered({ node, position })
  }, [])

  const handlePointerOut = useCallback(() => {
    document.body.style.cursor = 'auto'
    setHovered(null)
  }, [])

  const handleClick = useCallback((node: SynapseNode) => {
    onSynapseClick?.(node)
  }, [onSynapseClick])

  if (connectedNodes.length === 0) return null

  return (
    <group>
      {connectedNodes.map((node) => {
        const isUserNode = userNodeSet.has(node.id)
        const position = new THREE.Vector3(
          node.position[0] * brainScale.x * brainRadius,
          node.position[1] * brainScale.y * brainRadius,
          node.position[2] * brainScale.z * brainRadius
        )
        // Push outward from brain surface
        const len = position.length()
        position.multiplyScalar((len + 0.05) / len)

        return (
          <SynapsePoint
            key={node.id}
            position={position}
            isUserNode={isUserNode}
            isHovered={hovered?.node.id === node.id}
            onPointerOver={() => handlePointerOver(node, position)}
            onPointerOut={handlePointerOut}
            onClick={() => handleClick(node)}
          />
        )
      })}

      {/* Tooltip */}
      {hovered && (
        <Html
          position={[hovered.position.x, hovered.position.y + 0.15, hovered.position.z]}
          center
          style={{
            pointerEvents: 'none',
            transform: 'translateY(-100%)',
          }}
        >
          <SynapseTooltip node={hovered.node} isUserNode={userNodeSet.has(hovered.node.id)} />
        </Html>
      )}
    </group>
  )
}

interface SynapsePointProps {
  position: THREE.Vector3
  isUserNode: boolean
  isHovered: boolean
  onPointerOver: () => void
  onPointerOut: () => void
  onClick: () => void
}

function SynapsePoint({
  position,
  isUserNode,
  isHovered,
  onPointerOver,
  onPointerOut,
  onClick,
}: SynapsePointProps) {
  // Completely invisible - just for interaction detection
  return (
    <mesh
      position={position}
      scale={0.05}
      onPointerOver={(e) => {
        e.stopPropagation()
        onPointerOver()
      }}
      onPointerOut={onPointerOut}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      visible={false}
    >
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  )
}

interface SynapseTooltipProps {
  node: SynapseNode
  isUserNode: boolean
}

function SynapseTooltip({ node, isUserNode }: SynapseTooltipProps) {
  const formatDate = (date?: Date) => {
    if (!date) return 'Unknown'
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  return (
    <div
      className="rounded-lg border border-[var(--card-border)] bg-[var(--background-secondary)] px-3 py-2 shadow-lg"
      style={{ minWidth: '160px' }}
    >
      <div className="mb-1 flex items-center gap-2">
        <div
          className={`h-2 w-2 rounded-full ${
            isUserNode ? 'bg-[var(--brand-teal-1)]' : 'bg-[var(--text-muted)]'
          }`}
        />
        <span className="text-xs font-medium text-[var(--text-primary)]">
          {isUserNode ? 'Your Synapse' : 'Network Synapse'}
        </span>
      </div>
      <div className="space-y-0.5 text-[10px] text-[var(--text-secondary)]">
        <div className="flex justify-between">
          <span>Region:</span>
          <span className="capitalize text-[var(--text-primary)]">{node.region}</span>
        </div>
        {node.connectedBy && (
          <div className="flex justify-between">
            <span>Wallet:</span>
            <span className="font-mono text-[var(--text-primary)]">{node.connectedBy}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Connected:</span>
          <span className="text-[var(--text-primary)]">{formatDate(node.connectedAt)}</span>
        </div>
      </div>
    </div>
  )
}
