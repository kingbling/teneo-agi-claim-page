/**
 * RegionBoundary - 3D organic wireframe boundary for selected brain region
 *
 * Samples the region's pre-deformation sphere through constrainToBrainShape()
 * to produce a mesh that matches the actual brain volume.
 */

import { createEffect, onCleanup } from 'solid-js'
import * as THREE from 'three'
import { useThree } from '@/three/hooks'
import { FUNCTIONAL_BRAIN_REGIONS } from '@/constants/brainRegions'
import { constrainToBrainShape } from '@/components/brain/core/brainConstants'

interface RegionBoundaryProps {
  selectedRegionIndex: number
}

/**
 * Build a deformed sphere geometry by sampling the pre-deformation sphere
 * surface and running each point through constrainToBrainShape().
 */
function buildDeformedSphereGeometry(
  sphere: { cx: number; cy: number; cz: number; radius: number },
  latSegs: number,
  lonSegs: number,
): THREE.BufferGeometry {
  const vertices: number[] = []
  const indices: number[] = []

  // Generate vertices: (latSegs+1) rows x (lonSegs+1) columns
  for (let lat = 0; lat <= latSegs; lat++) {
    const theta = (lat / latSegs) * Math.PI // 0 to PI (pole to pole)
    const sinTheta = Math.sin(theta)
    const cosTheta = Math.cos(theta)

    for (let lon = 0; lon <= lonSegs; lon++) {
      const phi = (lon / lonSegs) * Math.PI * 2 // 0 to 2PI

      // Pre-deformation point on sphere surface
      const rawX = sphere.cx + sphere.radius * sinTheta * Math.cos(phi)
      const rawY = sphere.cy + sphere.radius * cosTheta
      const rawZ = sphere.cz + sphere.radius * sinTheta * Math.sin(phi)

      // Run through brain shape deformation → world space
      const [wx, wy, wz] = constrainToBrainShape(rawX, rawY, rawZ)
      vertices.push(wx, wy, wz)
    }
  }

  // Generate triangle indices (standard sphere tessellation)
  for (let lat = 0; lat < latSegs; lat++) {
    for (let lon = 0; lon < lonSegs; lon++) {
      const a = lat * (lonSegs + 1) + lon
      const b = a + lonSegs + 1

      indices.push(a, b, a + 1)
      indices.push(b, b + 1, a + 1)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  return geometry
}

export function RegionBoundary(props: RegionBoundaryProps) {
  const { scene } = useThree()

  let wireframe: THREE.LineSegments | null = null
  let fillMesh: THREE.Mesh | null = null
  let edgeGeometry: THREE.EdgesGeometry | null = null
  let wireMaterial: THREE.LineBasicMaterial | null = null
  let fillGeometry: THREE.BufferGeometry | null = null
  let fillMaterial: THREE.MeshBasicMaterial | null = null

  function cleanup() {
    const sceneObj = scene()
    if (sceneObj) {
      if (wireframe) sceneObj.remove(wireframe)
      if (fillMesh) sceneObj.remove(fillMesh)
    }
    edgeGeometry?.dispose()
    wireMaterial?.dispose()
    fillGeometry?.dispose()
    fillMaterial?.dispose()
    wireframe = null
    fillMesh = null
    edgeGeometry = null
    wireMaterial = null
    fillGeometry = null
    fillMaterial = null
  }

  createEffect(() => {
    const sceneObj = scene()
    if (!sceneObj) return

    const regionIndex = props.selectedRegionIndex

    // Clean up previous
    cleanup()

    // No region selected
    if (regionIndex < 0 || regionIndex >= FUNCTIONAL_BRAIN_REGIONS.length) return

    const region = FUNCTIONAL_BRAIN_REGIONS[regionIndex]
    const color = new THREE.Color(region.color.r, region.color.g, region.color.b)

    // Build deformed sphere geometry (vertices already in world space)
    const sphereGeo = buildDeformedSphereGeometry(region.sphere, 24, 24)

    // Wireframe from edges
    edgeGeometry = new THREE.EdgesGeometry(sphereGeo, 15)
    wireMaterial = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      depthTest: true,
    })
    wireframe = new THREE.LineSegments(edgeGeometry, wireMaterial)
    wireframe.frustumCulled = false
    sceneObj.add(wireframe)

    // Subtle transparent fill for volume perception
    fillGeometry = sphereGeo
    fillMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.04,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    fillMesh = new THREE.Mesh(fillGeometry, fillMaterial)
    fillMesh.frustumCulled = false
    sceneObj.add(fillMesh)
  })

  onCleanup(cleanup)

  return null
}
