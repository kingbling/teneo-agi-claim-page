// Main exports for Three.js integration layer
export { ThreeCanvas } from './ThreeCanvas'
export { ThreeProvider, useThree } from './ThreeContext'
export type { ThreeContextValue, ThreeState, FrameCallback } from './ThreeContext'
export { useFrame } from './hooks/useFrame'

// Re-export hooks
export * from './hooks'
