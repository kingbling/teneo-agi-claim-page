package admin

import (
	"errors"
	"time"

	"teneo/server-go/internal/database"
	"teneo/server-go/internal/database/generated"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

// ResetShip resets a ship to idle state
func ResetShip(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	shipID := c.Params("id")

	// Remove from any exploration
	if err := store.Queries.RemoveSynapseExplorer(ctx, shipID); err != nil {
		// Ignore errors if no explorer exists
	}

	// Reset ship state
	if err := store.Queries.ResetAgentToIdle(ctx, shipID); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to reset ship"})
	}

	return c.JSON(fiber.Map{"success": true, "message": "Ship reset to idle"})
}

// CompleteSynapse forcefully completes a synapse
func CompleteSynapse(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	spaceID := c.Params("id")

	var req struct {
		DistributeRewards bool `json:"distributeRewards"`
	}
	c.BodyParser(&req)

	// Get space info
	space, err := store.Queries.GetSpace(ctx, spaceID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Space not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get space"})
	}

	if space.State == "discovered" {
		return c.Status(400).JSON(fiber.Map{"error": "Space already discovered"})
	}

	now := time.Now().UnixMilli()

	// Mark space as discovered
	if err := store.Queries.CompleteSpace(ctx, generated.CompleteSpaceParams{
		ID:           spaceID,
		DiscoveredAt: &now,
	}); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to complete space"})
	}

	// Get explorers
	explorersList, err := store.Queries.GetSynapseExplorers(ctx, spaceID)
	if err != nil {
		explorersList = nil
	}

	explorers := make([]fiber.Map, len(explorersList))
	for i, exp := range explorersList {
		explorers[i] = fiber.Map{
			"shipId":            exp.ShipID,
			"userId":            exp.UserID,
			"pointsContributed": exp.PointsContributed,
		}

		// Reset ship to idle
		store.Queries.ResetAgentToIdle(ctx, exp.ShipID)
	}

	// Delete all explorers for this synapse
	store.Queries.ClearSynapseExplorers(ctx, spaceID)

	return c.JSON(fiber.Map{
		"success":   true,
		"message":   "Synapse completed",
		"explorers": explorers,
	})
}

// GetSimulationStatus returns current simulation engine status
func GetSimulationStatus(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	// Get counts of agents by state
	agentCounts, err := store.Queries.GetOverviewAgentCounts(ctx)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get agent counts"})
	}

	// Get active explorations
	activeExplorations, err := store.Queries.GetActiveExplorationCount(ctx)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get active explorations"})
	}

	// Get spaces in progress
	spaceCounts, err := store.Queries.GetOverviewSpaceCounts(ctx)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get space counts"})
	}

	return c.JSON(fiber.Map{
		"agentStates": fiber.Map{
			"idle":      agentCounts.Idle,
			"searching": agentCounts.Searching,
			"traveling": agentCounts.Traveling,
			"solving":   agentCounts.Solving,
			"total":     agentCounts.Total,
		},
		"activeExplorations": activeExplorations,
		"spacesInProgress":   spaceCounts.BeingExplored,
		"timestamp":          time.Now().UnixMilli(),
	})
}

// BulkResetShips resets multiple ships to idle
func BulkResetShips(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

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
			store.Queries.RemoveSynapseExplorer(ctx, shipID)

			if err := store.Queries.ResetAgentToIdle(ctx, shipID); err == nil {
				resetCount++
			}
		}
	} else if req.State != "" {
		// Reset all ships in specific state
		agentIDs, err := store.Queries.GetAgentIDsByState(ctx, req.State)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to query agents"})
		}

		for _, agentID := range agentIDs {
			store.Queries.RemoveSynapseExplorer(ctx, agentID)
			store.Queries.ResetAgentToIdle(ctx, agentID)
			resetCount++
		}
	} else {
		return c.Status(400).JSON(fiber.Map{"error": "Must provide shipIds or state filter"})
	}

	return c.JSON(fiber.Map{"success": true, "resetCount": resetCount})
}

// RecalculateUserLevels recalculates all user levels based on USDC spent
func RecalculateUserLevels(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	// Get user level thresholds
	levelThresholds := []struct {
		level   int32
		minUSDC float64
	}{
		{5, 1000},
		{4, 100},
		{3, 10},
		{2, 1},
		{1, 0},
	}

	users, err := store.Queries.GetAllUsersForLevelRecalc(ctx)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to query users"})
	}

	updatedCount := 0

	for _, user := range users {
		// Calculate correct level
		newLevel := int32(1)
		for _, threshold := range levelThresholds {
			if user.UsdcSpent >= threshold.minUSDC {
				newLevel = threshold.level
				break
			}
		}

		if newLevel != user.UserLevel {
			if err := store.Queries.UpdateUserLevel(ctx, generated.UpdateUserLevelParams{
				ID:        user.ID,
				UserLevel: newLevel,
			}); err == nil {
				updatedCount++
			}
		}
	}

	return c.JSON(fiber.Map{
		"success":      true,
		"updatedCount": updatedCount,
	})
}
