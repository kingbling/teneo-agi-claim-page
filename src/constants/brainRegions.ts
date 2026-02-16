/**
 * Functional Brain Regions
 *
 * Defines 10 brain parts matching the server-side brain_parts table.
 * Bounding boxes are computed from post-deformation coordinates (after ConstrainToBrainShape).
 * Sphere data is pre-deformation coordinates for 3D boundary rendering.
 */

export interface BrainRegion {
  id: string
  name: string
  description: string
  color: { r: number; g: number; b: number }
  bounds: {
    xMin: number; xMax: number
    yMin: number; yMax: number
    zMin: number; zMax: number
  }
  /** Pre-deformation sphere center + radius (for 3D boundary wireframe) */
  sphere: { cx: number; cy: number; cz: number; radius: number }
  /** Post-deformation center in world space */
  center: [number, number, number]
  cameraPosition: [number, number, number]
  cameraTarget: [number, number, number]
}

export const FUNCTIONAL_BRAIN_REGIONS: BrainRegion[] = [
  {
    id: 'prefrontal-cortex',
    name: 'Prefrontal Cortex',
    description: 'Executive function, decision making, personality',
    color: { r: 0.3, g: 0.6, b: 1.0 },
    bounds: { xMin: -1.65, xMax: -0.34, yMin: 0.12, yMax: 1.16, zMin: -0.32, zMax: 0.92 },
    sphere: { cx: -0.6, cy: 0.5, cz: 0.2, radius: 0.4 },
    center: [-1.057, 0.653, 0.3],
    cameraPosition: [-2, 1.5, 3],
    cameraTarget: [-1.057, 0.653, 0.3],
  },
  {
    id: 'motor-cortex',
    name: 'Motor Cortex',
    description: 'Voluntary movement control',
    color: { r: 0.9, g: 0.3, b: 0.3 },
    bounds: { xMin: -1.25, xMax: -0.16, yMin: 0.51, yMax: 1.26, zMin: -0.46, zMax: 0.47 },
    sphere: { cx: -0.4, cy: 0.7, cz: 0.0, radius: 0.3 },
    center: [-0.708, 0.917, 0],
    cameraPosition: [-1, 3, 2],
    cameraTarget: [-0.708, 0.917, 0],
  },
  {
    id: 'somatosensory-cortex',
    name: 'Somatosensory Cortex',
    description: 'Touch, temperature, body position',
    color: { r: 1.0, g: 0.7, b: 0.2 },
    bounds: { xMin: -1.39, xMax: -0.33, yMin: 0.11, yMax: 0.92, zMin: -0.89, zMax: 0.01 },
    sphere: { cx: -0.5, cy: 0.4, cz: -0.3, radius: 0.3 },
    center: [-0.866, 0.513, -0.443],
    cameraPosition: [-2, 1, -2],
    cameraTarget: [-0.866, 0.513, -0.443],
  },
  {
    id: 'auditory-cortex',
    name: 'Auditory Cortex',
    description: 'Sound processing and interpretation',
    color: { r: 0.5, g: 0.9, b: 0.4 },
    bounds: { xMin: 0.49, xMax: 1.58, yMin: -0.63, yMax: 0.14, zMin: -0.16, zMax: 0.75 },
    sphere: { cx: 0.6, cy: -0.2, cz: 0.2, radius: 0.3 },
    center: [1.039, -0.257, 0.295],
    cameraPosition: [3, 0, 1],
    cameraTarget: [1.039, -0.257, 0.295],
  },
  {
    id: 'visual-cortex',
    name: 'Visual Cortex',
    description: 'Visual information processing',
    color: { r: 0.8, g: 0.4, b: 0.9 },
    bounds: { xMin: -0.01, xMax: 1.36, yMin: -1.12, yMax: -0.24, zMin: -0.72, zMax: 0.42 },
    sphere: { cx: 0.4, cy: -0.6, cz: -0.1, radius: 0.4 },
    center: [0.643, -0.714, -0.137],
    cameraPosition: [1, -1.5, -3],
    cameraTarget: [0.643, -0.714, -0.137],
  },
  {
    id: 'hippocampus',
    name: 'Hippocampus',
    description: 'Memory formation and spatial navigation',
    color: { r: 0.2, g: 0.8, b: 0.6 },
    bounds: { xMin: 0.39, xMax: 1.3, yMin: -0.68, yMax: -0.05, zMin: -0.23, zMax: 0.52 },
    sphere: { cx: 0.5, cy: -0.3, cz: 0.1, radius: 0.25 },
    center: [0.856, -0.38, 0.146],
    cameraPosition: [2, -1, 2],
    cameraTarget: [0.856, -0.38, 0.146],
  },
  {
    id: 'thalamus',
    name: 'Thalamus',
    description: 'Sensory relay center',
    color: { r: 0.9, g: 0.9, b: 0.3 },
    bounds: { xMin: -0.37, xMax: 0.36, yMin: -0.24, yMax: 0.26, zMin: -0.31, zMax: 0.31 },
    sphere: { cx: 0.0, cy: 0.0, cz: 0.0, radius: 0.2 },
    center: [0, 0, 0],
    cameraPosition: [2, 1, 2],
    cameraTarget: [0, 0, 0],
  },
  {
    id: 'cerebellum',
    name: 'Cerebellum',
    description: 'Motor coordination, balance, learning',
    color: { r: 0.6, g: 0.3, b: 0.8 },
    bounds: { xMin: -0.58, xMax: 0.58, yMin: -1.17, yMax: -0.54, zMin: -1.05, zMax: -0.05 },
    sphere: { cx: 0.0, cy: -0.8, cz: -0.4, radius: 0.35 },
    center: [0, -0.958, -0.551],
    cameraPosition: [0, -2, -3],
    cameraTarget: [0, -0.958, -0.551],
  },
  {
    id: 'temporal-lobe',
    name: 'Temporal Lobe',
    description: 'Language comprehension, auditory processing',
    color: { r: 0.3, g: 0.7, b: 0.5 },
    bounds: { xMin: 0.69, xMax: 1.72, yMin: -0.52, yMax: 0.28, zMin: -0.02, zMax: 0.9 },
    sphere: { cx: 0.7, cy: -0.1, cz: 0.3, radius: 0.3 },
    center: [1.22, -0.129, 0.445],
    cameraPosition: [3, 0, 2],
    cameraTarget: [1.22, -0.129, 0.445],
  },
  {
    id: 'parietal-lobe',
    name: 'Parietal Lobe',
    description: 'Spatial awareness, sensory integration',
    color: { r: 0.7, g: 0.5, b: 0.3 },
    bounds: { xMin: -1.57, xMax: -0.51, yMin: -0.02, yMax: 0.79, zMin: -0.74, zMax: 0.17 },
    sphere: { cx: -0.6, cy: 0.3, cz: -0.2, radius: 0.3 },
    center: [-1.039, 0.385, -0.295],
    cameraPosition: [-2, 1, -2],
    cameraTarget: [-1.039, 0.385, -0.295],
  },
]

// Total number of regions
export const BRAIN_REGION_COUNT = FUNCTIONAL_BRAIN_REGIONS.length
