package models

// SpaceCluster represents a LOD cluster of spaces
type SpaceCluster struct {
	ID               string  `gorm:"primaryKey" json:"id"`
	LodLevel         int     `gorm:"index" json:"lodLevel"`
	PositionX        float64 `json:"positionX"`
	PositionY        float64 `json:"positionY"`
	PositionZ        float64 `json:"positionZ"`
	SpaceCount       int     `json:"spaceCount"`
	DiscoveredCount  int     `gorm:"default:0" json:"discoveredCount"`
	BeingSolvedCount int     `gorm:"default:0" json:"beingSolvedCount"`
	UpdatedAt        int64   `json:"updatedAt"`
}

func (SpaceCluster) TableName() string { return "space_clusters" }

// AgentCluster represents a LOD cluster of agents
type AgentCluster struct {
	ID            string  `gorm:"primaryKey" json:"id"`
	LodLevel      int     `gorm:"index" json:"lodLevel"`
	PositionX     float64 `json:"positionX"`
	PositionY     float64 `json:"positionY"`
	PositionZ     float64 `json:"positionZ"`
	AgentCount    int     `json:"agentCount"`
	DominantState string  `json:"dominantState"`
	AvgProgress   float64 `gorm:"default:0" json:"avgProgress"`
	UpdatedAt     int64   `json:"updatedAt"`
}

func (AgentCluster) TableName() string { return "agent_clusters" }
