/**
 * ThreeContext - Core Context Provider for Three.js Integration
 *
 * Manages the Three.js renderer, scene, camera, and animation loop.
 * Provides access to these objects via context for child components.
 */

import {
  createContext,
  useContext,
  onMount,
  onCleanup,
  type ParentComponent,
  type Accessor,
} from 'solid-js'
import { createStore } from 'solid-js/store'
import * as THREE from 'three'

// ============ TYPES ============

export interface ThreeState {
  renderer: THREE.WebGLRenderer | null
  scene: THREE.Scene | null
  camera: THREE.PerspectiveCamera | null
  clock: THREE.Clock
  size: { width: number; height: number }
}

export type FrameCallback = (state: {
  delta: number
  elapsed: number
  clock: THREE.Clock
  camera: THREE.PerspectiveCamera
  scene: THREE.Scene
  gl: THREE.WebGLRenderer
}) => void

export interface ThreeContextValue {
  state: ThreeState
  gl: Accessor<THREE.WebGLRenderer | null>
  scene: Accessor<THREE.Scene | null>
  camera: Accessor<THREE.PerspectiveCamera | null>
  size: Accessor<{ width: number; height: number }>
  registerFrameCallback: (cb: FrameCallback, priority?: number) => () => void
  invalidate: () => void
  /** Set to true to skip the default renderer.render() call (used by PostProcessingEffects) */
  setSkipDefaultRender: (skip: boolean) => void
}

// ============ CONTEXT ============

const ThreeContext = createContext<ThreeContextValue>()

export const useThree = () => {
  const ctx = useContext(ThreeContext)
  if (!ctx) throw new Error('useThree must be used within ThreeCanvas')
  return ctx
}

// ============ PROVIDER ============

interface ThreeProviderProps {
  canvas: HTMLCanvasElement
  config?: Partial<THREE.WebGLRendererParameters>
  cameraConfig?: {
    fov?: number
    near?: number
    far?: number
    position?: [number, number, number]
  }
}

export const ThreeProvider: ParentComponent<ThreeProviderProps> = (props) => {
  const [state, setState] = createStore<ThreeState>({
    renderer: null,
    scene: null,
    camera: null,
    clock: new THREE.Clock(),
    size: { width: 0, height: 0 },
  })

  // Frame callbacks with priority (lower = runs first)
  const frameCallbacks = new Map<FrameCallback, number>()
  let sortedCallbacks: FrameCallback[] = []
  let skipDefaultRender = false  // Set by PostProcessingEffects to take over rendering

  const updateSortedCallbacks = () => {
    sortedCallbacks = [...frameCallbacks.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([cb]) => cb)
  }

  onMount(() => {
    // Create renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: props.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      ...props.config,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    // Create scene
    const scene = new THREE.Scene()

    // Create camera
    const cameraConfig = props.cameraConfig ?? {}
    const camera = new THREE.PerspectiveCamera(
      cameraConfig.fov ?? 50,
      1,
      cameraConfig.near ?? 0.1,
      cameraConfig.far ?? 1000
    )
    const position = cameraConfig.position ?? [0, 0, 3]
    camera.position.set(...position)

    setState({ renderer, scene, camera })

    // Handle resize
    const handleResize = () => {
      const parent = props.canvas.parentElement
      if (!parent) return

      const width = parent.clientWidth
      const height = parent.clientHeight

      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()

      setState('size', { width, height })
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    // ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(handleResize)
    if (props.canvas.parentElement) {
      resizeObserver.observe(props.canvas.parentElement)
    }

    // Animation loop - runs outside SolidJS reactive system
    let animationId: number
    const animate = () => {
      animationId = requestAnimationFrame(animate)

      const delta = state.clock.getDelta()
      const elapsed = state.clock.getElapsedTime()

      // Run all registered frame callbacks
      for (const cb of sortedCallbacks) {
        cb({
          delta,
          elapsed,
          clock: state.clock,
          camera,
          scene,
          gl: renderer,
        })
      }

      // Only render directly if PostProcessingEffects hasn't taken over
      if (!skipDefaultRender) {
        renderer.render(scene, camera)
      }
    }
    animate()

    onCleanup(() => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()
      renderer.dispose()
    })
  })

  const contextValue: ThreeContextValue = {
    state,
    gl: () => state.renderer,
    scene: () => state.scene,
    camera: () => state.camera,
    size: () => state.size,
    registerFrameCallback: (cb: FrameCallback, priority = 0) => {
      frameCallbacks.set(cb, priority)
      updateSortedCallbacks()
      return () => {
        frameCallbacks.delete(cb)
        updateSortedCallbacks()
      }
    },
    invalidate: () => {
      // For on-demand rendering (not used in continuous game loop)
    },
    setSkipDefaultRender: (skip: boolean) => {
      skipDefaultRender = skip
    },
  }

  return (
    <ThreeContext.Provider value={contextValue}>
      {props.children}
    </ThreeContext.Provider>
  )
}
