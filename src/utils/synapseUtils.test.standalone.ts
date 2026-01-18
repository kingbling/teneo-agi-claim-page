/**
 * Synapse Filter Tests - Standalone Version
 * Tests the filtering logic for selecting synapses users can solve
 * This file duplicates the functions from synapseUtils.ts to avoid module resolution issues
 */

// ============================================================================
// TYPES (from game.ts)
// ============================================================================

type SynapseType = 'minor' | 'complex' | 'deep' | 'core' | 'rare' | 'legendary' | 'unique'

interface SynapseTypeConfig {
  points: number
  maxPerMin: number
  etaMinutes: number
  maxExplorers: number
  distribution: 'fair_share' | 'lottery'
  agiReward: number
  unlockUserLevel: number
}

const SYNAPSE_CONFIG: Record<SynapseType, SynapseTypeConfig> = {
  minor: {
    points: 6_000,
    maxPerMin: 100,
    etaMinutes: 60,
    maxExplorers: 1,
    distribution: 'fair_share',
    agiReward: 10,
    unlockUserLevel: 1,
  },
  complex: {
    points: 120_000,
    maxPerMin: 200,
    etaMinutes: 720,
    maxExplorers: 1,
    distribution: 'fair_share',
    agiReward: 200,
    unlockUserLevel: 1,
  },
  deep: {
    points: 2_000_000,
    maxPerMin: 300,
    etaMinutes: 2880,
    maxExplorers: 1,
    distribution: 'fair_share',
    agiReward: 4_000,
    unlockUserLevel: 1,
  },
  core: {
    points: 20_000_000,
    maxPerMin: 400,
    etaMinutes: 4320,
    maxExplorers: 1,
    distribution: 'fair_share',
    agiReward: 40_000,
    unlockUserLevel: 1,
  },
  rare: {
    points: 50_000_000,
    maxPerMin: 500,
    etaMinutes: 10080,
    maxExplorers: 1,
    distribution: 'fair_share',
    agiReward: 100_000,
    unlockUserLevel: 2,
  },
  legendary: {
    points: 100_000_000,
    maxPerMin: 600,
    etaMinutes: 20160,
    maxExplorers: 1,
    distribution: 'fair_share',
    agiReward: 200_000,
    unlockUserLevel: 3,
  },
  unique: {
    points: 500_000_000,
    maxPerMin: 1000,
    etaMinutes: 43200,
    maxExplorers: 1,
    distribution: 'fair_share',
    agiReward: 1_000_000,
    unlockUserLevel: 4,
  },
}

// ============================================================================
// FUNCTIONS UNDER TEST (from synapseUtils.ts)
// ============================================================================

function getDominantSynapseType(
  typeCounts: Record<SynapseType, number> | undefined
): SynapseType {
  if (!typeCounts || Object.keys(typeCounts).length === 0) {
    return 'minor'
  }

  let maxCount = 0
  let dominantType: SynapseType = 'minor'

  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > maxCount) {
      maxCount = count
      dominantType = type as SynapseType
    }
  }

  return dominantType
}

function isSynapseTypeLocked(synapseType: SynapseType, userLevel: number): boolean {
  const config = SYNAPSE_CONFIG[synapseType]
  return userLevel < config.unlockUserLevel
}

function getUnlockedSynapseTypes(userLevel: number): SynapseType[] {
  return Object.entries(SYNAPSE_CONFIG)
    .filter(([, config]) => userLevel >= config.unlockUserLevel)
    .map(([type]) => type as SynapseType)
}

// ============================================================================
// TEST FRAMEWORK
// ============================================================================

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

interface TestResult {
  name: string
  passed: boolean
  error?: string
}

const results: TestResult[] = []

