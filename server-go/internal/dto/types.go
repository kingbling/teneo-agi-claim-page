package dto

// SynapseType represents the type of synapse (dynamic, managed via synapse_types table)
type SynapseType string

// AgentState represents the internal state of an agent/ship
type AgentState string

const (
	AgentIdle      AgentState = "idle"
	AgentSearching AgentState = "searching"
	AgentTraveling AgentState = "traveling"
	AgentSolving   AgentState = "solving"
	AgentReturning AgentState = "returning"
)

// ShipState represents the client-facing state (mapped from AgentState)
type ShipState string

const (
	ShipIdle      ShipState = "idle"
	ShipSearching ShipState = "searching"
	ShipTraveling ShipState = "traveling"
	ShipSolving   ShipState = "solving"   // was "exploring"
	ShipReturning ShipState = "returning"
)

// MapAgentStateToShipState converts server AgentState to client ShipState
func MapAgentStateToShipState(state AgentState) ShipState {
	switch state {
	case AgentIdle:
		return ShipIdle
	case AgentSearching:
		// Searching state is deprecated - treat as idle
		return ShipIdle
	case AgentTraveling:
		return ShipTraveling
	case AgentSolving:
		return ShipSolving
	case AgentReturning:
		return ShipReturning
	default:
		return ShipIdle
	}
}

// SpaceState represents the state of a space/synapse
type SpaceState string

const (
	SpaceUndiscovered SpaceState = "undiscovered"
	SpaceBeingSolved  SpaceState = "being_solved"
	SpaceDiscovered   SpaceState = "discovered"
)

// SynapseState represents the client-facing synapse state
type SynapseState string

const (
	SynapseUndiscovered  SynapseState = "undiscovered"
	SynapseBeingExplored SynapseState = "being_explored"
	SynapseCompleted     SynapseState = "completed"
)

// MapSpaceStateToSynapseState converts server SpaceState to client SynapseState
func MapSpaceStateToSynapseState(state SpaceState) SynapseState {
	switch state {
	case SpaceBeingSolved:
		return SynapseBeingExplored
	case SpaceDiscovered:
		return SynapseCompleted
	default:
		return SynapseUndiscovered
	}
}

// UserLevel represents the user's level (1-5)
type UserLevel int

const (
	UserLevel1 UserLevel = 1
	UserLevel2 UserLevel = 2
	UserLevel3 UserLevel = 3
	UserLevel4 UserLevel = 4
	UserLevel5 UserLevel = 5
)

// UserTier represents the user's tier
type UserTier string

const (
	TierFree     UserTier = "free"
	TierBronze   UserTier = "bronze"
	TierSilver   UserTier = "silver"
	TierGold     UserTier = "gold"
	TierPlatinum UserTier = "platinum"
	TierDiamond  UserTier = "diamond"
)

// BrainRegion represents a region of the brain
type BrainRegion string

const (
	RegionFrontal   BrainRegion = "frontal"
	RegionParietal  BrainRegion = "parietal"
	RegionTemporal  BrainRegion = "temporal"
	RegionOccipital BrainRegion = "occipital"
	RegionCerebellum BrainRegion = "cerebellum"
	RegionBrainstem  BrainRegion = "brainstem"
)
