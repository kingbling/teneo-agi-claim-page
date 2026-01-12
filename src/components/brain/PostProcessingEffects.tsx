/**
 * PostProcessingEffects - Adds bloom glow and vignette to the 3D scene
 *
 * Migrated from React Three Fiber to vanilla Three.js with SolidJS.
 * Uses THREE.EffectComposer from examples/jsm for post-processing.
 *
 * Bloom creates the characteristic glow around bright particles
 * Vignette adds subtle edge darkening for depth
 */

import { onMount, onCleanup, createEffect } from 'solid-js'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { useThree } from '@/three/ThreeContext'

interface PostProcessingEffectsProps {
  bloomIntensity?: number
  vignetteIntensity?: number
}

// Custom vignette shader
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 0.3 },
    darkness: { value: 0.5 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - 0.5) * 2.0;
      float dist = length(uv);
      float vignette = smoothstep(offset, offset + 0.7, dist) * darkness;
      texel.rgb = mix(texel.rgb, vec3(0.0), vignette);
      gl_FragColor = texel;
    }
  `,
}

/**
 * PostProcessingEffects - Bloom and vignette post-processing
 *
 * This component sets up a post-processing pipeline that:
 * 1. Renders the scene normally (RenderPass)
 * 2. Applies bloom to bright areas (UnrealBloomPass)
 * 3. Adds vignette darkening at edges (VignettePass)
 *
 * The component takes over rendering from ThreeContext and renders
 * via the EffectComposer instead of direct renderer.render() calls.
 */
export function PostProcessingEffects(props: PostProcessingEffectsProps) {
  const { gl, scene, camera, size, registerFrameCallback } = useThree()

  let composer: EffectComposer | null = null
  let bloomPass: UnrealBloomPass | null = null
  let vignettePass: ShaderPass | null = null

  onMount(() => {
    const renderer = gl()
    const sceneObj = scene()
    const cam = camera()

    if (!renderer || !sceneObj || !cam) {
      console.warn('PostProcessingEffects: Three.js not yet initialized')
      return
    }

    const { width, height } = size()

    // Create EffectComposer with multisampling for anti-aliasing
    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
      samples: 4, // multisampling
      type: THREE.HalfFloatType,
    })
    composer = new EffectComposer(renderer, renderTarget)

    // RenderPass - renders the scene normally
    const renderPass = new RenderPass(sceneObj, cam)
    composer.addPass(renderPass)

    // UnrealBloomPass - creates the glowing effect
    // Parameters: resolution, strength, radius, threshold
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      props.bloomIntensity ?? 0.4,  // strength: subtle glow
      0.25,                          // radius: tight spread
      0.9                            // threshold: very high = only brightest elements bloom
    )
    composer.addPass(bloomPass)

    // Vignette pass - darkens edges
    vignettePass = new ShaderPass(VignetteShader)
    vignettePass.uniforms.offset.value = 0.3
    vignettePass.uniforms.darkness.value = props.vignetteIntensity ?? 0.5
    composer.addPass(vignettePass)

    // Register frame callback to render via composer
    // Use high priority (runs last) so we render after all scene updates
    const unregister = registerFrameCallback(
      () => {
        if (composer) {
          composer.render()
        }
      },
      1000 // High priority number = runs after lower priority callbacks
    )

    onCleanup(() => {
      unregister()
      if (composer) {
        composer.dispose()
        renderTarget.dispose()
      }
    })
  })

  // Update bloom intensity when prop changes
  createEffect(() => {
    if (bloomPass) {
      bloomPass.strength = props.bloomIntensity ?? 1.4
    }
  })

  // Update vignette intensity when prop changes
  createEffect(() => {
    if (vignettePass) {
      vignettePass.uniforms.darkness.value = props.vignetteIntensity ?? 0.5
    }
  })

  // Handle resize
  createEffect(() => {
    const { width, height } = size()
    if (composer && width > 0 && height > 0) {
      composer.setSize(width, height)
      if (bloomPass) {
        bloomPass.resolution.set(width, height)
      }
    }
  })

  // This component doesn't render any DOM elements
  return null
}
