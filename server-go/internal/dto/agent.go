package dto

import "math"

// Agent represents a ship in the internal server model
type Agent struct {
	ID             string     `json:"id"`
	OwnerID        string     `json:"ownerId"`
	Name           string     `json:"name"`
	State          AgentState `json:"state"`
	PositionX      float64    `json:"positionX"`
	PositionY      float64    `json:"positionY"`
	PositionZ      float64    `json:"positionZ"`
	HomeX          float64    `json:"homeX"`
	HomeY          float64    `json:"homeY"`
	HomeZ          float64    `json:"homeZ"`
	TargetX        *float64   `json:"targetX,omitempty"`
	TargetY        *float64   `json:"targetY,omitempty"`
	TargetZ        *float64   `json:"targetZ,omitempty"`
	StartPositionX *float64   `json:"startPositionX,omitempty"`
	StartPositionY *float64   `json:"startPositionY,omitempty"`
	StartPositionZ *float64   `json:"startPositionZ,omitempty"`
	WanderDirX     float64    `json:"wanderDirX"`
	WanderDirY     float64    `json:"wanderDirY"`
	WanderDirZ     float64    `json:"wanderDirZ"`
	WanderPhase    float64    `json:"wanderPhase"`
	TargetSpaceID  *string    `json:"targetSpaceId,omitempty"`
	CurrentSpaceID *string    `json:"currentSpaceId,omitempty"`
	TravelStartTime *int64    `json:"travelStartTime,omitempty"`
	TravelDuration *int64     `json:"travelDuration,omitempty"`
	SpacesDiscovered int       `json:"spacesDiscovered"`
	DistanceTraveled float64   `json:"distanceTraveled"`
	CreatedAt      int64      `json:"createdAt"`
	DeployedAt      *int64     `json:"deployedAt,omitempty"`
	// Masterplan 2026 fields
	CurrentPointsPerMin float64 `json:"currentPointsPerMin"`
	TotalAgiEarned      float64 `json:"totalAgiEarned"`
	AutopilotEnabled    bool    `json:"autopilotEnabled"`
	ShipType            string  `json:"shipType"`
}

// ShipDTO represents a ship for the client (mapped from Agent)
type ShipDTO struct {
	ID                 string       `json:"id"`
	OwnerID            string       `json:"ownerId"`
	Name               string       `json:"name"`
	State              ShipState    `json:"state"`
	ShipType           string       `json:"shipType"`
	PositionX          float64      `json:"positionX"`
	PositionY          float64      `json:"positionY"`
	PositionZ          float64      `json:"positionZ"`
	StartPositionX     *float64     `json:"startPositionX,omitempty"`
	StartPositionY     *float64     `json:"startPositionY,omitempty"`
	StartPositionZ     *float64     `json:"startPositionZ,omitempty"`
	TargetPositionX    *float64     `json:"targetPositionX,omitempty"`
	TargetPositionY    *float64     `json:"targetPositionY,omitempty"`
	TargetPositionZ    *float64     `json:"targetPositionZ,omitempty"`
	CurrentSynapseID   *string      `json:"currentSynapseId,omitempty"`
	TravelStartTime    *int64       `json:"travelStartTime,omitempty"`
	TravelDuration     *int64       `json:"travelDuration,omitempty"`
	RotationY          float64      `json:"rotationY,omitempty"` // Yaw rotation in radians - direction ship is facing
	AutopilotEnabled   bool         `json:"autopilotEnabled"`
	AutopilotPreferences *AutopilotPreferences `json:"autopilotPreferences,omitempty"`
	EquippedItems      []EquippedItem `json:"equippedItems"`
	CurrentPointsPerMin float64      `json:"currentPointsPerMin"`
	SpacesDiscovered   int          `json:"spacesDiscovered"`
	TotalAgiEarned     float64      `json:"totalAgiEarned"`
	CreatedAt          int64        `json:"createdAt"`
}

