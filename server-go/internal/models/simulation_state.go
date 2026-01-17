package models

// SimulationState tracks the simulation tick state
type SimulationState struct {
	ID         int   `gorm:"primaryKey;check:id = 1" json:"id"`
	TickCount  int64 `gorm:"default:0" json:"tickCount"`
	LastTickAt int64 `json:"lastTickAt"`
	IsRunning  bool  `gorm:"default:true" json:"isRunning"`
}

func (SimulationState) TableName() string { return "simulation_state" }
