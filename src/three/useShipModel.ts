/**
 * Shared Ship Model Loading
 *
 * Cached GLB model loading shared between components
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { ShipStatus } from '@/stores/shipStore'
import { log } from '@/utils/logger'

// Engine glow colors by ship state
export const ENGINE_COLORS: Record<ShipStatus, number> = {
  idle: 0xffaa22,
  solving: 0x00ffff,
  deploying: 0xff4400,
  returning: 0x44ff44,
}

// Cached GLB model
let cachedModel: THREE.Group | null = null
let modelLoadPromise: Promise<THREE.Group> | null = null

/**
 * Loads the ship GLB model with caching
 * First call loads the model, subsequent calls return clones from cache
 */
export async function loadShipModel(): Promise<THREE.Group> {
  if (cachedModel) {
    return cloneModelWithMaterials(cachedModel)
  }

  if (modelLoadPromise) {
    await modelLoadPromise
    return cloneModelWithMaterials(cachedModel!)
  }

  modelLoadPromise = new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    loader.load(
      '/models/ship.glb',
      (gltf) => {
        cachedModel = gltf.scene

        // Minimal material setup - preserve original textures as much as possible
        // Only fix colorSpace for Three.js r150+ compatibility
        cachedModel.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material]
            for (const mat of materials) {
              if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
                // Fix texture colorSpace for proper color rendering
                if (mat.map) {
                  mat.map.colorSpace = THREE.SRGBColorSpace
                }
                if (mat.emissiveMap) {
                  mat.emissiveMap.colorSpace = THREE.SRGBColorSpace
                }
                if (mat.normalMap) {
                  mat.normalMap.colorSpace = THREE.NoColorSpace
                }
                if (mat.roughnessMap) {
                  mat.roughnessMap.colorSpace = THREE.NoColorSpace
                }
                if (mat.metalnessMap) {
                  mat.metalnessMap.colorSpace = THREE.NoColorSpace
                }

                // Don't modify material properties - keep original values from GLB
                // The scene lighting in ShipModel3D will illuminate the ship
              }
            }
          }
        })

        log.three.success('Ship model loaded successfully')
        resolve(cloneModelWithMaterials(cachedModel))
      },
      undefined,
      (error) => {
        log.three.error('Failed to load ship model:', error)
        reject(error)
      }
    )
  })

  return modelLoadPromise
}

/**
 * Clone a model with proper material cloning
 */
function cloneModelWithMaterials(model: THREE.Group): THREE.Group {
  const clone = model.clone()

  // Clone materials so each instance can have its own state
  clone.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      if (Array.isArray(child.material)) {
        child.material = child.material.map(m => m.clone())
      } else {
        child.material = child.material.clone()
      }
    }
  })

  return clone
}

/**
 * Get engine color for a ship state
 */
export function getEngineColor(state: ShipStatus | undefined): number {
  if (state && state in ENGINE_COLORS) {
    return ENGINE_COLORS[state]
  }
  return ENGINE_COLORS.idle
}
