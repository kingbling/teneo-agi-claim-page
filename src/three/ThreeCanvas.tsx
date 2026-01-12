/**
 * ThreeCanvas - Main Canvas Component for Three.js
 *
 * Creates a WebGL canvas and provides the Three.js context to children.
 * Replaces React Three Fiber's <Canvas> component.
 */

import {
  type Component,
  type ParentComponent,
  createSignal,
  onMount,
  Show,
} from 'solid-js'
import { ThreeProvider } from './ThreeContext'
import type * as THREE from 'three'

interface ThreeCanvasProps {
  class?: string
  style?: string | Record<string, string>
  gl?: Partial<THREE.WebGLRendererParameters>
  camera?: {
    fov?: number
    near?: number
    far?: number
    position?: [number, number, number]
  }
  fallback?: Component
}

export const ThreeCanvas: ParentComponent<ThreeCanvasProps> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined
  const [ready, setReady] = createSignal(false)

  onMount(() => {
    if (canvasRef) {
      setReady(true)
    }
  })

  return (
    <div
      class={`relative w-full h-full ${props.class || ''}`}
      style={typeof props.style === 'string' ? props.style : props.style}
    >
      <canvas
        ref={canvasRef}
        class="w-full h-full block"
        style="touch-action: none;"
      />
      <Show when={ready() && canvasRef}>
        <ThreeProvider
          canvas={canvasRef!}
          config={props.gl}
          cameraConfig={props.camera}
        >
          {props.children}
        </ThreeProvider>
      </Show>
    </div>
  )
}

export default ThreeCanvas