// AgentToShipDTO converts an Agent to ShipDTO for client consumption
func AgentToShipDTO(agent Agent) ShipDTO {
	var targetPosX, targetPosY, targetPosZ *float64
	if agent.TargetX != nil {
		targetPosX = agent.TargetX
		targetPosY = agent.TargetY
		targetPosZ = agent.TargetZ
	}

	// Default to "neuron" if ShipType is empty (backwards compatibility)
	shipType := agent.ShipType
	if shipType == "" {
		shipType = "neuron"
	}

	// Calculate rotationY (yaw) toward target if available
	// Ship model faces -Z direction, so we use atan2(dx, -dz)
	var rotationY float64 = 0
	if agent.TargetX != nil && agent.TargetZ != nil {
		dx := *agent.TargetX - agent.PositionX
		dz := *agent.TargetZ - agent.PositionZ
		rotationY = calculateAtan2(dx, -dz)
	}

	return ShipDTO{
		ID:               agent.ID,
		OwnerID:          agent.OwnerID,
		Name:             agent.Name,
		State:            MapAgentStateToShipState(agent.State),
		ShipType:         shipType,
		PositionX:        agent.PositionX,
		PositionY:        agent.PositionY,
		PositionZ:        agent.PositionZ,
		StartPositionX:   agent.StartPositionX,
		StartPositionY:   agent.StartPositionY,
		StartPositionZ:   agent.StartPositionZ,
		TargetPositionX:  targetPosX,
		TargetPositionY:  targetPosY,
		TargetPositionZ:  targetPosZ,
		CurrentSynapseID: agent.CurrentSpaceID,
		TravelStartTime:  agent.TravelStartTime,
		TravelDuration:   agent.TravelDuration,
		RotationY:        rotationY, // Include calculated rotation
		AutopilotEnabled: agent.AutopilotEnabled,
		EquippedItems:    []EquippedItem{}, // Loaded from DB separately
		CurrentPointsPerMin: agent.CurrentPointsPerMin,
		SpacesDiscovered: agent.SpacesDiscovered,
		TotalAgiEarned:   agent.TotalAgiEarned,
		CreatedAt:        agent.CreatedAt,
	}
}

// calculateAtan2 computes atan2(x, y) - compatibility function for Go versions
func calculateAtan2(x, y float64) float64 {
	return math.Atan2(x, y)
}

// AgentCluster represents a cluster of agents for LOD visualization
type AgentCluster struct {
	ID           string     `json:"id"`
	LODLevel     int        `json:"lodLevel"`
	PositionX    float64    `json:"positionX"`
	PositionY    float64    `json:"positionY"`
	PositionZ    float64    `json:"positionZ"`
	AgentCount   int        `json:"agentCount"`
	DominantState AgentState `json:"dominantState"`
	AvgProgress  float64    `json:"avgProgress"`
	UpdatedAt    int64      `json:"updatedAt"`
}

// ShipCluster represents a cluster of ships for the client
type ShipCluster struct {
	ID           string     `json:"id"`
	LODLevel     int        `json:"lodLevel"`
	PositionX    float64    `json:"positionX"`
	PositionY    float64    `json:"positionY"`
	PositionZ    float64    `json:"positionZ"`
	ShipCount    int        `json:"shipCount"`
	DominantState ShipState `json:"dominantState"`
	AvgProgress  float64    `json:"avgProgress"`
	UpdatedAt    int64      `json:"updatedAt"`
}

// AgentUpdate represents a partial agent update for WebSocket broadcast
type AgentUpdate struct {
	ID              string     `json:"id"`
	PositionX       float64    `json:"positionX"`
	PositionY       float64    `json:"positionY"`
	PositionZ       float64    `json:"positionZ"`
	State           AgentState `json:"state"`
	TargetSpaceID   *string    `json:"targetSpaceId,omitempty"`
	TravelStartTime *int64     `json:"travelStartTime,omitempty"`
	TravelDuration  *int64     `json:"travelDuration,omitempty"`
}

// EquippedItem represents an item equipped to a ship
type EquippedItem struct {
	ItemID    string  `json:"itemId"`
	ItemType  string  `json:"itemType"`
	SlotIndex int     `json:"slotIndex"`
	EquippedAt int64  `json:"equippedAt"`
	ExpiresAt *int64 `json:"expiresAt,omitempty"`
}

// AutopilotPreferences represents ship autopilot settings
type AutopilotPreferences struct {
	PreferredSynapseTypes []SynapseType `json:"preferredSynapseTypes"`
	MaxPointsPerMin        float64       `json:"maxPointsPerMin"`
	AvoidCrowded           bool          `json:"avoidCrowded"`
}
