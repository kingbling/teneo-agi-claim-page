package models

// LiveEvent represents a time-limited game event
type LiveEvent struct {
	ID          string  `gorm:"primaryKey" json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	EventType   string  `gorm:"column:event_type" json:"eventType"`
	Multiplier  float64 `gorm:"default:1.0" json:"multiplier"`
	StartTime   int64   `json:"startTime"`
	EndTime     int64   `json:"endTime"`
	IsActive    bool    `gorm:"index;default:false" json:"isActive"`
	CreatedAt   int64   `json:"createdAt"`
}

func (LiveEvent) TableName() string { return "live_events" }
