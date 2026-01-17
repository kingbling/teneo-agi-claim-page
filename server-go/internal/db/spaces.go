package db

import (
	"errors"

	"teneo/server-go/internal/models"

	"gorm.io/gorm"
)

// GetSpace retrieves a space by ID
func GetSpace(db *gorm.DB, id string) (*models.Space, error) {
	var space models.Space
	result := db.First(&space, "id = ?", id)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, errors.New("space not found")
	}
	if result.Error != nil {
		return nil, result.Error
	}
	return &space, nil
}

// GetSpacesByState retrieves spaces by state
func GetSpacesByState(db *gorm.DB, state string, limit int) ([]models.Space, error) {
	var spaces []models.Space
	result := db.Where("state = ?", state).Limit(limit).Find(&spaces)
	if result.Error != nil {
		return nil, result.Error
	}
	return spaces, nil
}

// GetNearestSpace finds the nearest space to given coordinates within radius
func GetNearestSpace(db *gorm.DB, x, y, z, radius float64) (*models.Space, error) {
	var space models.Space

	// Use raw SQL for complex query with distance calculation
	sql := `
		SELECT * FROM spaces
		WHERE position_x BETWEEN ? AND ?
		  AND position_y BETWEEN ? AND ?
		  AND position_z BETWEEN ? AND ?
		ORDER BY (position_x - ?) * (position_x - ?) +
		         (position_y - ?) * (position_y - ?) +
		         (position_z - ?) * (position_z - ?) ASC
		LIMIT 1
	`

	result := db.Raw(sql, x-radius, x+radius, y-radius, y+radius, z-radius, z+radius, x, x, y, y, z, z).Scan(&space)

	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, errors.New("no space found near coordinates")
	}
	if result.Error != nil {
		return nil, result.Error
	}
	return &space, nil
}

// UpdateSpace updates a space
func UpdateSpace(db *gorm.DB, space *models.Space) error {
	return db.Save(space).Error
}

// GetSpaceCount returns the total number of spaces
func GetSpaceCount(db *gorm.DB) (int64, error) {
	var count int64
	result := db.Model(&models.Space{}).Count(&count)
	return count, result.Error
}

// SpaceStats holds statistics about spaces
type SpaceStats struct {
	Total       int64
	Undiscovered int64
	BeingSolved int64
	Discovered  int64
}

// GetSpaceStats returns statistics about spaces
func GetSpaceStats(db *gorm.DB) (*SpaceStats, error) {
	stats := &SpaceStats{}

	db.Model(&models.Space{}).Count(&stats.Total)
	db.Model(&models.Space{}).Where("state = ?", "undiscovered").Count(&stats.Undiscovered)
	db.Model(&models.Space{}).Where("state = ?", "being_solved").Count(&stats.BeingSolved)
	db.Model(&models.Space{}).Where("state = ?", "discovered").Count(&stats.Discovered)

	return stats, nil
}

// GetUndiscoveredSpaceInRegion finds an undiscovered space in a region
func GetUndiscoveredSpaceInRegion(db *gorm.DB, region string) (*models.Space, error) {
	var space models.Space
	result := db.Where("state = ? AND region = ?", "undiscovered", region).
		Order("RANDOM()").
		First(&space)

	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if result.Error != nil {
		return nil, result.Error
	}
	return &space, nil
}
