package db

import (
	"errors"

	"teneo/server-go/internal/models"

	"gorm.io/gorm"
)

// GetAgent retrieves an agent by ID
func GetAgent(db *gorm.DB, id string) (*models.Agent, error) {
	var agent models.Agent
	result := db.First(&agent, "id = ?", id)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, errors.New("agent not found")
	}
	if result.Error != nil {
		return nil, result.Error
	}
	return &agent, nil
}

// GetAgentsByOwner retrieves all agents for a user
func GetAgentsByOwner(db *gorm.DB, ownerID string) ([]models.Agent, error) {
	var agents []models.Agent
	result := db.Where("owner_id = ?", ownerID).Find(&agents)
	if result.Error != nil {
		return nil, result.Error
	}
	return agents, nil
}

// CreateAgent creates a new agent
func CreateAgent(db *gorm.DB, agent *models.Agent) error {
	return db.Create(agent).Error
}

// UpdateAgent updates an agent's state
func UpdateAgent(db *gorm.DB, agent *models.Agent) error {
	return db.Save(agent).Error
}

// GetAgentCount returns the total number of agents
func GetAgentCount(db *gorm.DB) (int64, error) {
	var count int64
	result := db.Model(&models.Agent{}).Count(&count)
	return count, result.Error
}

// GetAgentsByState retrieves agents by state
func GetAgentsByState(db *gorm.DB, state string) ([]models.Agent, error) {
	var agents []models.Agent
	result := db.Where("state = ?", state).Find(&agents)
	if result.Error != nil {
		return nil, result.Error
	}
	return agents, nil
}
