package admin

import (
	"time"

	"teneo/server-go/internal/db"
	"teneo/server-go/internal/models"

	"github.com/gofiber/fiber/v2"
)

// ResetShip resets a ship to idle state
func ResetShip(c *fiber.Ctx) error {
	database := db.Get()
	shipID := c.Params("id")

	// Remove from any exploration
	database.Where("ship_id = ?", shipID).Delete(&models.SynapseExplorer{})

	// Reset ship state
	if err := database.Model(&models.Agent{}).Where("id = ?", shipID).Updates(map[string]interface{}{
		"state":             "idle",
		"target_space_id":   nil,
		"travel_start_time": nil,
		"travel_duration":   nil,
	}).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to reset ship"})
	}

	return c.JSON(fiber.Map{"success": true, "message": "Ship reset to idle"})
}

// CompleteSynapse forcefully completes a synapse
func CompleteSynapse(c *fiber.Ctx) error {
	database := db.Get()
	spaceID := c.Params("id")

	var req struct {
		DistributeRewards bool `json:"distributeRewards"`
	}
	c.BodyParser(&req)

	// Get space info
	var space models.Space
	if err := database.Select("state, points_required").First(&space, "id = ?", spaceID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Space not found"})
	}

	if space.State == "discovered" {
		return c.Status(400).JSON(fiber.Map{"error": "Space already discovered"})
	}

	now := time.Now().UnixMilli()

	// Mark space as discovered
	if err := database.Model(&models.Space{}).Where("id = ?", spaceID).Updates(map[string]interface{}{
		"state":              "discovered",
		"points_accumulated": space.PointsRequired,
		"discovered_at":      now,
	}).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to complete space"})
	}

	// Get explorers
	var explorersData []models.SynapseExplorer
	database.Where("synapse_id = ?", spaceID).Find(&explorersData)

	explorers := make([]fiber.Map, len(explorersData))
	for i, exp := range explorersData {
		explorers[i] = fiber.Map{
			"shipId":            exp.ShipID,
			"userId":            exp.UserID,
			"pointsContributed": exp.PointsContributed,
		}

		// Reset ship to idle
		database.Model(&models.Agent{}).Where("id = ?", exp.ShipID).Updates(map[string]interface{}{
			"state":             "idle",
			"target_space_id":   nil,
			"travel_start_time": nil,
			"travel_duration":   nil,
		})
	}

	// Delete all explorers for this synapse
	database.Where("synapse_id = ?", spaceID).Delete(&models.SynapseExplorer{})

	return c.JSON(fiber.Map{
		"success":   true,
		"message":   "Synapse completed",
		"explorers": explorers,
	})
}

// GetSimulationStatus returns current simulation engine status
func GetSimulationStatus(c *fiber.Ctx) error {
	database := db.Get()

	// Get counts of agents by state
	var idleCount, searchingCount, travelingCount, solvingCount int64
	database.Model(&models.Agent{}).Where("state = ?", "idle").Count(&idleCount)
	database.Model(&models.Agent{}).Where("state = ?", "searching").Count(&searchingCount)
	database.Model(&models.Agent{}).Where("state = ?", "traveling").Count(&travelingCount)
	database.Model(&models.Agent{}).Where("state = ?", "solving").Count(&solvingCount)

	// Get active explorations
	var activeExplorations int64
	database.Model(&models.SynapseExplorer{}).Distinct("synapse_id").Count(&activeExplorations)

	// Get spaces in progress
	var spacesInProgress int64
	database.Model(&models.Space{}).Where("state = ?", "being_solved").Count(&spacesInProgress)

	return c.JSON(fiber.Map{
		"agentStates": fiber.Map{
			"idle":      idleCount,
			"searching": searchingCount,
			"traveling": travelingCount,
			"solving":   solvingCount,
			"total":     idleCount + searchingCount + travelingCount + solvingCount,
		},
		"activeExplorations": activeExplorations,
		"spacesInProgress":   spacesInProgress,
		"timestamp":          time.Now().UnixMilli(),
	})
}

// BulkResetShips resets multiple ships to idle
func BulkResetShips(c *fiber.Ctx) error {
	database := db.Get()

	var req struct {
		ShipIDs []string `json:"shipIds"`
		State   string   `json:"state"` // optional: filter by current state
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	resetCount := 0

	if len(req.ShipIDs) > 0 {
		// Reset specific ships
		for _, shipID := range req.ShipIDs {
			database.Where("ship_id = ?", shipID).Delete(&models.SynapseExplorer{})

			result := database.Model(&models.Agent{}).Where("id = ?", shipID).Updates(map[string]interface{}{
				"state":             "idle",
				"target_space_id":   nil,
				"travel_start_time": nil,
				"travel_duration":   nil,
			})

			if result.RowsAffected > 0 {
				resetCount++
			}
		}
	} else if req.State != "" {
		// Reset all ships in specific state
		var agents []models.Agent
		database.Select("id").Where("state = ?", req.State).Find(&agents)

		for _, agent := range agents {
			database.Where("ship_id = ?", agent.ID).Delete(&models.SynapseExplorer{})

			database.Model(&models.Agent{}).Where("id = ?", agent.ID).Updates(map[string]interface{}{
				"state":             "idle",
				"target_space_id":   nil,
				"travel_start_time": nil,
				"travel_duration":   nil,
			})
			resetCount++
		}
	} else {
		return c.Status(400).JSON(fiber.Map{"error": "Must provide shipIds or state filter"})
	}

	return c.JSON(fiber.Map{"success": true, "resetCount": resetCount})
}

// RecalculateUserLevels recalculates all user levels based on USDC spent
func RecalculateUserLevels(c *fiber.Ctx) error {
	database := db.Get()

	// Get user level thresholds
	levelThresholds := []struct {
		level   int
		minUSDC float64
	}{
		{5, 1000},
		{4, 100},
		{3, 10},
		{2, 1},
		{1, 0},
	}

	updatedCount := 0

	var users []models.User
	if err := database.Select("id, usdc_spent, user_level").Find(&users).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to query users"})
	}

	for _, user := range users {
		// Calculate correct level
		newLevel := 1
		for _, threshold := range levelThresholds {
			if user.UsdcSpent >= threshold.minUSDC {
				newLevel = threshold.level
				break
			}
		}

		if newLevel != user.UserLevel {
			database.Model(&models.User{}).Where("id = ?", user.ID).Update("user_level", newLevel)
			updatedCount++
		}
	}

	return c.JSON(fiber.Map{
		"success":      true,
		"updatedCount": updatedCount,
	})
}

