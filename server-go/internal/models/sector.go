package models

// Sector represents a game sector/season
type Sector struct {
	ID                    string  `gorm:"primaryKey" json:"id"`
	Name                  string  `json:"name"`
	Description           *string `json:"description,omitempty"`
	IsActive              bool    `gorm:"index;default:false" json:"isActive"`
	UnlockCondition       *string `json:"unlockCondition,omitempty"`
	RewardPool            int     `gorm:"default:0" json:"rewardPool"`
	StartDate             *int64  `json:"startDate,omitempty"`
	EndDate               *int64  `json:"endDate,omitempty"`
	CreatedAt             int64   `json:"createdAt"`
	Region                string  `gorm:"default:frontal" json:"region"`
	StartTime             *int64  `json:"startTime,omitempty"`
	EndTime               *int64  `json:"endTime,omitempty"`
	TotalSynapses         int     `gorm:"default:0" json:"totalSynapses"`
	CompletedSynapses     int     `gorm:"default:0" json:"completedSynapses"`
	TotalAgiRewards       int     `gorm:"default:0" json:"totalAgiRewards"`
	DistributedAgiRewards int     `gorm:"default:0" json:"distributedAgiRewards"`
	ParticipantCount      int     `gorm:"default:0" json:"participantCount"`
}

func (Sector) TableName() string { return "sectors" }