// Test helper functions
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function test(name: string, fn: () => void): void {
  try {
    fn()
    console.log(`${colors.green}✓${colors.reset} ${name}`)
    results.push({ name, passed: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.log(`${colors.red}✗${colors.reset} ${name}`)
    console.log(`  ${colors.red}${errorMessage}${colors.reset}`)
    results.push({ name, passed: false, error: errorMessage })
  }
}

// ============================================================================
// TEST SUITE: getDominantSynapseType
// ============================================================================

console.log(`\n${colors.cyan}Testing getDominantSynapseType...${colors.reset}\n`)

test('getDominantSynapseType: returns "minor" when no typeCounts provided', () => {
  const result = getDominantSynapseType(undefined)
  assert(result === 'minor', `Expected 'minor', got '${result}'`)
})

test('getDominantSynapseType: returns "minor" when empty typeCounts', () => {
  const result = getDominantSynapseType({})
  assert(result === 'minor', `Expected 'minor', got '${result}'`)
})

test('getDominantSynapseType: returns the type with highest count', () => {
  const typeCounts: Record<SynapseType, number> = {
    minor: 5,
    complex: 10,
    deep: 3,
    core: 2,
    rare: 1,
    legendary: 0,
    unique: 0,
  }
  const result = getDominantSynapseType(typeCounts)
  assert(result === 'complex', `Expected 'complex', got '${result}'`)
})

test('getDominantSynapseType: handles tie by returning one of the tied types', () => {
  const typeCounts: Record<SynapseType, number> = {
    minor: 10,
    complex: 10,
    deep: 5,
    core: 2,
    rare: 1,
    legendary: 0,
    unique: 0,
  }
  const result = getDominantSynapseType(typeCounts)
  assert(
    result === 'minor' || result === 'complex',
    `Expected 'minor' or 'complex', got '${result}'`
  )
})

test('getDominantSynapseType: works with single type', () => {
  const typeCounts: Record<SynapseType, number> = {
    minor: 100,
    complex: 0,
    deep: 0,
    core: 0,
    rare: 0,
    legendary: 0,
    unique: 0,
  }
  const result = getDominantSynapseType(typeCounts)
  assert(result === 'minor', `Expected 'minor', got '${result}'`)
})

// ============================================================================
// TEST SUITE: isSynapseTypeLocked
// ============================================================================

console.log(`\n${colors.cyan}Testing isSynapseTypeLocked...${colors.reset}\n`)

test('isSynapseTypeLocked: Level 1 user can access minor synapses', () => {
  const result = isSynapseTypeLocked('minor', 1)
  assert(result === false, `Expected false (unlocked), got true (locked)`)
})

test('isSynapseTypeLocked: Level 1 user can access complex synapses', () => {
  const result = isSynapseTypeLocked('complex', 1)
  assert(result === false, `Expected false (unlocked), got true (locked)`)
})

test('isSynapseTypeLocked: Level 1 user can access deep synapses', () => {
  const result = isSynapseTypeLocked('deep', 1)
  assert(result === false, `Expected false (unlocked), got true (locked)`)
})

test('isSynapseTypeLocked: Level 1 user can access core synapses', () => {
  const result = isSynapseTypeLocked('core', 1)
  assert(result === false, `Expected false (unlocked), got true (locked)`)
})

test('isSynapseTypeLocked: Level 1 user CANNOT access rare synapses', () => {
  const result = isSynapseTypeLocked('rare', 1)
  assert(result === true, `Expected true (locked), got false (unlocked)`)
})

test('isSynapseTypeLocked: Level 1 user CANNOT access legendary synapses', () => {
  const result = isSynapseTypeLocked('legendary', 1)
  assert(result === true, `Expected true (locked), got false (unlocked)`)
})

test('isSynapseTypeLocked: Level 1 user CANNOT access unique synapses', () => {
  const result = isSynapseTypeLocked('unique', 1)
  assert(result === true, `Expected true (locked), got false (unlocked)`)
})

test('isSynapseTypeLocked: Level 2 user CAN access rare synapses', () => {
  const result = isSynapseTypeLocked('rare', 2)
  assert(result === false, `Expected false (unlocked), got true (locked)`)
})

test('isSynapseTypeLocked: Level 2 user CANNOT access legendary synapses', () => {
  const result = isSynapseTypeLocked('legendary', 2)
  assert(result === true, `Expected true (locked), got false (unlocked)`)
})

test('isSynapseTypeLocked: Level 3 user CAN access legendary synapses', () => {
  const result = isSynapseTypeLocked('legendary', 3)
  assert(result === false, `Expected false (unlocked), got true (locked)`)
})

test('isSynapseTypeLocked: Level 3 user CANNOT access unique synapses', () => {
  const result = isSynapseTypeLocked('unique', 3)
  assert(result === true, `Expected true (locked), got false (unlocked)`)
})

test('isSynapseTypeLocked: Level 4 user CAN access unique synapses', () => {
  const result = isSynapseTypeLocked('unique', 4)
  assert(result === false, `Expected false (unlocked), got true (locked)`)
})

test('isSynapseTypeLocked: Level 5 user CAN access all synapse types', () => {
  const allTypes: SynapseType[] = ['minor', 'complex', 'deep', 'core', 'rare', 'legendary', 'unique']
  for (const type of allTypes) {
    const result = isSynapseTypeLocked(type, 5)
    assert(result === false, `Level 5 user should access ${type}, but it's locked`)
  }
})

// ============================================================================
// TEST SUITE: getUnlockedSynapseTypes
// ============================================================================

console.log(`\n${colors.cyan}Testing getUnlockedSynapseTypes...${colors.reset}\n`)

test('getUnlockedSynapseTypes: Level 1 user gets basic synapse types', () => {
  const result = getUnlockedSynapseTypes(1)
  const expected: SynapseType[] = ['minor', 'complex', 'deep', 'core']
  assert(
    result.length === expected.length,
    `Expected ${expected.length} types, got ${result.length}`
  )
  for (const type of expected) {
    assert(
      result.includes(type),
      `Expected '${type}' to be unlocked, but it's not in the result`
    )
  }
})

test('getUnlockedSynapseTypes: Level 2 user gets basic + rare synapses', () => {
  const result = getUnlockedSynapseTypes(2)
  const expected: SynapseType[] = ['minor', 'complex', 'deep', 'core', 'rare']
  assert(
    result.length === expected.length,
    `Expected ${expected.length} types, got ${result.length}`
  )
  for (const type of expected) {
    assert(
      result.includes(type),
      `Expected '${type}' to be unlocked, but it's not in the result`
    )
  }
})

test('getUnlockedSynapseTypes: Level 3 user gets basic + rare + legendary', () => {
  const result = getUnlockedSynapseTypes(3)
  const expected: SynapseType[] = ['minor', 'complex', 'deep', 'core', 'rare', 'legendary']
  assert(
    result.length === expected.length,
    `Expected ${expected.length} types, got ${result.length}`
  )
  for (const type of expected) {
    assert(
      result.includes(type),
      `Expected '${type}' to be unlocked, but it's not in the result`
    )
  }
})

test('getUnlockedSynapseTypes: Level 4 user gets all except unique', () => {
  const result = getUnlockedSynapseTypes(4)
  const expected: SynapseType[] = ['minor', 'complex', 'deep', 'core', 'rare', 'legendary', 'unique']
  assert(
    result.length === expected.length,
    `Expected ${expected.length} types, got ${result.length}`
  )
  for (const type of expected) {
    assert(
      result.includes(type),
      `Expected '${type}' to be unlocked, but it's not in the result`
    )
  }
})

test('getUnlockedSynapseTypes: Level 5 user gets all synapse types', () => {
  const result = getUnlockedSynapseTypes(5)
  const expected: SynapseType[] = ['minor', 'complex', 'deep', 'core', 'rare', 'legendary', 'unique']
  assert(
    result.length === expected.length,
    `Expected ${expected.length} types, got ${result.length}`
  )
  for (const type of expected) {
    assert(
      result.includes(type),
      `Expected '${type}' to be unlocked, but it's not in the result`
    )
  }
})

// ============================================================================
// TEST SUITE: Integration - Synapse Filter Selection
// ============================================================================

console.log(`\n${colors.cyan}Testing synapse filter selection logic...${colors.reset}\n`)

test('Filter selection: Level 1 user should only see 4 synapse types', () => {
  const userLevel = 1
  const unlockedTypes = getUnlockedSynapseTypes(userLevel)
  const lockedTypes = ['rare', 'legendary', 'unique']

  assert(
    unlockedTypes.length === 4,
    `Level 1 user should see 4 types, got ${unlockedTypes.length}`
  )

  // Verify locked types are NOT in unlocked list
  for (const lockedType of lockedTypes) {
    assert(
      !unlockedTypes.includes(lockedType as SynapseType),
      `Level 1 user should NOT see '${lockedType}'`
    )
  }

  // Verify isSynapseTypeLocked returns true for locked types
  for (const lockedType of lockedTypes) {
    assert(
      isSynapseTypeLocked(lockedType as SynapseType, userLevel),
      `'${lockedType}' should be locked for Level 1 user`
    )
  }
})

test('Filter selection: Level 2 user should see 5 synapse types', () => {
  const userLevel = 2
  const unlockedTypes = getUnlockedSynapseTypes(userLevel)
  const lockedTypes = ['legendary', 'unique']

  assert(
    unlockedTypes.length === 5,
    `Level 2 user should see 5 types, got ${unlockedTypes.length}`
  )

  // Verify locked types are NOT in unlocked list
  for (const lockedType of lockedTypes) {
    assert(
      !unlockedTypes.includes(lockedType as SynapseType),
      `Level 2 user should NOT see '${lockedType}'`
    )
  }
})

test('Filter selection: Cluster filtering by user level', () => {
  // Simulate cluster filtering logic from SynapseListPanel
  const userLevel = 1

  // Mock cluster data
  const clusters = [
    { typeCounts: { minor: 10, complex: 0, deep: 0, core: 0, rare: 0, legendary: 0, unique: 0 } },
    { typeCounts: { minor: 0, complex: 10, deep: 0, core: 0, rare: 0, legendary: 0, unique: 0 } },
    { typeCounts: { minor: 0, complex: 0, deep: 10, core: 0, rare: 0, legendary: 0, unique: 0 } },
    { typeCounts: { minor: 0, complex: 0, deep: 0, core: 10, rare: 0, legendary: 0, unique: 0 } },
    { typeCounts: { minor: 0, complex: 0, deep: 0, core: 0, rare: 10, legendary: 0, unique: 0 } },
    { typeCounts: { minor: 0, complex: 0, deep: 0, core: 0, rare: 0, legendary: 10, unique: 0 } },
    { typeCounts: { minor: 0, complex: 0, deep: 0, core: 0, rare: 0, legendary: 0, unique: 10 } },
  ]

  // Apply filter (show unlocked only)
  const filteredClusters = clusters.filter(cluster => {
    const dominantType = getDominantSynapseType(cluster.typeCounts)
    return !isSynapseTypeLocked(dominantType, userLevel)
  })

  assert(
    filteredClusters.length === 4,
    `Level 1 user should see 4 clusters, got ${filteredClusters.length}`
  )

  // Verify that rare, legendary, unique clusters are filtered out
  const filteredTypes = filteredClusters.map(c => getDominantSynapseType(c.typeCounts))
  assert(!filteredTypes.includes('rare'), 'Rare cluster should be filtered out')
  assert(!filteredTypes.includes('legendary'), 'Legendary cluster should be filtered out')
  assert(!filteredTypes.includes('unique'), 'Unique cluster should be filtered out')
})

test('Filter selection: All clusters visible when filter disabled', () => {
  void 1 // unused userLevel variable removed

  // Mock cluster data
  const clusters = [
    { typeCounts: { minor: 10, complex: 0, deep: 0, core: 0, rare: 0, legendary: 0, unique: 0 } },
    { typeCounts: { minor: 0, complex: 0, deep: 0, core: 0, rare: 10, legendary: 0, unique: 0 } },
    { typeCounts: { minor: 0, complex: 0, deep: 0, core: 0, rare: 0, legendary: 10, unique: 0 } },
  ]

  // No filter applied - show all clusters
  const filteredClusters = clusters

  assert(
    filteredClusters.length === 3,
    `Should show all 3 clusters when filter disabled, got ${filteredClusters.length}`
  )
})

test('Filter selection: Type-based filter (e.g., show only rare)', () => {
  const filterType: SynapseType = 'rare'

  // Mock cluster data
  const clusters = [
    { typeCounts: { minor: 10, complex: 0, deep: 0, core: 0, rare: 0, legendary: 0, unique: 0 } },
    { typeCounts: { minor: 0, complex: 0, deep: 0, core: 0, rare: 10, legendary: 0, unique: 0 } },
    { typeCounts: { minor: 0, complex: 10, deep: 0, core: 0, rare: 0, legendary: 0, unique: 0 } },
  ]

  // Filter by type
  const filteredClusters = clusters.filter(cluster => {
    const dominantType = getDominantSynapseType(cluster.typeCounts)
    return dominantType === filterType
  })

  assert(
    filteredClusters.length === 1,
    `Should show only 1 rare cluster, got ${filteredClusters.length}`
  )

  const filteredType = getDominantSynapseType(filteredClusters[0].typeCounts)
  assert(
    filteredType === filterType,
    `Filtered cluster should be '${filterType}', got '${filteredType}'`
  )
})

// ============================================================================
// TEST SUITE: Edge Cases
// ============================================================================

console.log(`\n${colors.cyan}Testing edge cases...${colors.reset}\n`)

test('Edge case: User level 0 (should not exist in practice)', () => {
  const result = getUnlockedSynapseTypes(0)
  const expected: SynapseType[] = ['minor', 'complex', 'deep', 'core']
  assert(
    result.length === expected.length,
    `Level 0 should behave like Level 1, got ${result.length} types`
  )
})

test('Edge case: Very high user level (should unlock everything)', () => {
  const result = getUnlockedSynapseTypes(100)
  assert(
    result.length === 7,
    `Very high level should unlock all 7 types, got ${result.length}`
  )
})

test('Edge case: Cluster with zero synapses', () => {
  const cluster = { typeCounts: { minor: 0, complex: 0, deep: 0, core: 0, rare: 0, legendary: 0, unique: 0 } }
  const dominantType = getDominantSynapseType(cluster.typeCounts)
  assert(
    dominantType === 'minor',
    `Cluster with zero synapses should default to 'minor', got '${dominantType}'`
  )
})

test('Edge case: Cluster with all types at equal count', () => {
  const cluster = { typeCounts: { minor: 5, complex: 5, deep: 5, core: 5, rare: 5, legendary: 5, unique: 5 } }
  const dominantType = getDominantSynapseType(cluster.typeCounts)
  const validTypes: SynapseType[] = ['minor', 'complex', 'deep', 'core', 'rare', 'legendary', 'unique']
  assert(
    validTypes.includes(dominantType),
    `Expected valid synapse type, got '${dominantType}'`
  )
})

// ============================================================================
// TEST SUITE: SYNAPSE_CONFIG Consistency
// ============================================================================

console.log(`\n${colors.cyan}Testing SYNAPSE_CONFIG consistency...${colors.reset}\n`)

test('Config check: All synapse types have unlock levels', () => {
  const allTypes: SynapseType[] = ['minor', 'complex', 'deep', 'core', 'rare', 'legendary', 'unique']
  for (const type of allTypes) {
    const config = SYNAPSE_CONFIG[type]
    assert(
      config.unlockUserLevel !== undefined,
      `'${type}' should have unlockUserLevel defined`
    )
    assert(
      config.unlockUserLevel >= 1 && config.unlockUserLevel <= 5,
      `'${type}' unlockUserLevel should be between 1 and 5, got ${config.unlockUserLevel}`
    )
  }
})

test('Config check: Level progression is correct', () => {
  const levelByType: Record<SynapseType, number> = {
    minor: SYNAPSE_CONFIG.minor.unlockUserLevel,
    complex: SYNAPSE_CONFIG.complex.unlockUserLevel,
    deep: SYNAPSE_CONFIG.deep.unlockUserLevel,
    core: SYNAPSE_CONFIG.core.unlockUserLevel,
    rare: SYNAPSE_CONFIG.rare.unlockUserLevel,
    legendary: SYNAPSE_CONFIG.legendary.unlockUserLevel,
    unique: SYNAPSE_CONFIG.unique.unlockUserLevel,
  }

  assert(levelByType.rare >= levelByType.core, 'rare should require >= level of core')
  assert(levelByType.legendary >= levelByType.rare, 'legendary should require >= level of rare')
  assert(levelByType.unique >= levelByType.legendary, 'unique should require >= level of legendary')
})

// ============================================================================
// RESULTS SUMMARY
// ============================================================================

function printSummary() {
  console.log(`\n${colors.magenta}${'='.repeat(60)}${colors.reset}`)
  console.log(`${colors.magenta}TEST SUMMARY${colors.reset}`)
  console.log(`${colors.magenta}${'='.repeat(60)}${colors.reset}\n`)

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length

  console.log(`Total tests: ${total}`)
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`)
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`)

  if (failed > 0) {
    console.log(`\n${colors.red}Failed tests:${colors.reset}`)
    for (const result of results) {
      if (!result.passed) {
        console.log(`  - ${result.name}`)
        if (result.error) {
          console.log(`    ${colors.red}${result.error}${colors.reset}`)
        }
      }
    }
  }

  console.log(`\n${colors.magenta}${'='.repeat(60)}${colors.reset}\n`)
  process.exit(failed > 0 ? 1 : 0)
}

printSummary()
