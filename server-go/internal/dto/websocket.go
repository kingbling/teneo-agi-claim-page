package dto

import (
	"encoding/json"
)

// ClientMessage represents a message from client to server
type ClientMessage struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

// ClientMessage types
const (
	ClientMessageTypePing        = "ping"
	ClientMessageTypeAuthIdentify = "auth:identify"
	ClientMessageTypeAuthLogout   = "auth:logout"
)

// AuthIdentifyData contains auth identification data
type AuthIdentifyData struct {
	Token string `json:"token"`
}

// ServerMessage represents a message from server to client
type ServerMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

// ServerMessage types
const (
	ServerMessageTypeStateSync           = "state:sync"
	ServerMessageTypeShipsSync           = "ships:sync"
	ServerMessageTypeAgentsUpdate        = "agents:update"
	ServerMessageTypeSpaceDiscovered     = "space:discovered"
	ServerMessageTypeLootDistributed     = "loot:distributed"
	ServerMessageTypeSynapseCompleted    = "synapse:completed"
	ServerMessageTypeExplorationProgress = "exploration:progress"
	ServerMessageTypeUserLevelUp         = "user:levelup"
	ServerMessageTypeSynapsesDelta       = "synapses:delta"
	ServerMessageTypeTravelStarted       = "travel:started"
	ServerMessageTypeTravelPosition      = "travel:position"
	ServerMessageTypeClusterUpdate       = "cluster:update"
	ServerMessageTypeWorldShips          = "world:ships"
	ServerMessageTypeAuthSuccess         = "auth:success"
	ServerMessageTypeAuthError           = "auth:error"
	ServerMessageTypeError               = "error"
	ServerMessageTypeTeneoPoints         = "teneo:points"
	ServerMessageTypeTeneoBurn           = "teneo:burn"
)

// WorldState represents the full world state
type WorldState struct {
	SynapseClusters   []SpaceCluster    `json:"synapseClusters"`
	AgentClusters     []AgentCluster    `json:"agentClusters"`     // Server naming
	ShipClusters      []ShipCluster     `json:"shipClusters"`      // Client expects this too
	UserShips         []ShipDTO         `json:"userShips"`
	DiscoveryProgress DiscoveryProgress `json:"discoveryProgress"`
	Timestamp         int64             `json:"timestamp,omitempty"`
}

// DiscoveryProgress represents discovery statistics
type DiscoveryProgress struct {
	Total        int `json:"total"`
	Discovered   int `json:"discovered"`
	BeingSolved  int `json:"beingSolved"`   // Server naming
	BeingExplored int `json:"beingExplored"` // Client naming
}

// ShipSyncData represents a ship sync message
type ShipSyncData struct {
	Ships     []ShipDTO `json:"ships"`
	Timestamp int64     `json:"timestamp"`
}

// ShipUpdateData represents partial ship updates
type ShipUpdateData struct {
	Ships     []ShipDTO `json:"ships"`
	Timestamp int64     `json:"timestamp"`
}

// SynapseCompletionData represents a synapse completion event
type SynapseCompletionData struct {
	SynapseID       string     `json:"synapseId"`
	SynapseType     SynapseType `json:"synapseType"`
	DiscoveredAt    int64      `json:"discoveredAt"`
	TotalExplorers  int        `json:"totalExplorers"`
	AGIReward       float64    `json:"agiReward"`
	IsLottery       bool       `json:"isLottery"`
	WinnerID        *string    `json:"winnerId,omitempty"`
	WinnerShipID    *string    `json:"winnerShipId,omitempty"`
}

// ExplorationProgressData represents exploration progress updates
type ExplorationProgressData struct {
	SynapseID          string     `json:"synapseId"`
	SynapseType        SynapseType `json:"synapseType"`
	PointsAccumulated  float64    `json:"pointsAccumulated"`
	PointsRequired     int        `json:"pointsRequired"`
	ETAMinutes         float64    `json:"etaMinutes"`
	ExplorerCount      int        `json:"explorerCount"`
	Timestamp          int64      `json:"timestamp"`
}

// UserLevelUpData represents a user level up event
type UserLevelUpData struct {
	UserID   string   `json:"userId"`
	NewLevel UserLevel `json:"newLevel"`
	Timestamp int64   `json:"timestamp"`
}

// AuthSuccessData represents auth success
type AuthSuccessData struct {
	UserID string `json:"userId"`
}

// AuthErrorData represents auth error
type AuthErrorData struct {
	Message string `json:"message"`
}

// ErrorData represents a generic error
type ErrorData struct {
	Message string `json:"message"`
}

// Engine Event Types (used by simulation engine)
// Note: SpaceDiscovery and LootEvent are defined in space.go

// SynapseCompletionEvent for engine callbacks
type SynapseCompletionEvent struct {
	SynapseID      string      `json:"synapseId"`
	SynapseType    SynapseType `json:"synapseType"`
	DiscoveredAt   int64       `json:"discoveredAt"`
	TotalExplorers int         `json:"totalExplorers"`
	AGIReward      float64     `json:"agiReward"`
	IsLottery      bool        `json:"isLottery"`
	WinnerID       *string     `json:"winnerId,omitempty"`
	WinnerShipID   *string     `json:"winnerShipId,omitempty"`
	// Position for visual effects (discovery burst)
	PositionX float64 `json:"positionX"`
	PositionY float64 `json:"positionY"`
	PositionZ float64 `json:"positionZ"`
}

