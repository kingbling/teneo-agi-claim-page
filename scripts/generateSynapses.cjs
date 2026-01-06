/**
 * Generate 1 million synapse nodes for the brain visualization
 *
 * Run with: node scripts/generateSynapses.js
 */

const fs = require('fs')
const path = require('path')

// Brain regions with their spatial characteristics
const REGIONS = {
  frontal: {
    weight: 0.25, // 25% of synapses
    generatePosition: () => {
      const theta = Math.random() * Math.PI * 0.4 - Math.PI * 0.2 // Front angle
      const phi = Math.random() * Math.PI * 0.5 + Math.PI * 0.25 // Upper hemisphere
      return sphericalToCartesian(1, theta, phi, { x: 0, y: 0.2, z: 0.3 })
    }
  },
  parietal: {
    weight: 0.20, // 20% of synapses
    generatePosition: () => {
      const theta = Math.random() * Math.PI * 0.6 - Math.PI * 0.3
      const phi = Math.random() * Math.PI * 0.4 + Math.PI * 0.1 // Top of head
      return sphericalToCartesian(1, theta, phi, { x: 0, y: 0.3, z: 0 })
    }
  },
  temporal: {
    weight: 0.20, // 20% of synapses
    generatePosition: () => {
      const side = Math.random() > 0.5 ? 1 : -1
      const theta = side * (Math.PI * 0.3 + Math.random() * Math.PI * 0.2)
      const phi = Math.random() * Math.PI * 0.4 + Math.PI * 0.35
      return sphericalToCartesian(1, theta, phi, { x: 0, y: -0.1, z: 0.1 })
    }
  },
  occipital: {
    weight: 0.15, // 15% of synapses
    generatePosition: () => {
      const theta = Math.random() * Math.PI * 0.4 - Math.PI * 0.2
      const phi = Math.random() * Math.PI * 0.4 + Math.PI * 0.5 // Back lower
      return sphericalToCartesian(1, theta, phi, { x: 0, y: 0.1, z: -0.4 })
    }
  },
  cerebellum: {
    weight: 0.12, // 12% of synapses
    generatePosition: () => {
      const theta = Math.random() * Math.PI * 0.5 - Math.PI * 0.25
      const phi = Math.random() * Math.PI * 0.3 + Math.PI * 0.6
      return sphericalToCartesian(0.7, theta, phi, { x: 0, y: -0.4, z: -0.3 })
    }
  },
  brainstem: {
    weight: 0.08, // 8% of synapses
    generatePosition: () => {
      const theta = Math.random() * Math.PI * 0.3 - Math.PI * 0.15
      const phi = Math.random() * Math.PI * 0.2 + Math.PI * 0.7
      return sphericalToCartesian(0.5, theta, phi, { x: 0, y: -0.7, z: 0 })
    }
  }
}

// Convert spherical coordinates to cartesian with offset
function sphericalToCartesian(r, theta, phi, offset) {
  // Add some randomness to radius for organic look
  const actualR = r * (0.85 + Math.random() * 0.3)

  const x = actualR * Math.sin(phi) * Math.cos(theta) + offset.x + (Math.random() - 0.5) * 0.15
  const y = actualR * Math.cos(phi) + offset.y + (Math.random() - 0.5) * 0.15
  const z = actualR * Math.sin(phi) * Math.sin(theta) + offset.z + (Math.random() - 0.5) * 0.15

  // Normalize to unit sphere (the visualization code will handle scaling)
  const len = Math.sqrt(x * x + y * y + z * z)
  return {
    x: x / len,
    y: y / len,
    z: z / len
  }
}

// Generate random user ID
function generateUserId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = 'user_'
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  id += '_'
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}

