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

// Color palette - distinct colors for each region
const COLORS = {
  prefrontal: { r: 0.4, g: 0.6, b: 0.9 },      // Blue - decision making
  motor: { r: 0.9, g: 0.4, b: 0.4 },            // Red - movement
  somatosensory: { r: 0.9, g: 0.6, b: 0.3 },   // Orange - touch
  parietal: { r: 0.8, g: 0.8, b: 0.3 },        // Yellow - spatial
  temporal: { r: 0.5, g: 0.8, b: 0.5 },        // Green - memory/hearing
  occipital: { r: 0.7, g: 0.4, b: 0.8 },       // Purple - vision
  cerebellum: { r: 0.3, g: 0.7, b: 0.7 },      // Teal - coordination
  brainstem: { r: 0.6, g: 0.5, b: 0.4 },       // Brown - vital functions
  limbic: { r: 0.9, g: 0.5, b: 0.7 },          // Pink - emotion
  insular: { r: 0.5, g: 0.5, b: 0.7 },         // Slate - awareness
  broca: { r: 0.3, g: 0.5, b: 0.8 },           // Deep blue - speech production
  wernicke: { r: 0.4, g: 0.7, b: 0.6 },        // Sea green - language comprehension
  hippocampus: { r: 0.7, g: 0.6, b: 0.5 },     // Tan - memory formation
  amygdala: { r: 0.8, g: 0.3, b: 0.5 },        // Magenta - fear/emotion
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
