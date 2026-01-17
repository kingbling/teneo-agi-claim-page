package db

import (
	"errors"
	"time"

	"teneo/server-go/internal/models"

	"gorm.io/gorm"
)

// GetSynapseExplorers retrieves all explorers for a synapse
func GetSynapseExplorers(db *gorm.DB, synapseID string) ([]models.SynapseExplorer, error) {
	var explorers []models.SynapseExplorer
	result := db.Where("synapse_id = ?", synapseID).Find(&explorers)
	if result.Error != nil {
		return nil, result.Error
	}
	return explorers, nil
}

// GetSynapseExplorerCount returns the count of explorers for a synapse
func GetSynapseExplorerCount(db *gorm.DB, synapseID string) (int64, error) {
	var count int64
	result := db.Model(&models.SynapseExplorer{}).Where("synapse_id = ?", synapseID).Count(&count)
	return count, result.Error
}

// GetExplorerByShip finds the explorer entry for a ship
func GetExplorerByShip(db *gorm.DB, shipID string) (*models.SynapseExplorer, error) {
	var explorer models.SynapseExplorer
	result := db.First(&explorer, "ship_id = ?", shipID)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, errors.New("explorer not found")
	}
	if result.Error != nil {
		return nil, result.Error
	}
	return &explorer, nil
}

// AddSynapseExplorer adds a new explorer to a synapse
func AddSynapseExplorer(db *gorm.DB, explorer *models.SynapseExplorer) error {
	return db.Create(explorer).Error
}

// UpdateExplorerPoints adds points to an explorer's contribution
func UpdateExplorerPoints(db *gorm.DB, explorerID string, points int) error {
	return db.Model(&models.SynapseExplorer{}).
		Where("id = ?", explorerID).
		Updates(map[string]interface{}{
			"points_contributed": gorm.Expr("points_contributed + ?", points),
			"last_updated_at":    time.Now().UnixMilli(),
		}).Error
}

// UpdateExplorerRate updates an explorer's points per minute rate
func UpdateExplorerRate(db *gorm.DB, explorerID string, rate int) error {
	return db.Model(&models.SynapseExplorer{}).
		Where("id = ?", explorerID).
		Updates(map[string]interface{}{
			"points_per_minute": rate,
			"last_updated_at":   time.Now().UnixMilli(),
		}).Error
}

// RemoveSynapseExplorer removes an explorer from a synapse
func RemoveSynapseExplorer(db *gorm.DB, shipID string) error {
	return db.Where("ship_id = ?", shipID).Delete(&models.SynapseExplorer{}).Error
}

// ClearSynapseExplorers removes all explorers from a synapse
func ClearSynapseExplorers(db *gorm.DB, synapseID string) error {
	return db.Where("synapse_id = ?", synapseID).Delete(&models.SynapseExplorer{}).Error
}

// GetActiveSynapseIDs returns IDs of all synapses being explored
func GetActiveSynapseIDs(db *gorm.DB) ([]string, error) {
	var ids []string
	result := db.Model(&models.SynapseExplorer{}).
		Distinct().
		Pluck("synapse_id", &ids)
	if result.Error != nil {
		return nil, result.Error
	}
	return ids, nil
}

// GetAllExplorers returns all active explorers
func GetAllExplorers(db *gorm.DB) ([]models.SynapseExplorer, error) {
	var explorers []models.SynapseExplorer
	result := db.Find(&explorers)
	if result.Error != nil {
		return nil, result.Error
	}
	return explorers, nil
}
