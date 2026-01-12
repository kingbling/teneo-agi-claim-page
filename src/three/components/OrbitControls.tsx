/**
 * OrbitControls - Camera Controls Wrapper
 *
 * Wraps Three.js OrbitControls for use with SolidJS.
 * Replaces @react-three/drei's OrbitControls.
 */

import { onMount, onCleanup, createEffect } from 'solid-js'
import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useThree, useFrame } from '../hooks'

interface OrbitControlsProps {
  enableDamping?: boolean
  dampingFactor?: number
  rotateSpeed?: number
  enableRotate?: boolean
  enableZoom?: boolean
  enablePan?: boolean
  minDistance?: number
  maxDistance?: number
  minPolarAngle?: number
  maxPolarAngle?: number
  target?: [number, number, number]
  makeDefault?: boolean
  ref?: (controls: ThreeOrbitControls) => void
}

export function OrbitControls(props: OrbitControlsProps) {
  const { camera, gl } = useThree()
  let controls: ThreeOrbitControls | null = null

  onMount(() => {
    const cam = camera()
    const renderer = gl()

    if (!cam || !renderer) {
      console.warn('OrbitControls: Camera or renderer not available')
      return
    }

    controls = new ThreeOrbitControls(cam, renderer.domElement)

    // Apply initial props
    controls.enableDamping = props.enableDamping ?? true
    controls.dampingFactor = props.dampingFactor ?? 0.05
    controls.rotateSpeed = props.rotateSpeed ?? 0.5
    controls.enableRotate = props.enableRotate ?? true
    controls.enableZoom = props.enableZoom ?? true
    controls.enablePan = props.enablePan ?? true
    controls.minDistance = props.minDistance ?? 0.1
    controls.maxDistance = props.maxDistance ?? 100
    controls.minPolarAngle = props.minPolarAngle ?? 0
    controls.maxPolarAngle = props.maxPolarAngle ?? Math.PI

    if (props.target) {
      controls.target.set(...props.target)
    }

    // Pass ref to parent if provided
    if (props.ref) {
      props.ref(controls)
    }

    onCleanup(() => {
      controls?.dispose()
    })
  })

  // Update controls on each frame (for damping)
  useFrame(() => {
    if (controls && props.enableDamping) {
      controls.update()
    }
  })

  // React to prop changes
  createEffect(() => {
    if (!controls) return

    if (props.enableDamping !== undefined) {
      controls.enableDamping = props.enableDamping
    }
    if (props.dampingFactor !== undefined) {
      controls.dampingFactor = props.dampingFactor
    }
    if (props.rotateSpeed !== undefined) {
      controls.rotateSpeed = props.rotateSpeed
    }
    if (props.enableRotate !== undefined) {
      controls.enableRotate = props.enableRotate
    }
    if (props.enableZoom !== undefined) {
      controls.enableZoom = props.enableZoom
    }
    if (props.enablePan !== undefined) {
      controls.enablePan = props.enablePan
    }
    if (props.minDistance !== undefined) {
      controls.minDistance = props.minDistance
    }
    if (props.maxDistance !== undefined) {
      controls.maxDistance = props.maxDistance
    }
    if (props.minPolarAngle !== undefined) {
      controls.minPolarAngle = props.minPolarAngle
    }
    if (props.maxPolarAngle !== undefined) {
      controls.maxPolarAngle = props.maxPolarAngle
    }
    if (props.target) {
      controls.target.set(...props.target)
    }
  })

  return null
}

export default OrbitControls
