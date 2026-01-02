import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface BrainParticlesProps {
  progress?: number
}

// This component is now just a placeholder - the brain shape comes from SynapseParticles
// Keeping it for potential future use (e.g., subtle inner glow or structure)
export function BrainParticles({ progress = 23.5 }: BrainParticlesProps) {
  return null // Disabled - brain shape comes from SynapseParticles
}
