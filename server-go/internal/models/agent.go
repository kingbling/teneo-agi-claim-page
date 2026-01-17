package models

// Agent represents a ship
type Agent struct {
	ID              string  `gorm:"primaryKey" json:"id"`
	OwnerID         string  `gorm:"index" json:"ownerId"`
	Name            string  `json:"name"`
	State           string  `gorm:"index;default:idle" json:"state"`
	PositionX       float64 `json:"positionX"`
	PositionY       float64 `json:"positionY"`
	PositionZ       float64 `json:"positionZ"`
	StartPositionX  *float64 `json:"startPositionX,omitempty"`
	StartPositionY  *float64 `json:"startPositionY,omitempty"`
	StartPositionZ  *float64 `json:"startPositionZ,omitempty"`
	TargetSpaceID   *string `gorm:"index" json:"targetSpaceId,omitempty"`
	TravelStartTime *int64  `json:"travelStartTime,omitempty"`
	TravelDuration  *int64  `json:"travelDuration,omitempty"`
	Traits          string  `gorm:"default:[]" json:"traits"`

	// Movement & Wander
	WanderDirX  float64 `gorm:"default:0" json:"wanderDirX"`
	WanderDirY  float64 `gorm:"default:0" json:"wanderDirY"`
	WanderDirZ  float64 `gorm:"default:0" json:"wanderDirZ"`
	WanderPhase float64 `gorm:"default:0" json:"wanderPhase"`

	// Masterplan 2026: Ship System
	AutopilotEnabled    bool   `gorm:"default:false" json:"autopilotEnabled"`
	EquippedItems       string `gorm:"default:[]" json:"equippedItems"`
	CurrentPointsPerMin int    `gorm:"default:100" json:"currentPointsPerMin"`

	// Stats
	SpacesDiscovered   int   `gorm:"default:0" json:"spacesDiscovered"`
	TotalAgiEarned     int   `gorm:"default:0" json:"totalAgiEarned"`
	TotalBrainXpEarned int   `gorm:"default:0" json:"totalBrainXpEarned"`
	CreatedAt          int64 `json:"createdAt"`

	// Additional fields
	CreationCost     int      `gorm:"default:100" json:"creationCost"`
	NeedsRepair      bool     `gorm:"default:false" json:"needsRepair"`
	ShipType         string   `gorm:"default:neuron" json:"shipType"`
	HomeX            float64  `gorm:"default:0" json:"homeX"`
	HomeY            float64  `gorm:"default:0" json:"homeY"`
	HomeZ            float64  `gorm:"default:0" json:"homeZ"`
	TargetX          *float64 `json:"targetX,omitempty"`
	TargetY          *float64 `json:"targetY,omitempty"`
	TargetZ          *float64 `json:"targetZ,omitempty"`
	CurrentSpaceID   *string  `json:"currentSpaceId,omitempty"`
	SolveStartTime   *int64   `json:"solveStartTime,omitempty"`
	DistanceTraveled float64  `gorm:"default:0" json:"distanceTraveled"`
	DeployedAt       *int64   `json:"deployedAt,omitempty"`
	TranceActive     bool     `gorm:"default:false" json:"tranceActive"`
	TranceEndTime    *int64   `json:"tranceEndTime,omitempty"`
	TranceLevel      int      `gorm:"default:0" json:"tranceLevel"`

	// Autopilot preferences
	AutopilotTargetTypes  string `gorm:"default:[]" json:"autopilotTargetTypes"`
	AutopilotMaxPointsCap int    `gorm:"default:0" json:"autopilotMaxPointsCap"`
	AutopilotAvoidCrowded bool   `gorm:"default:false" json:"autopilotAvoidCrowded"`

	// Relations
	Owner       *User  `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	TargetSpace *Space `gorm:"foreignKey:TargetSpaceID" json:"targetSpace,omitempty"`
}

func (Agent) TableName() string { return "agents" }
