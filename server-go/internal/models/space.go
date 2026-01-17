package models

// Space represents a synapse location
type Space struct {
	ID                string  `gorm:"primaryKey" json:"id"`
	PositionX         float64 `json:"positionX"`
	PositionY         float64 `json:"positionY"`
	PositionZ         float64 `json:"positionZ"`
	Region            string  `gorm:"index" json:"region"`
	Zone              string  `gorm:"index" json:"zone"`
	SynapseCount      int     `json:"synapseCount"`
	State             string  `gorm:"index;default:undiscovered" json:"state"`
	DiscoveredAt      *int64  `json:"discoveredAt,omitempty"`

	// Synapse Type System
	SynapseType       string `gorm:"index;default:minor" json:"synapseType"`
	PointsRequired    int    `gorm:"default:6000" json:"pointsRequired"`
	PointsAccumulated int    `gorm:"default:0" json:"pointsAccumulated"`
	CurrentEtaMinutes *int   `json:"currentEtaMinutes,omitempty"`
	SectorID          *string `gorm:"index" json:"sectorId,omitempty"`
	AgiReward         int    `gorm:"default:10" json:"agiReward"`
	BrainXpReward     int    `gorm:"default:100" json:"brainXpReward"`

	// Relations
	Explorers []SynapseExplorer `gorm:"foreignKey:SynapseID" json:"explorers,omitempty"`
}

func (Space) TableName() string { return "spaces" }
