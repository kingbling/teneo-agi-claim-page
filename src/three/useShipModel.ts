/**
 * Shared Ship Model Loading
 *
 * Cached GLB model loading per ship type for InstancedMesh rendering.
 * Each ship type (neuron, synapse, dendrite) has its own cached model.
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { log } from '@/utils/logger'
import { configStore } from '@/stores/configStore'
import type { ShipType } from '@/stores/shipStore.types'

// Per-type cached models
const cachedModels = new Map<ShipType, THREE.Group>()
const loadPromises = new Map<ShipType, Promise<THREE.Group>>()

/**
 * Loads a ship GLB model for a specific ship type with caching.
 * First call loads the model, subsequent calls return clones from cache.
 */
export async function loadShipModel(type: ShipType = 'neuron'): Promise<THREE.Group> {
  const cached = cachedModels.get(type)
  if (cached) {
    return cloneModelWithMaterials(cached)
  }

  const existing = loadPromises.get(type)
  if (existing) {
    await existing
    return cloneModelWithMaterials(cachedModels.get(type)!)
  }

  const promise = new Promise<THREE.Group>((resolve, reject) => {
    const loader = new GLTFLoader()
    loader.load(
      `/models/${type}.glb`,
      (gltf) => {
        const model = gltf.scene

        // Fix colorSpace for Three.js r150+ compatibility
        model.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material]
            for (const mat of materials) {
              if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
                if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace
                if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace
                if (mat.normalMap) mat.normalMap.colorSpace = THREE.NoColorSpace
                if (mat.roughnessMap) mat.roughnessMap.colorSpace = THREE.NoColorSpace
                if (mat.metalnessMap) mat.metalnessMap.colorSpace = THREE.NoColorSpace
              }
            }
          }
        })

        cachedModels.set(type, model)
        log.three.success(`Ship model loaded: ${type}`)
        resolve(cloneModelWithMaterials(model))
      },
      undefined,
      (error) => {
        log.three.error(`Failed to load ship model (${type}):`, error)
        reject(error)
      }
    )
  })

  loadPromises.set(type, promise)
  return promise
}

/**
 * Preloads all ship type models in parallel.
 * Uses configStore.shipTypes if available, falls back to default list.
 * Returns a map of ShipType → model clone.
 */
export async function loadAllShipModels(): Promise<Map<ShipType, THREE.Group>> {
  const shipTypes = configStore.shipTypes
  const typeNames: ShipType[] = shipTypes.length > 0
    ? shipTypes.map(t => t.name)
    : ['neuron', 'synapse', 'dendrite', 'axon', 'cortex']

  const results = await Promise.allSettled(
    typeNames.map(async (type) => {
      const model = await loadShipModel(type)
      return [type, model] as const
    })
  )
  const map = new Map<ShipType, THREE.Group>()
  for (const result of results) {
    if (result.status === 'fulfilled') {
      map.set(result.value[0], result.value[1])
    }
  }
  return map
}

/**
 * Clone a model with proper material cloning
 */
function cloneModelWithMaterials(model: THREE.Group): THREE.Group {
  const clone = model.clone()

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
