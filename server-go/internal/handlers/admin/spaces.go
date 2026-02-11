package admin

import (
	"errors"
	"strconv"

	"teneo/server-go/internal/database"
	"teneo/server-go/internal/database/generated"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

// ListSpaces returns paginated list of spaces/synapses
func ListSpaces(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	state := c.Query("state", "")
	synapseType := c.Query("type", "")
	if synapseType == "" {
		synapseType = c.Query("synapseType", "")
	}
	offset := (page - 1) * limit

	var spaces []generated.Space
	var total int64

	if state != "" || synapseType != "" {
		// Use raw SQL for dynamic filtering since sqlc doesn't support dynamic WHERE
		countQuery := "SELECT COUNT(*) FROM spaces WHERE 1=1"
		dataQuery := `SELECT id, position_x, position_y, position_z, region, zone, synapse_count,
		                     state, discovered_at, synapse_type, points_required, points_accumulated,
		                     current_eta_minutes, sector_id, agi_reward, brain_xp_reward
		              FROM spaces WHERE 1=1`
		var args []interface{}
		argIdx := 1

		if state != "" {
			countQuery += " AND state = $" + strconv.Itoa(argIdx)
			dataQuery += " AND state = $" + strconv.Itoa(argIdx)
			args = append(args, state)
			argIdx++
		}
		if synapseType != "" {
			countQuery += " AND synapse_type = $" + strconv.Itoa(argIdx)
			dataQuery += " AND synapse_type = $" + strconv.Itoa(argIdx)
			args = append(args, synapseType)
			argIdx++
		}

		// Count
		countRow := store.Pool.QueryRow(ctx, countQuery, args...)
		if err := countRow.Scan(&total); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to count spaces"})
		}

		// Data with pagination
		dataQuery += " ORDER BY id LIMIT $" + strconv.Itoa(argIdx) + " OFFSET $" + strconv.Itoa(argIdx+1)
		args = append(args, limit, offset)

		rows, err := store.Pool.Query(ctx, dataQuery, args...)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to query spaces"})
		}
		defer rows.Close()

		for rows.Next() {
			var s generated.Space
			if err := rows.Scan(
				&s.ID, &s.PositionX, &s.PositionY, &s.PositionZ, &s.Region, &s.Zone,
				&s.SynapseCount, &s.State, &s.DiscoveredAt, &s.SynapseType,
				&s.PointsRequired, &s.PointsAccumulated, &s.CurrentEtaMinutes,
				&s.SectorID, &s.AgiReward, &s.BrainXpReward,
			); err != nil {
				return c.Status(500).JSON(fiber.Map{"error": "Failed to scan space"})
			}
			spaces = append(spaces, s)
		}
		if err := rows.Err(); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to iterate spaces"})
		}
	} else {
		var err error
		total, err = store.Queries.GetSpaceCount(ctx)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to count spaces"})
		}

		spaces, err = store.Queries.ListSpaces(ctx, generated.ListSpacesParams{
			Limit:  int32(limit),
			Offset: int32(offset),
		})
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to list spaces"})
		}
	}

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
			"position":          fiber.Map{"x": space.PositionX, "y": space.PositionY, "z": space.PositionZ},
			"pointsRequired":    space.PointsRequired,
			"pointsAccumulated": space.PointsAccumulated,
			"progress":          progress,
			"agiReward":         space.AgiReward,
			"discoveredAt":      discoveredAt,
		}
	}

	totalPages := (total + int64(limit) - 1) / int64(limit)
	return c.JSON(fiber.Map{
		"spaces": result,
		"pagination": fiber.Map{
			"page":       page,
			"limit":      limit,
			"total":      total,
			"totalPages": totalPages,
		},
	})
}

// GetInProgressSpaces returns spaces currently being explored
func GetInProgressSpaces(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	spaces, err := store.Queries.GetInProgressSpaces(ctx, generated.GetInProgressSpacesParams{
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get in-progress spaces"})
	}

	result := make([]fiber.Map, len(spaces))
	for i, space := range spaces {
		// Count explorers for this space
		explorerCount, err := store.Queries.GetSynapseExplorerCount(ctx, space.ID)
		if err != nil {
			explorerCount = 0
		}

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
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	spaceID := c.Params("id")

	space, err := store.Queries.GetSpace(ctx, spaceID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Space not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get space"})
	}

	// Get current explorers (only for active synapses)
	var explorers []fiber.Map
	if space.State == "being_solved" {
		// Use raw SQL for the join query
		rows, err := store.Pool.Query(ctx,
			`SELECT se.id, se.ship_id, se.user_id, se.points_per_minute, se.points_contributed, se.joined_at,
			        a.name, u.wallet
			 FROM synapse_explorers se
			 LEFT JOIN agents a ON se.ship_id = a.id
			 LEFT JOIN users u ON se.user_id = u.id
			 WHERE se.synapse_id = $1`, spaceID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var (
					id                string
					shipID            string
					userID            string
					pointsPerMinute   int32
					pointsContributed int32
					joinedAt          int64
					shipName          *string
					wallet            *string
				)
				if err := rows.Scan(&id, &shipID, &userID, &pointsPerMinute, &pointsContributed, &joinedAt, &shipName, &wallet); err != nil {
					continue
				}
				sn := ""
				if shipName != nil {
					sn = *shipName
				}
				w := ""
				if wallet != nil {
					w = *wallet
				}
				explorers = append(explorers, fiber.Map{
					"id":                id,
					"shipId":            shipID,
					"shipName":          sn,
					"userId":            userID,
					"userWallet":        w,
					"pointsPerMin":      pointsPerMinute,
					"pointsContributed": pointsContributed,
					"joinedAt":          joinedAt,
				})
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
