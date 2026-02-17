package dto

// Space represents a discoverable synapse in the brain
type Space struct {
	ID                string     `json:"id"`
	PositionX         float64    `json:"positionX"`
	PositionY         float64    `json:"positionY"`
	PositionZ         float64    `json:"positionZ"`
	Region            BrainRegion `json:"region"`
	Zone              string     `json:"zone"`
	SynapseCount      int        `json:"synapseCount"`
	State             SpaceState `json:"state"`
	DiscoveredAt      *int64     `json:"discoveredAt,omitempty"`
	// Masterplan 2026 fields
	SynapseType       SynapseType `json:"synapseType"`
	PointsRequired    int         `json:"pointsRequired"`
	PointsAccumulated int         `json:"pointsAccumulated"`
	CurrentETAMinutes *float64    `json:"currentEtaMinutes,omitempty"`
	AGIReward         float64     `json:"agiReward"`
	SectorID          *string     `json:"sectorId,omitempty"`
}

// SpaceCluster represents a cluster of spaces for LOD visualization
type SpaceCluster struct {
	ID                 string           `json:"id"`
	LODLevel           int              `json:"lodLevel"`
	PositionX          float64          `json:"positionX"`
	PositionY          float64          `json:"positionY"`
	PositionZ          float64          `json:"positionZ"`
	SpaceCount         int              `json:"spaceCount"`      // Server naming
	SynapseCount       int              `json:"synapseCount"`     // Client naming (mapped)
	DiscoveredCount    int              `json:"discoveredCount"`
	BeingSolvedCount   int              `json:"beingSolvedCount"`  // Server naming
	BeingExploredCount int              `json:"beingExploredCount"` // Client naming (mapped)
	AvgLootPool        float64          `json:"avgLootPool"`
	TypeCounts         map[string]int   `json:"typeCounts"`
	UpdatedAt          int64            `json:"updatedAt"`
}

// Synapse represents a synapse for the client
type Synapse struct {
	ID                  string        `json:"id"`
	PositionX           float64       `json:"positionX"`
	PositionY           float64       `json:"positionY"`
	PositionZ           float64       `json:"positionZ"`
	Region              string        `json:"region"`
	Zone                string        `json:"zone"`
	SynapseType         SynapseType   `json:"synapseType"`
	State               SynapseState  `json:"state"`
	SynapseCount        int           `json:"synapseCount"`
	PointsRequired      int           `json:"pointsRequired"`
	PointsAccumulated   int           `json:"pointsAccumulated"`
	CurrentETAMinutes   float64       `json:"currentEtaMinutes"`
	ExplorerCount       int           `json:"explorerCount"`
	MaxExplorers        int           `json:"maxExplorers"`
	SectorID            *string       `json:"sectorId,omitempty"`
	Explorers           []ExplorerInfo `json:"explorers,omitempty"`
}

// SpaceToSynapse converts a Space to Synapse for client consumption
func SpaceToSynapse(space Space) Synapse {
	return Synapse{
		ID:                space.ID,
		PositionX:         space.PositionX,
		PositionY:         space.PositionY,
		PositionZ:         space.PositionZ,
		Region:            string(space.Region),
		Zone:              space.Zone,
		SynapseType:       space.SynapseType,
		State:             MapSpaceStateToSynapseState(space.State),
		SynapseCount:      space.SynapseCount,
		PointsRequired:    space.PointsRequired,
		PointsAccumulated: space.PointsAccumulated,
		CurrentETAMinutes: safeFloat64(space.CurrentETAMinutes),
		ExplorerCount:     0, // Loaded from DB separately
		MaxExplorers:      1, // V1 Masterplan: Single player
		SectorID:          space.SectorID,
	}
}

// SpaceDiscovery represents a discovery event
type SpaceDiscovery struct {
	SpaceID            string   `json:"spaceId"`
	PositionX          float64  `json:"positionX"`
	PositionY          float64  `json:"positionY"`
	PositionZ          float64  `json:"positionZ"`
	DiscoveredBy       []string `json:"discoveredBy"`
	LootDistribution   []LootDistributionItem `json:"lootDistribution"`
	Timestamp          int64    `json:"timestamp"`
}

// LootDistributionItem represents a loot distribution to an agent
type LootDistributionItem struct {
	AgentID  string  `json:"agentId"`
	OwnerID  string  `json:"ownerId"`
	Amount   float64 `json:"amount"`
}

// LootEvent represents a loot distribution event
type LootEvent struct {
	UserID    string  `json:"userId"`
	AgentID   string  `json:"agentId"`
	SpaceID   string  `json:"spaceId"`
	Amount    float64 `json:"amount"`
	Timestamp int64   `json:"timestamp"`
}

// ExplorerInfo represents information about a synapse explorer
type ExplorerInfo struct {
	ShipID            string  `json:"shipId"`
	UserID            string  `json:"userId"`
	ShipName          string  `json:"shipName"`
	PointsContributed float64 `json:"pointsContributed"`
	PointsPerMinute   float64 `json:"pointsPerMinute"`
	JoinedAt          int64   `json:"joinedAt"`
}

func safeFloat64(ptr *float64) float64 {
	if ptr == nil {
		return 0
	}
	return *ptr
}