// Generate random date in the past year
function generateRandomDate() {
  const now = Date.now()
  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000
  const randomTime = oneYearAgo + Math.random() * (now - oneYearAgo)
  const date = new Date(randomTime)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// Main generation function
function generateSynapses(totalCount = 1000000) {
  console.log(`Generating ${totalCount.toLocaleString()} synapses...`)

  const synapses = []
  const regionCounters = {}

  // Calculate counts per region based on weights
  const regionCounts = {}
  let assigned = 0
  const regionNames = Object.keys(REGIONS)

  for (let i = 0; i < regionNames.length - 1; i++) {
    const region = regionNames[i]
    const count = Math.floor(totalCount * REGIONS[region].weight)
    regionCounts[region] = count
    assigned += count
    regionCounters[region] = 0
  }
  // Last region gets the remainder
  const lastRegion = regionNames[regionNames.length - 1]
  regionCounts[lastRegion] = totalCount - assigned
  regionCounters[lastRegion] = 0

  console.log('Distribution per region:')
  for (const [region, count] of Object.entries(regionCounts)) {
    console.log(`  ${region}: ${count.toLocaleString()}`)
  }

  // Generate synapses for each region
  for (const [region, count] of Object.entries(regionCounts)) {
    const regionConfig = REGIONS[region]

    for (let i = 0; i < count; i++) {
      const position = regionConfig.generatePosition()
      const synapseId = `synapse_${region}_${String(regionCounters[region]).padStart(6, '0')}`
      regionCounters[region]++

      // 99.9995% connected, 5 pending (available for user to claim)
      const isPending = synapses.length >= totalCount - 5

      synapses.push({
        id: synapseId,
        region_id: region,
        position_x: position.x,
        position_y: position.y,
        position_z: position.z,
        state: isPending ? 'pending' : 'connected',
        connected_by_user_id: isPending ? null : generateUserId(),
        connected_at: isPending ? null : generateRandomDate(),
        base_reward_points: 100
      })

      // Progress indicator
      if (synapses.length % 100000 === 0) {
        console.log(`  Generated ${synapses.length.toLocaleString()} synapses...`)
      }
    }
  }

  console.log(`Total synapses generated: ${synapses.length.toLocaleString()}`)
  return synapses
}

// Generate connections between nearby nodes (sparse to avoid huge file)
function generateConnections(synapses, maxConnectionsPerNode = 2, sampleRate = 0.01) {
  console.log('Generating synapse connections (sampled)...')

  const connections = []
  const sampleSize = Math.floor(synapses.length * sampleRate)

  // Only sample a subset for connections to keep file size manageable
  const sampledIndices = new Set()
  while (sampledIndices.size < sampleSize) {
    sampledIndices.add(Math.floor(Math.random() * synapses.length))
  }

  let connectionId = 0
  for (const idx of sampledIndices) {
    const synapse = synapses[idx]
    if (synapse.state !== 'connected') continue

    // Find nearby synapses
    const nearby = []
    for (let j = Math.max(0, idx - 100); j < Math.min(synapses.length, idx + 100); j++) {
      if (j === idx) continue
      const other = synapses[j]
      if (other.state !== 'connected') continue
      if (other.region_id !== synapse.region_id) continue

      const dx = other.position_x - synapse.position_x
      const dy = other.position_y - synapse.position_y
      const dz = other.position_z - synapse.position_z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

      if (dist < 0.3) {
        nearby.push({ synapse: other, dist })
      }
    }

    // Connect to nearest nodes
    nearby.sort((a, b) => a.dist - b.dist)
    for (let i = 0; i < Math.min(maxConnectionsPerNode, nearby.length); i++) {
      connections.push({
        id: connectionId++,
        from_node_id: synapse.id,
        to_node_id: nearby[i].synapse.id,
        strength: 0.5 + Math.random() * 0.5,
        created_at: synapse.connected_at
      })
    }
  }

  console.log(`Generated ${connections.length.toLocaleString()} connections`)
  return connections
}

// Main
const synapses = generateSynapses(1000000)

// Write synapses JSON
const synapseOutputPath = path.join(__dirname, '../src/data/synapseNodes.json')
console.log(`Writing to ${synapseOutputPath}...`)
fs.writeFileSync(synapseOutputPath, JSON.stringify(synapses, null, 2))
console.log('Done writing synapseNodes.json')

// Generate and write connections
const connections = generateConnections(synapses)
const connectionsOutputPath = path.join(__dirname, '../src/data/synapseConnections.json')
console.log(`Writing to ${connectionsOutputPath}...`)
fs.writeFileSync(connectionsOutputPath, JSON.stringify(connections, null, 2))
console.log('Done writing synapseConnections.json')

// Update global stats
const globalStatsPath = path.join(__dirname, '../src/data/globalStats.json')
const globalStats = JSON.parse(fs.readFileSync(globalStatsPath, 'utf8'))
globalStats.total_synapses = synapses.filter(s => s.state === 'connected').length
globalStats.last_updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19)
fs.writeFileSync(globalStatsPath, JSON.stringify(globalStats, null, 2))
console.log('Updated globalStats.json')

console.log('\nAll done!')
