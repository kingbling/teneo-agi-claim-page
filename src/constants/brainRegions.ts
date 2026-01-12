/**
 * Functional Brain Regions
 *
 * Defines 14 major functional areas of the brain with:
 * - Unique colors for visualization
 * - 3D bounding boxes for particle assignment
 * - Camera positions for navigation
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
  cameraPosition: [number, number, number]
  cameraTarget: [number, number, number]
}

// Color palette - high-contrast, well-separated hues for each region
// Phase 4.1: Increased saturation and pushed similar colors apart
const COLORS = {
  prefrontal: { r: 0.25, g: 0.45, b: 1.0 },    // Bright blue - decision making (pushed bluer)
  motor: { r: 1.0, g: 0.2, b: 0.2 },           // Pure red - movement (more saturated)
  somatosensory: { r: 1.0, g: 0.5, b: 0.15 },  // Vibrant orange - touch (more saturated)
  parietal: { r: 1.0, g: 0.9, b: 0.1 },        // Bright gold-yellow - spatial
  temporal: { r: 0.15, g: 0.95, b: 0.35 },     // Pure green - memory/hearing (more saturated)
  occipital: { r: 0.8, g: 0.25, b: 1.0 },      // Electric purple - vision (more saturated)
  cerebellum: { r: 0.1, g: 0.9, b: 0.9 },      // Cyan - coordination (more saturated)
  brainstem: { r: 0.75, g: 0.5, b: 0.3 },      // Warm brown - vital functions
  limbic: { r: 1.0, g: 0.35, b: 0.7 },         // Hot pink - emotion (more saturated)
  insular: { r: 0.55, g: 0.5, b: 0.95 },       // Periwinkle - awareness (pushed more purple)
  broca: { r: 0.45, g: 0.65, b: 1.0 },         // Light azure - speech (distinct from prefrontal)
  wernicke: { r: 0.4, g: 1.0, b: 0.75 },       // Mint - language comprehension (distinct from temporal)
  hippocampus: { r: 0.9, g: 0.7, b: 0.4 },     // Warm amber - memory formation (more saturated)
  amygdala: { r: 1.0, g: 0.15, b: 0.5 },       // Deep magenta - fear/emotion (more saturated)
}

export const FUNCTIONAL_BRAIN_REGIONS: BrainRegion[] = [
  {
    id: 'prefrontal',
    name: 'Prefrontal Cortex',
    description: 'Executive function, decision making, personality',
    color: COLORS.prefrontal,
    bounds: { xMin: -0.6, xMax: 0.6, yMin: 0.0, yMax: 0.8, zMin: 0.5, zMax: 1.2 },
    cameraPosition: [0, 0.5, 4],
    cameraTarget: [0, 0.2, 0.8],
  },
  {
    id: 'motor',
    name: 'Motor Cortex',
    description: 'Voluntary movement control',
    color: COLORS.motor,
    bounds: { xMin: -0.8, xMax: 0.8, yMin: 0.5, yMax: 1.0, zMin: 0.0, zMax: 0.5 },
    cameraPosition: [0, 3, 2],
    cameraTarget: [0, 0.7, 0.2],
  },
  {
    id: 'somatosensory',
    name: 'Somatosensory Cortex',
    description: 'Touch, temperature, pain processing',
    color: COLORS.somatosensory,
    bounds: { xMin: -0.8, xMax: 0.8, yMin: 0.5, yMax: 1.0, zMin: -0.3, zMax: 0.0 },
    cameraPosition: [0, 3, 1],
    cameraTarget: [0, 0.7, -0.15],
  },
  {
    id: 'parietal',
    name: 'Parietal Lobe',
    description: 'Spatial awareness, navigation, attention',
    color: COLORS.parietal,
    bounds: { xMin: -0.8, xMax: 0.8, yMin: 0.3, yMax: 0.8, zMin: -0.6, zMax: -0.1 },
    cameraPosition: [0, 2, -2],
    cameraTarget: [0, 0.5, -0.3],
  },
  {
    id: 'temporal-left',
    name: 'Left Temporal Lobe',
    description: 'Language, memory, hearing (left)',
    color: COLORS.temporal,
    bounds: { xMin: -1.2, xMax: -0.4, yMin: -0.4, yMax: 0.3, zMin: -0.2, zMax: 0.6 },
    cameraPosition: [-3, 0, 1],
    cameraTarget: [-0.8, 0, 0.2],
  },
  {
    id: 'temporal-right',
    name: 'Right Temporal Lobe',
    description: 'Music, facial recognition, memory (right)',
    color: COLORS.temporal,
    bounds: { xMin: 0.4, xMax: 1.2, yMin: -0.4, yMax: 0.3, zMin: -0.2, zMax: 0.6 },
    cameraPosition: [3, 0, 1],
    cameraTarget: [0.8, 0, 0.2],
  },
  {
    id: 'occipital',
    name: 'Occipital Lobe',
    description: 'Visual processing center',
    color: COLORS.occipital,
    bounds: { xMin: -0.6, xMax: 0.6, yMin: -0.2, yMax: 0.6, zMin: -1.2, zMax: -0.5 },
    cameraPosition: [0, 0.5, -4],
    cameraTarget: [0, 0.2, -0.8],
  },
  {
    id: 'cerebellum',
    name: 'Cerebellum',
    description: 'Balance, coordination, motor learning',
    color: COLORS.cerebellum,
    bounds: { xMin: -0.7, xMax: 0.7, yMin: -0.8, yMax: -0.2, zMin: -1.0, zMax: -0.3 },
    cameraPosition: [0, -2, -3],
    cameraTarget: [0, -0.5, -0.6],
  },
  {
    id: 'brainstem',
    name: 'Brainstem',
    description: 'Breathing, heartbeat, consciousness',
    color: COLORS.brainstem,
    bounds: { xMin: -0.3, xMax: 0.3, yMin: -1.0, yMax: -0.3, zMin: -0.3, zMax: 0.3 },
    cameraPosition: [2, -2, 2],
    cameraTarget: [0, -0.6, 0],
  },
  {
    id: 'limbic',
    name: 'Limbic System',
    description: 'Emotion, motivation, memory',
    color: COLORS.limbic,
    bounds: { xMin: -0.4, xMax: 0.4, yMin: -0.3, yMax: 0.3, zMin: -0.1, zMax: 0.4 },
    cameraPosition: [2, 1, 2],
    cameraTarget: [0, 0, 0.15],
  },
  {
    id: 'insular',
    name: 'Insular Cortex',
    description: 'Self-awareness, empathy, taste',
    color: COLORS.insular,
    bounds: { xMin: -0.9, xMax: -0.5, yMin: -0.1, yMax: 0.4, zMin: 0.0, zMax: 0.4 },
    cameraPosition: [-3, 0.5, 1],
    cameraTarget: [-0.7, 0.15, 0.2],
  },
  {
    id: 'broca',
    name: "Broca's Area",
    description: 'Speech production',
    color: COLORS.broca,
    bounds: { xMin: -1.0, xMax: -0.5, yMin: 0.0, yMax: 0.4, zMin: 0.4, zMax: 0.8 },
    cameraPosition: [-3, 0.5, 2],
    cameraTarget: [-0.75, 0.2, 0.6],
  },
  {
    id: 'wernicke',
    name: "Wernicke's Area",
    description: 'Language comprehension',
    color: COLORS.wernicke,
    bounds: { xMin: -1.0, xMax: -0.5, yMin: 0.0, yMax: 0.4, zMin: -0.4, zMax: 0.0 },
    cameraPosition: [-3, 0.5, -1],
    cameraTarget: [-0.75, 0.2, -0.2],
  },
  {
    id: 'hippocampus',
    name: 'Hippocampus',
    description: 'Memory formation and spatial navigation',
    color: COLORS.hippocampus,
    bounds: { xMin: -0.5, xMax: 0.5, yMin: -0.4, yMax: 0.0, zMin: -0.2, zMax: 0.3 },
    cameraPosition: [2, -1, 2],
    cameraTarget: [0, -0.2, 0.05],
  },
]

// Total number of regions
export const BRAIN_REGION_COUNT = FUNCTIONAL_BRAIN_REGIONS.length
