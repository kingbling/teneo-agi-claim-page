/**
 * ArrivalPulse - Visual pulse effect when a ship arrives at a synapse
 *
 * Creates an expanding ring pulse at the ship's position when it transitions
 * from 'deploying' to 'solving' state.
 */

import { onMount, onCleanup, createEffect, type Component } from 'solid-js'
import * as THREE from 'three'
import { useThree, useFrame } from '@/three/hooks'

interface ArrivalPulseProps {
  shipId: string
  position: THREE.Vector3
  isActive: boolean
  color?: number // RGB color as hex (default: cyan)
  duration?: number // Animation duration in seconds (default: 1.0)
}

export const ArrivalPulse: Component<ArrivalPulseProps> = (props) => {
  const { scene } = useThree()

  let ringMesh: THREE.Mesh | null = null
  let ringGeometry: THREE.RingGeometry | null = null
  let ringMaterial: THREE.ShaderMaterial | null = null
  let animationStartTime = 0
  let isAnimating = false

  const getSceneObj = () => scene()

  onMount(() => {
    const sceneObj = getSceneObj()
    if (!sceneObj) return

    // Create ring geometry
    ringGeometry = new THREE.RingGeometry(0.05, 0.08, 32)

    // Create shader material for animated pulse
    ringMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDuration: { value: props.duration ?? 1.0 },
        uColor: { value: new THREE.Color(props.color ?? 0x00ffff) },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uDuration;
        varying vec2 vUv;
        varying float vProgress;

        void main() {
          vUv = uv;
          vProgress = uTime / uDuration;

          // Rotate the ring
          float angle = uTime * 2.0;
          float c = cos(angle);
          float s = sin(angle);

          vec3 pos = position;
          // Scale up over time
          float scale = 1.0 + vProgress * 3.0;
          pos.x *= scale;
          pos.y *= scale;

          // Apply rotation
          float newX = pos.x * c - pos.z * s;
          float newZ = pos.x * s + pos.z * c;
          pos.x = newX;
          pos.z = newZ;

          // Lay flat on XZ plane
          vec4 worldPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uDuration;
        uniform vec3 uColor;
        varying vec2 vUv;
        varying float vProgress;

        void main() {
          // Calculate distance from ring center
          vec2 center = vec2(0.5, 0.5);
          float dist = length(vUv - center);

          // Create ring shape
          float ringWidth = 0.02;
          float ring = 1.0 - smoothstep(0.0, ringWidth, abs(dist - 0.35));

          // Fade out over time
          float alpha = ring * (1.0 - vProgress);

          // Add glow
          float glow = exp(-abs(dist - 0.35) * 10.0) * 0.5 * (1.0 - vProgress);

          if (alpha + glow < 0.01) discard;

          gl_FragColor = vec4(uColor, alpha + glow);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })

    ringMesh = new THREE.Mesh(ringGeometry, ringMaterial)
    ringMesh.rotation.x = -Math.PI / 2  // Lay flat on XZ plane
    ringMesh.visible = false
    ringMesh.renderOrder = 120  // Above most elements
    sceneObj.add(ringMesh)

    onCleanup(() => {
      if (ringMesh && sceneObj) {
        sceneObj.remove(ringMesh)
      }
      ringGeometry?.dispose()
      ringMaterial?.dispose()
    })
  })

  // Watch for activation
  createEffect(() => {
    if (!props.isActive || !ringMesh) return

    const sceneObj = getSceneObj()
    if (!sceneObj) return

    // Start animation
    isAnimating = true
    animationStartTime = performance.now() / 1000

    // Set position
    ringMesh.position.copy(props.position)
    ringMesh.visible = true
  })

  // Animation loop
  useFrame(() => {
    if (!isAnimating || !ringMesh || !ringMaterial) return

    const currentTime = performance.now() / 1000
    const elapsed = currentTime - animationStartTime
    const duration = props.duration ?? 1.0

    if (elapsed >= duration) {
      // Animation complete
      ringMesh.visible = false
      isAnimating = false
      return
    }

    // Update shader uniforms
    ringMaterial.uniforms.uTime.value = elapsed
  })

  // Update color if prop changes
  createEffect(() => {
    if (ringMaterial && props.color !== undefined) {
      ringMaterial.uniforms.uColor.value.setHex(props.color)
    }
  })

  return null
}