// ExplorationProgressEvent for engine callbacks
type ExplorationProgressEvent struct {
	SynapseID         string      `json:"synapseId"`
	SynapseType       SynapseType `json:"synapseType"`
	PointsAccumulated float64     `json:"pointsAccumulated"`
	PointsRequired    float64     `json:"pointsRequired"`
	ETAMinutes        float64     `json:"etaMinutes"`
	ExplorerCount     int         `json:"explorerCount"`
	Timestamp         int64       `json:"timestamp"`
	UserID            string      `json:"userId,omitempty"`
	UserPoints        float64     `json:"userPoints,omitempty"`
}

// UserLevelUpEvent for engine callbacks
type UserLevelUpEvent struct {
	UserID    string    `json:"userId"`
	NewLevel  UserLevel `json:"newLevel"`
	Timestamp int64     `json:"timestamp"`
}

// SynapseDelta represents a single synapse state change
// Uses compact field names for bandwidth efficiency
type SynapseDelta struct {
	Index    uint32 `json:"i"` // Array index (not UUID) matching bulk endpoint order
	NewState uint8  `json:"s"` // 0=undiscovered, 1=being_solved, 2=discovered
}

// SynapsesDeltaBatch represents a batch of synapse state changes
type SynapsesDeltaBatch struct {
	Changes   []SynapseDelta `json:"c"`
	Timestamp int64          `json:"t"`
}

// TravelStartedEvent is sent when a ship begins traveling to a synapse
type TravelStartedEvent struct {
	ShipID          string  `json:"shipId"`
	StartPositionX  float64 `json:"startPositionX"`
	StartPositionY  float64 `json:"startPositionY"`
	StartPositionZ  float64 `json:"startPositionZ"`
	TargetPositionX float64 `json:"targetPositionX"`
	TargetPositionY float64 `json:"targetPositionY"`
	TargetPositionZ float64 `json:"targetPositionZ"`
	TravelStartTime int64   `json:"travelStartTime"`
	TravelDuration  int64   `json:"travelDuration"`
	TravelCost      float64 `json:"travelCost"`
	TargetSynapseID string  `json:"targetSynapseId"`
}

// TravelPositionUpdate represents a position/rotation update during travel
type TravelPositionUpdate struct {
	ShipID    string  `json:"shipId"`
	PositionX float64 `json:"positionX"`
	PositionY float64 `json:"positionY"`
	PositionZ float64 `json:"positionZ"`
	RotationY float64 `json:"rotationY"` // Yaw - direction ship is facing
	Progress  float64 `json:"progress"`  // 0.0 to 1.0
}

// TravelPositionBatch batches multiple ship updates for efficient transmission
type TravelPositionBatch struct {
	Ships     []TravelPositionUpdate `json:"ships"`
	Timestamp int64                  `json:"timestamp"`
}

// ClusterUpdateEvent is sent when a cluster's state counts change (exploration start/stop)
// This enables immediate dashboard updates without waiting for periodic state:sync
type ClusterUpdateEvent struct {
	Clusters  []SpaceCluster `json:"clusters"`
	Timestamp int64          `json:"timestamp"`
}

// WorldShipUpdate represents a single world ship position (ambient or other-user)
// Uses compact field names for bandwidth efficiency
type WorldShipUpdate struct {
	ID        string  `json:"id"`
	ShipType  string  `json:"tp,omitempty"`
	PositionX float64 `json:"x"`
	PositionY float64 `json:"y"`
	PositionZ float64 `json:"z"`
	RotationY float64 `json:"r"`
	State     int     `json:"s"` // 0=traveling, 1=idle
	// Trajectory data for client-side interpolation (only when traveling)
	StartX         float64 `json:"sx,omitempty"`
	StartY         float64 `json:"sy,omitempty"`
	StartZ         float64 `json:"sz,omitempty"`
	TargetX        float64 `json:"tx,omitempty"`
	TargetY        float64 `json:"ty,omitempty"`
	TargetZ        float64 `json:"tz,omitempty"`
	TravelStart    int64   `json:"ts,omitempty"`
	TravelDuration int64   `json:"td,omitempty"`
}

// WorldShipsBatch batches multiple world ship updates
type WorldShipsBatch struct {
	Ships     []WorldShipUpdate `json:"ships"`
	Timestamp int64             `json:"t"`
}

// TeneoPointsEvent is sent when Teneo points are synced (on auth or refresh)
type TeneoPointsEvent struct {
	PointsTotal float64 `json:"pointsTotal" tstype:"number"`
	Linked      bool    `json:"linked" tstype:"boolean"`
}

// TeneoBurnEvent is sent when Teneo points are burned (travel cost)
type TeneoBurnEvent struct {
	Amount     float64 `json:"amount" tstype:"number"`
	Reason     string  `json:"reason" tstype:"string"`
	NewBalance float64 `json:"newBalance" tstype:"number"`
}
