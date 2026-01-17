package admin

import (
	"strconv"

	"teneo/server-go/internal/db"
	"teneo/server-go/internal/models"

	"github.com/gofiber/fiber/v2"
)

// ListSpaces returns paginated list of spaces/synapses
func ListSpaces(c *fiber.Ctx) error {
	database := db.Get()

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	state := c.Query("state", "")
	synapseType := c.Query("type", "")
	offset := (page - 1) * limit

	// Build query
	query := database.Model(&models.Space{})
	if state != "" {
		query = query.Where("state = ?", state)
	}
	if synapseType != "" {
		query = query.Where("synapse_type = ?", synapseType)
	}

	// Count total
	var total int64
	query.Count(&total)

	// Get spaces
	var spaces []models.Space
	query.Select("id, synapse_type, state, position_x, position_y, position_z, points_required, points_accumulated, discovered_at").
		Order("id").
		Limit(limit).
		Offset(offset).
		Find(&spaces)

	result := make([]fiber.Map, len(spaces))
	for i, space := range spaces {
		discoveredAt := int64(0)
		if space.DiscoveredAt != nil {
			discoveredAt = *space.DiscoveredAt
		}
		progress := float64(0)
		if space.PointsRequired > 0 {
			progress = float64(space.PointsAccumulated) / float64(space.PointsRequired) * 100
		}

		result[i] = fiber.Map{
			"id":                space.ID,
			"synapseType":       space.SynapseType,
			"state":             space.State,
			"positionX":         space.PositionX,
			"positionY":         space.PositionY,
			"positionZ":         space.PositionZ,
			"totalPoints":       space.PointsRequired,
			"pointsAccumulated": space.PointsAccumulated,
			"progress":          progress,
			"discoveredAt":      discoveredAt,
		}
	}

	return c.JSON(fiber.Map{
		"spaces": result,
		"total":  total,
		"page":   page,
		"limit":  limit,
	})
}

// GetInProgressSpaces returns spaces currently being explored
func GetInProgressSpaces(c *fiber.Ctx) error {
	database := db.Get()

	var spaces []models.Space
	database.Where("state = ?", "being_solved").
		Order("points_accumulated DESC").
		Find(&spaces)

	result := make([]fiber.Map, len(spaces))
	for i, space := range spaces {
		// Count explorers for this space
		var explorerCount int64
		database.Model(&models.SynapseExplorer{}).Where("synapse_id = ?", space.ID).Count(&explorerCount)

		progress := float64(0)
		if space.PointsRequired > 0 {
			progress = float64(space.PointsAccumulated) / float64(space.PointsRequired) * 100
		}

		result[i] = fiber.Map{
			"id":                space.ID,
			"synapseType":       space.SynapseType,
			"state":             space.State,
			"totalPoints":       space.PointsRequired,
			"pointsAccumulated": space.PointsAccumulated,
			"progress":          progress,
			"explorerCount":     explorerCount,
		}
	}

	return c.JSON(fiber.Map{"inProgress": result, "count": len(result)})
}

// GetSpaceDetail returns detailed info about a specific space
func GetSpaceDetail(c *fiber.Ctx) error {
	database := db.Get()
	spaceID := c.Params("id")

	var space models.Space
	if err := database.First(&space, "id = ?", spaceID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Space not found"})
	}

	// Get current explorers (only for active synapses)
	var explorers []fiber.Map
	if space.State == "being_solved" {
		var results []struct {
			ID                string  `gorm:"column:id"`
			ShipID            string  `gorm:"column:ship_id"`
			UserID            string  `gorm:"column:user_id"`
			PointsPerMinute   int     `gorm:"column:points_per_minute"`
			PointsContributed int     `gorm:"column:points_contributed"`
			JoinedAt          int64   `gorm:"column:joined_at"`
			ShipName          *string `gorm:"column:name"`
			Wallet            *string `gorm:"column:wallet"`
		}

		database.Table("synapse_explorers se").
			Select("se.id, se.ship_id, se.user_id, se.points_per_minute, se.points_contributed, se.joined_at, a.name, u.wallet").
			Joins("LEFT JOIN agents a ON se.ship_id = a.id").
			Joins("LEFT JOIN users u ON se.user_id = u.id").
			Where("se.synapse_id = ?", spaceID).
			Find(&results)

		explorers = make([]fiber.Map, len(results))
		for i, r := range results {
			shipName := ""
			if r.ShipName != nil {
				shipName = *r.ShipName
			}
			wallet := ""
			if r.Wallet != nil {
				wallet = *r.Wallet
			}
			explorers[i] = fiber.Map{
				"id":                r.ID,
				"shipId":            r.ShipID,
				"shipName":          shipName,
				"userId":            r.UserID,
				"userWallet":        wallet,
				"pointsPerMin":      r.PointsPerMinute,
				"pointsContributed": r.PointsContributed,
				"joinedAt":          r.JoinedAt,
			}
		}
	}

	progress := float64(0)
	if space.PointsRequired > 0 {
		progress = float64(space.PointsAccumulated) / float64(space.PointsRequired) * 100
	}
	discoveredAt := int64(0)
	if space.DiscoveredAt != nil {
		discoveredAt = *space.DiscoveredAt
	}

	return c.JSON(fiber.Map{
		"id":                space.ID,
		"synapseType":       space.SynapseType,
		"state":             space.State,
		"positionX":         space.PositionX,
		"positionY":         space.PositionY,
		"positionZ":         space.PositionZ,
		"pointsRequired":    space.PointsRequired,
		"pointsAccumulated": space.PointsAccumulated,
		"progress":          progress,
		"discoveredAt":      discoveredAt,
		"currentExplorers":  explorers,
	})
}
