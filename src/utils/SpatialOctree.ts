import * as THREE from 'three'

/**
 * SpatialOctree - O(log n) spatial index for efficient raycasting against 500k+ points
 *
 * Instead of checking all points against the ray (O(n)), we:
 * 1. Build an octree partitioning the 3D space
 * 2. Only check points in octree nodes that intersect the ray
 * 3. This reduces average checks from 500k to ~200-500
 */

interface OctreeNode {
  min: THREE.Vector3
  max: THREE.Vector3
  children: OctreeNode[] | null  // 8 children if not leaf
  indices: number[] | null       // Point indices if leaf
}

export class SpatialOctree {
  private root: OctreeNode
  private positions: Float32Array
  private tempVec = new THREE.Vector3()
  private tempBox = new THREE.Box3()

  constructor(
    positions: Float32Array,
    maxDepth = 8,
    maxLeafSize = 64
  ) {
    this.positions = positions
    const count = positions.length / 3

    // Calculate bounding box
    const min = new THREE.Vector3(Infinity, Infinity, Infinity)
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)

    for (let i = 0; i < count; i++) {
      const x = positions[i * 3]
      const y = positions[i * 3 + 1]
      const z = positions[i * 3 + 2]
      min.x = Math.min(min.x, x)
      min.y = Math.min(min.y, y)
      min.z = Math.min(min.z, z)
      max.x = Math.max(max.x, x)
      max.y = Math.max(max.y, y)
      max.z = Math.max(max.z, z)
    }

    // Add small padding to avoid edge cases
    min.subScalar(0.001)
    max.addScalar(0.001)

    // Build tree with all indices
    const allIndices: number[] = []
    for (let i = 0; i < count; i++) {
      allIndices.push(i)
    }

    this.root = this.buildNode(allIndices, min, max, 0, maxDepth, maxLeafSize)
  }

  private buildNode(
    indices: number[],
    min: THREE.Vector3,
    max: THREE.Vector3,
    depth: number,
    maxDepth: number,
    maxLeafSize: number
  ): OctreeNode {
    // Create leaf if at max depth or small enough
    if (depth >= maxDepth || indices.length <= maxLeafSize) {
      return {
        min: min.clone(),
        max: max.clone(),
        children: null,
        indices: indices.length > 0 ? [...indices] : null,
      }
    }

    // Calculate center for splitting
    const center = new THREE.Vector3()
    center.addVectors(min, max).multiplyScalar(0.5)

    // Partition indices into 8 children
    const childIndices: number[][] = [[], [], [], [], [], [], [], []]

    for (const idx of indices) {
      const x = this.positions[idx * 3]
      const y = this.positions[idx * 3 + 1]
      const z = this.positions[idx * 3 + 2]

      // Determine which octant (0-7)
      let octant = 0
      if (x >= center.x) octant |= 1
      if (y >= center.y) octant |= 2
      if (z >= center.z) octant |= 4

      childIndices[octant].push(idx)
    }

    // Build children
    const children: OctreeNode[] = []
    for (let i = 0; i < 8; i++) {
      const childMin = new THREE.Vector3(
        (i & 1) ? center.x : min.x,
        (i & 2) ? center.y : min.y,
        (i & 4) ? center.z : min.z
      )
      const childMax = new THREE.Vector3(
        (i & 1) ? max.x : center.x,
        (i & 2) ? max.y : center.y,
        (i & 4) ? max.z : center.z
      )

      children.push(
        this.buildNode(childIndices[i], childMin, childMax, depth + 1, maxDepth, maxLeafSize)
      )
    }

    return {
      min: min.clone(),
      max: max.clone(),
      children,
      indices: null,
    }
  }

  /**
   * Find the closest point to a ray within a given threshold distance
   * @param ray The ray to test against
   * @param maxDist Maximum distance from ray to consider
   * @returns Index of closest point, or null if none within threshold
   */
  findClosest(ray: THREE.Ray, maxDist: number): number | null {
    const candidates = this.collectCandidates(ray, this.root, maxDist)

    let closestIndex: number | null = null
    let closestDist = maxDist

    for (const idx of candidates) {
      this.tempVec.set(
        this.positions[idx * 3],
        this.positions[idx * 3 + 1],
        this.positions[idx * 3 + 2]
      )
      const dist = ray.distanceToPoint(this.tempVec)
      if (dist < closestDist) {
        closestDist = dist
        closestIndex = idx
      }
    }

    return closestIndex
  }

  /**
   * Find all points within a given distance from a ray
   * @param ray The ray to test against
   * @param maxDist Maximum distance from ray to consider
   * @returns Array of point indices within threshold
   */
  findAllWithinDistance(ray: THREE.Ray, maxDist: number): number[] {
    const candidates = this.collectCandidates(ray, this.root, maxDist)
    const results: number[] = []

    for (const idx of candidates) {
      this.tempVec.set(
        this.positions[idx * 3],
        this.positions[idx * 3 + 1],
        this.positions[idx * 3 + 2]
      )
      const dist = ray.distanceToPoint(this.tempVec)
      if (dist < maxDist) {
        results.push(idx)
      }
    }

    return results
  }

  private collectCandidates(ray: THREE.Ray, node: OctreeNode, maxDist: number): number[] {
    // Check if ray intersects node's bounding box (expanded by maxDist)
    this.tempBox.min.copy(node.min).subScalar(maxDist)
    this.tempBox.max.copy(node.max).addScalar(maxDist)

    if (!ray.intersectsBox(this.tempBox)) {
      return []
    }

    // If leaf node, return all indices
    if (node.indices !== null) {
      return node.indices
    }

    // Otherwise, recursively collect from children
    const results: number[] = []
    if (node.children) {
      for (const child of node.children) {
        results.push(...this.collectCandidates(ray, child, maxDist))
      }
    }

    return results
  }

  /**
   * Get the position of a point by index
   */
  getPosition(index: number): THREE.Vector3 {
    return new THREE.Vector3(
      this.positions[index * 3],
      this.positions[index * 3 + 1],
      this.positions[index * 3 + 2]
    )
  }

  /**
   * Get statistics about the octree
   */
  getStats(): { nodeCount: number; leafCount: number; maxLeafSize: number; avgLeafSize: number } {
    let nodeCount = 0
    let leafCount = 0
    let maxLeafSize = 0
    let totalLeafSize = 0

    const countNodes = (node: OctreeNode) => {
      nodeCount++
      if (node.indices !== null) {
        leafCount++
        const size = node.indices.length
        maxLeafSize = Math.max(maxLeafSize, size)
        totalLeafSize += size
      } else if (node.children) {
        for (const child of node.children) {
          countNodes(child)
        }
      }
    }

    countNodes(this.root)

    return {
      nodeCount,
      leafCount,
      maxLeafSize,
      avgLeafSize: leafCount > 0 ? totalLeafSize / leafCount : 0,
    }
  }
}
