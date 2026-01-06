/**
 * Generate clustered synapse visualization data
 *
 * Creates ~10,000 cluster representatives from 1 million logical synapses.
 * Each cluster has a weight indicating how many synapses it represents.
 *
 * Run with: node scripts/generateClusteredSynapses.cjs
 */

const fs = require('fs')
const path = require('path')

// Configuration
const TOTAL_LOGICAL_SYNAPSES = 1000000  // What we show in stats
const CLUSTER_COUNT = 8000               // Actual rendered points
const PENDING_COUNT = 5                   // Available for user to claim

// Brain regions with spatial characteristics
const REGIONS = {
  frontal: {
    weight: 0.25,
    center: { x: 0, y: 0.3, z: 0.5 },
    spread: { theta: [-0.4, 0.4], phi: [0.3, 0.7] }
  },
  parietal: {
    weight: 0.20,
    center: { x: 0, y: 0.5, z: 0 },
    spread: { theta: [-0.5, 0.5], phi: [0.15, 0.45] }
  },
  temporal: {
    weight: 0.20,
    center: { x: 0, y: 0, z: 0.1 },
    spread: { theta: [0.8, 1.4], phi: [0.4, 0.7] },  // Will mirror for both sides
    bilateral: true
  },
  occipital: {
    weight: 0.15,
    center: { x: 0, y: 0.2, z: -0.5 },
    spread: { theta: [-0.35, 0.35], phi: [0.5, 0.8] }
  },
  cerebellum: {
    weight: 0.12,
    center: { x: 0, y: -0.35, z: -0.35 },
    spread: { theta: [-0.4, 0.4], phi: [0.6, 0.85] },
    scale: 0.7
  },
  brainstem: {
    weight: 0.08,
    center: { x: 0, y: -0.6, z: -0.1 },
    spread: { theta: [-0.25, 0.25], phi: [0.65, 0.85] },
    scale: 0.5
  }
}

// Generate position for a region
function generateRegionPosition(region, config) {
  const scale = config.scale || 1.0
  const [thetaMin, thetaMax] = config.spread.theta
  const [phiMin, phiMax] = config.spread.phi

  let theta = thetaMin + Math.random() * (thetaMax - thetaMin)
  const phi = phiMin + Math.random() * (phiMax - phiMin)

  // For bilateral regions, randomly pick left or right side
  if (config.bilateral) {
    if (Math.random() > 0.5) {
      theta = -theta
    }
  }

  // Spherical to cartesian
  const r = scale * (0.85 + Math.random() * 0.25)
  let x = r * Math.sin(phi * Math.PI) * Math.cos(theta * Math.PI)
  let y = r * Math.cos(phi * Math.PI)
  let z = r * Math.sin(phi * Math.PI) * Math.sin(theta * Math.PI)

  // Add region offset
  x += config.center.x * 0.3
  y += config.center.y * 0.3
  z += config.center.z * 0.3

  // Add noise for organic look
  x += (Math.random() - 0.5) * 0.12
  y += (Math.random() - 0.5) * 0.12
  z += (Math.random() - 0.5) * 0.12

  // Normalize to unit sphere
  const len = Math.sqrt(x * x + y * y + z * z)
  return { x: x / len, y: y / len, z: z / len }
}

// Generate user ID
function generateUserId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = 'user_'
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)]
  id += '_'
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}

