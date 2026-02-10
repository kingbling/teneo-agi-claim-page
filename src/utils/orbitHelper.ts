/**
 * Shared orbit position calculation for ships orbiting synapses.
 * Used by AgentMarkers, SolvingBeam, and ShipModel3D.
 */

export interface OrbitParams {
  /** Ship ID — used to derive per-ship phase/speed offset */
  shipId: string
  /** Center position to orbit around */
  centerX: number
  centerY: number
  centerZ: number
  /** Orbit radius */
  radius: number
  /** Current time in milliseconds (Date.now()) */
  now: number
}

/**
 * Compute orbit position for a ship around a synapse.
 * Returns [x, y, z] position on the orbit path.
 */
export function computeOrbitPosition(params: OrbitParams): [number, number, number] {
  const { shipId, centerX, centerY, centerZ, radius, now } = params

  const orbitSpeed = 0.0005 + (shipId.charCodeAt(0) % 10) * 0.0001
  const orbitPhase = shipId.charCodeAt(0)
  const angle = now * orbitSpeed + orbitPhase

  const x = centerX + Math.cos(angle) * radius
  const z = centerZ + Math.sin(angle) * radius
  const y = centerY + 0.08

  return [x, y, z]
}
