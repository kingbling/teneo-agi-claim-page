package db

import (
	"fmt"
	"log"

	"teneo/server-go/internal/models"

	"gorm.io/gorm"
)

// AutoMigrate runs automatic database migrations for all models
func AutoMigrate(database *gorm.DB) error {
	log.Println("[MIGRATE] Running database migrations...")

	// Migrate all models in the correct order (to handle foreign keys)
	err := database.AutoMigrate(
		// Core tables (no foreign key dependencies)
		&models.User{},
		&models.Sector{},
		&models.LiveEvent{},
		&models.SimulationState{},

		// Shop tables
		&models.ItemShop{},
		&models.UserPurchase{},
		&models.NFT{},

		// Game tables (depend on User)
		&models.Agent{},
		&models.Space{},

		// Exploration tables (depend on Space, Agent, User)
		&models.SynapseExplorer{},

		// Cluster tables (for LOD system)
		&models.SpaceCluster{},
		&models.AgentCluster{},
	)

	if err != nil {
		return fmt.Errorf("migration failed: %w", err)
	}

	log.Println("[MIGRATE] Database migrations completed successfully")
	return nil
}