// Generate date
function generateDate() {
  const now = Date.now()
  const pastYear = now - 365 * 24 * 60 * 60 * 1000
  const date = new Date(pastYear + Math.random() * (now - pastYear))
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

// Main generation
function generate() {
  console.log(`Generating ${CLUSTER_COUNT.toLocaleString()} cluster representatives`)
  console.log(`Representing ${TOTAL_LOGICAL_SYNAPSES.toLocaleString()} logical synapses\n`)

  const synapses = []
  const regionNames = Object.keys(REGIONS)

  // Calculate clusters per region
  const clusterCounts = {}
  let assigned = 0
  for (let i = 0; i < regionNames.length - 1; i++) {
    const region = regionNames[i]
    const count = Math.floor(CLUSTER_COUNT * REGIONS[region].weight)
    clusterCounts[region] = count
    assigned += count
  }
  clusterCounts[regionNames[regionNames.length - 1]] = CLUSTER_COUNT - assigned

  // Calculate synapses per cluster (weight)
  const synapsesPerCluster = Math.floor(TOTAL_LOGICAL_SYNAPSES / CLUSTER_COUNT)

  console.log('Clusters per region:')
  for (const [region, count] of Object.entries(clusterCounts)) {
    const logicalCount = count * synapsesPerCluster
    console.log(`  ${region}: ${count} clusters (~${logicalCount.toLocaleString()} synapses)`)
  }
  console.log('')

  // Generate clusters for each region
  const regionCounters = {}
  for (const region of regionNames) regionCounters[region] = 0

  for (const [region, count] of Object.entries(clusterCounts)) {
    const config = REGIONS[region]

    for (let i = 0; i < count; i++) {
      const pos = generateRegionPosition(region, config)
      const id = `synapse_${region}_${String(regionCounters[region]).padStart(5, '0')}`
      regionCounters[region]++

      // Weight varies slightly for visual interest
      const weight = synapsesPerCluster + Math.floor((Math.random() - 0.5) * synapsesPerCluster * 0.3)

      synapses.push({
        id,
        region_id: region,
        position_x: pos.x,
        position_y: pos.y,
        position_z: pos.z,
        state: 'connected',
        connected_by_user_id: generateUserId(),
        connected_at: generateDate(),
        base_reward_points: 100,
        cluster_weight: weight  // How many synapses this represents
      })
    }
  }

  // Add pending nodes (these are individual, not clusters)
  for (let i = 0; i < PENDING_COUNT; i++) {
    // Spread pending across regions
    const region = regionNames[i % regionNames.length]
    const config = REGIONS[region]
    const pos = generateRegionPosition(region, config)

    synapses.push({
      id: `synapse_pending_${String(i).padStart(3, '0')}`,
      region_id: region,
      position_x: pos.x,
      position_y: pos.y,
      position_z: pos.z,
      state: 'pending',
      connected_by_user_id: null,
      connected_at: null,
      base_reward_points: 100,
      cluster_weight: 1  // Individual synapse
    })
  }

  console.log(`Generated ${synapses.length} total entries`)
  console.log(`  - ${CLUSTER_COUNT} cluster representatives`)
  console.log(`  - ${PENDING_COUNT} pending (claimable) synapses\n`)

  return synapses
}

// Generate sparse connections (for electron flow visualization)
function generateConnections(synapses) {
  console.log('Generating connections...')
  const connections = []
  let connId = 0

  // Only connect a sample of nearby nodes
  const connected = synapses.filter(s => s.state === 'connected')

  for (let i = 0; i < connected.length; i++) {
    const synapse = connected[i]

    // Find 1-2 nearby synapses in same region
    const nearby = []
    for (let j = i + 1; j < Math.min(i + 50, connected.length); j++) {
      const other = connected[j]
      if (other.region_id !== synapse.region_id) continue

      const dx = other.position_x - synapse.position_x
      const dy = other.position_y - synapse.position_y
      const dz = other.position_z - synapse.position_z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

      if (dist < 0.25) {
        nearby.push({ other, dist })
      }
    }

    nearby.sort((a, b) => a.dist - b.dist)
    const toConnect = nearby.slice(0, Math.random() > 0.5 ? 2 : 1)

    for (const { other } of toConnect) {
      connections.push({
        id: connId++,
        from_node_id: synapse.id,
        to_node_id: other.id,
        strength: 0.5 + Math.random() * 0.5,
        created_at: synapse.connected_at
      })
    }
  }

  console.log(`Generated ${connections.length} connections\n`)
  return connections
}

// Write files
const synapses = generate()
const connections = generateConnections(synapses)

// Write synapses
const synapsePath = path.join(__dirname, '../src/data/synapseNodes.json')
fs.writeFileSync(synapsePath, JSON.stringify(synapses, null, 2))
console.log(`Written: ${synapsePath}`)
console.log(`  Size: ${(fs.statSync(synapsePath).size / 1024).toFixed(1)} KB\n`)

// Write connections
const connPath = path.join(__dirname, '../src/data/synapseConnections.json')
fs.writeFileSync(connPath, JSON.stringify(connections, null, 2))
console.log(`Written: ${connPath}`)
console.log(`  Size: ${(fs.statSync(connPath).size / 1024).toFixed(1)} KB\n`)

// Update global stats to show 1 million
const statsPath = path.join(__dirname, '../src/data/globalStats.json')
const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'))
stats.total_synapses = TOTAL_LOGICAL_SYNAPSES - PENDING_COUNT  // Connected count
stats.last_updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19)
fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2))
console.log(`Updated: ${statsPath}`)
console.log(`  total_synapses: ${stats.total_synapses.toLocaleString()}\n`)

console.log('Done!')
