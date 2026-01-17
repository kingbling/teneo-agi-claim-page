package models

// SynapseExplorer represents an active exploration
type SynapseExplorer struct {
	ID                string `gorm:"primaryKey" json:"id"`
	SynapseID         string `gorm:"index" json:"synapseId"`
	ShipID            string `gorm:"index" json:"shipId"`
	UserID            string `gorm:"index" json:"userId"`
	PointsContributed int    `gorm:"default:0" json:"pointsContributed"`
	PointsPerMinute   int    `gorm:"default:100" json:"pointsPerMinute"`
	JoinedAt          int64  `json:"joinedAt"`
	LastUpdatedAt     int64  `json:"lastUpdatedAt"`

	// Relations
	Synapse *Space  `gorm:"foreignKey:SynapseID" json:"synapse,omitempty"`
	Ship    *Agent  `gorm:"foreignKey:ShipID" json:"ship,omitempty"`
	User    *User   `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (SynapseExplorer) TableName() string { return "synapse_explorers" }
