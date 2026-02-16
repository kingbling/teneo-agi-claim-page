package admin

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"time"

	"teneo/server-go/internal/brainshape"
	"teneo/server-go/internal/config"
	"teneo/server-go/internal/database"
	"teneo/server-go/internal/database/generated"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// recomputeSpaceClusters rebuilds space clusters at all LOD levels
func recomputeSpaceClusters(ctx context.Context, store *database.Store) {
	now := time.Now().UnixMilli()

	// Delete old clusters
	if err := store.Queries.DeleteAllSpaceClusters(ctx); err != nil {
		log.Printf("[Admin] Failed to delete space clusters: %v", err)
		return
	}

	// Reinsert at all 3 LOD levels
	for lodLevel := 0; lodLevel <= 2; lodLevel++ {
		gridSize := config.LODGridSizes[lodLevel]
		if err := store.Queries.InsertSpaceClusters(ctx, generated.InsertSpaceClustersParams{
			Column1: int32(lodLevel),
			Column2: gridSize,
			Column3: now,
		}); err != nil {
			log.Printf("[Admin] Failed to insert space clusters LOD %d: %v", lodLevel, err)
		}
	}
	log.Println("[Admin] Space clusters recomputed")
}

// ListBrainParts returns all brain parts with synapse counts
func ListBrainParts(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	parts, err := store.Queries.ListBrainParts(ctx)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to list brain parts"})
	}

	result := make([]fiber.Map, len(parts))
	for i, p := range parts {
		count, _ := store.Queries.CountSpacesByRegion(ctx, p.Name)

		result[i] = fiber.Map{
			"id":          p.ID,
			"name":        p.Name,
			"displayName": p.DisplayName,
			"description": p.Description,
			"centerX":     p.CenterX,
			"centerY":     p.CenterY,
			"centerZ":     p.CenterZ,
			"radius":      p.Radius,
			"colorR":      p.ColorR,
			"colorG":      p.ColorG,
			"colorB":      p.ColorB,
			"isEnabled":   p.IsEnabled,
			"sortOrder":   p.SortOrder,
			"synapseCount": count,
			"createdAt":   p.CreatedAt,
			"updatedAt":   p.UpdatedAt,
		}
	}

	return c.JSON(fiber.Map{"brainParts": result})
}

// CreateBrainPart creates a new brain part
func CreateBrainPart(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	var req struct {
		Name        string  `json:"name"`
		DisplayName string  `json:"displayName"`
		Description string  `json:"description"`
		CenterX     float64 `json:"centerX"`
		CenterY     float64 `json:"centerY"`
		CenterZ     float64 `json:"centerZ"`
		Radius      float64 `json:"radius"`
		ColorR      float64 `json:"colorR"`
		ColorG      float64 `json:"colorG"`
		ColorB      float64 `json:"colorB"`
		IsEnabled   *bool   `json:"isEnabled"`
		SortOrder   int     `json:"sortOrder"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Name is required"})
	}
	if req.DisplayName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Display name is required"})
	}
	if req.Radius <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Radius must be positive"})
	}

	// Check name uniqueness
	_, err := store.Queries.GetBrainPartByName(ctx, req.Name)
	if err == nil {
		return c.Status(409).JSON(fiber.Map{"error": "Brain part name already exists"})
	}

	isEnabled := false
	if req.IsEnabled != nil {
		isEnabled = *req.IsEnabled
	}

	now := time.Now().UnixMilli()
	p, err := store.Queries.CreateBrainPart(ctx, generated.CreateBrainPartParams{
		ID:          uuid.New().String(),
		Name:        req.Name,
		DisplayName: req.DisplayName,
		Description: req.Description,
		CenterX:     req.CenterX,
		CenterY:     req.CenterY,
		CenterZ:     req.CenterZ,
		Radius:      req.Radius,
		ColorR:      float32(req.ColorR),
		ColorG:      float32(req.ColorG),
		ColorB:      float32(req.ColorB),
		IsEnabled:   isEnabled,
		SortOrder:   int32(req.SortOrder),
		CreatedAt:   now,
		UpdatedAt:   now,
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create brain part"})
	}

	return c.JSON(fiber.Map{"success": true, "id": p.ID})
}

// UpdateBrainPart updates an existing brain part (merge-and-update pattern)
func UpdateBrainPart(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	id := c.Params("id")

	var req struct {
		Name        *string  `json:"name"`
		DisplayName *string  `json:"displayName"`
		Description *string  `json:"description"`
		CenterX     *float64 `json:"centerX"`
		CenterY     *float64 `json:"centerY"`
		CenterZ     *float64 `json:"centerZ"`
		Radius      *float64 `json:"radius"`
		ColorR      *float64 `json:"colorR"`
		ColorG      *float64 `json:"colorG"`
		ColorB      *float64 `json:"colorB"`
		IsEnabled   *bool    `json:"isEnabled"`
		SortOrder   *int     `json:"sortOrder"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	existing, err := store.Queries.GetBrainPart(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Brain part not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get brain part"})
	}

	params := generated.UpdateBrainPartParams{
		ID:          existing.ID,
		Name:        existing.Name,
		DisplayName: existing.DisplayName,
		Description: existing.Description,
		CenterX:     existing.CenterX,
		CenterY:     existing.CenterY,
		CenterZ:     existing.CenterZ,
		Radius:      existing.Radius,
		ColorR:      existing.ColorR,
		ColorG:      existing.ColorG,
		ColorB:      existing.ColorB,
		IsEnabled:   existing.IsEnabled,
		SortOrder:   existing.SortOrder,
		UpdatedAt:   time.Now().UnixMilli(),
	}

	if req.Name != nil {
		if *req.Name != existing.Name {
			_, err := store.Queries.GetBrainPartByName(ctx, *req.Name)
			if err == nil {
				return c.Status(409).JSON(fiber.Map{"error": "Brain part name already exists"})
			}
		}
		params.Name = *req.Name
	}
	if req.DisplayName != nil {
		params.DisplayName = *req.DisplayName
	}
	if req.Description != nil {
		params.Description = *req.Description
	}
	if req.CenterX != nil {
		params.CenterX = *req.CenterX
	}
	if req.CenterY != nil {
		params.CenterY = *req.CenterY
	}
	if req.CenterZ != nil {
		params.CenterZ = *req.CenterZ
	}
	if req.Radius != nil {
		params.Radius = *req.Radius
	}
	if req.ColorR != nil {
		params.ColorR = float32(*req.ColorR)
	}
	if req.ColorG != nil {
		params.ColorG = float32(*req.ColorG)
	}
	if req.ColorB != nil {
		params.ColorB = float32(*req.ColorB)
	}
	if req.IsEnabled != nil {
		params.IsEnabled = *req.IsEnabled
	}
	if req.SortOrder != nil {
		params.SortOrder = int32(*req.SortOrder)
	}

	if err := store.Queries.UpdateBrainPart(ctx, params); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update brain part"})
	}

	return c.JSON(fiber.Map{"success": true})
}

// DeleteBrainPart deletes a brain part (refused if synapses reference it)
func DeleteBrainPart(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	id := c.Params("id")

	p, err := store.Queries.GetBrainPart(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Brain part not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to check brain part"})
	}

	count, _ := store.Queries.CountSpacesByRegion(ctx, p.Name)
	if count > 0 {
		return c.Status(409).JSON(fiber.Map{
			"error": fmt.Sprintf("Cannot delete: %d synapses in this brain part.", count),
		})
	}

	if err := store.Queries.DeleteBrainPart(ctx, id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete brain part"})
	}

	return c.JSON(fiber.Map{"success": true})
}

// ToggleBrainPart toggles the is_enabled flag on a brain part
func ToggleBrainPart(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	id := c.Params("id")

	existing, err := store.Queries.GetBrainPart(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Brain part not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get brain part"})
	}

	if err := store.Queries.UpdateBrainPart(ctx, generated.UpdateBrainPartParams{
		ID:          existing.ID,
		Name:        existing.Name,
		DisplayName: existing.DisplayName,
		Description: existing.Description,
		CenterX:     existing.CenterX,
		CenterY:     existing.CenterY,
		CenterZ:     existing.CenterZ,
		Radius:      existing.Radius,
		ColorR:      existing.ColorR,
		ColorG:      existing.ColorG,
		ColorB:      existing.ColorB,
		IsEnabled:   !existing.IsEnabled,
		SortOrder:   existing.SortOrder,
		UpdatedAt:   time.Now().UnixMilli(),
	}); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to toggle brain part"})
	}

	return c.JSON(fiber.Map{"success": true, "isEnabled": !existing.IsEnabled})
}

// GenerateSynapsesForBrainPart generates synapses within a brain part's sphere
func GenerateSynapsesForBrainPart(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	id := c.Params("id")

	var req struct {
		SynapseTypeID string `json:"synapseTypeId"`
		Count         int    `json:"count"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Count < 1 || req.Count > 100000 {
		return c.Status(400).JSON(fiber.Map{"error": "Count must be between 1 and 100,000"})
	}

	// Get brain part
	bp, err := store.Queries.GetBrainPart(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Brain part not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get brain part"})
	}

	// Get synapse type
	st, err := store.Queries.GetSynapseType(ctx, req.SynapseTypeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Synapse type not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get synapse type"})
	}

	log.Printf("[Admin] Generating %d %s synapses in brain part %s...", req.Count, st.Name, bp.Name)

	const batchSize = 50000
	totalGenerated := 0

	for totalGenerated < req.Count {
		thisBatch := batchSize
		if totalGenerated+thisBatch > req.Count {
			thisBatch = req.Count - totalGenerated
		}

		rows := make([][]interface{}, 0, thisBatch)
		for i := 0; i < thisBatch; i++ {
			rawX, rawY, rawZ := brainshape.GeneratePointInSphere(bp.CenterX, bp.CenterY, bp.CenterZ, bp.Radius)
			posX, posY, posZ := brainshape.ConstrainToBrainShape(rawX, rawY, rawZ)
			zone := brainshape.GetZone(posY)

			agiReward := int(st.AgiRewardMin)
			if st.AgiRewardMax > st.AgiRewardMin {
				agiReward = int(st.AgiRewardMin) + rand.Intn(int(st.AgiRewardMax-st.AgiRewardMin)+1)
			}

			rows = append(rows, []interface{}{
				uuid.New().String(),         // id
				posX,                        // position_x
				posY,                        // position_y
				posZ,                        // position_z
				bp.Name,                     // region = brain part name
				zone,                        // zone
				1,                           // synapse_count
				"undiscovered",              // state
				st.Name,                     // synapse_type
				int(st.PointsRequired),      // points_required
				0,                           // points_accumulated
				agiReward,                   // agi_reward
				int(st.PointsRequired) / 20, // brain_xp_reward
			})
		}

		copyCount, err := store.Pool.CopyFrom(
			ctx,
			pgx.Identifier{"spaces"},
			[]string{
				"id", "position_x", "position_y", "position_z",
				"region", "zone", "synapse_count", "state",
				"synapse_type", "points_required", "points_accumulated",
				"agi_reward", "brain_xp_reward",
			},
			pgx.CopyFromRows(rows),
		)
		if err != nil {
			log.Printf("[Admin] COPY failed at batch %d: %v", totalGenerated, err)
			return c.Status(500).JSON(fiber.Map{
				"error":     "Failed to generate synapses",
				"generated": totalGenerated,
			})
		}

		totalGenerated += int(copyCount)
	}

	log.Printf("[Admin] Generated %d %s synapses in brain part %s", totalGenerated, st.Name, bp.Name)

	// Recompute space clusters so the new synapses appear in LOD views
	recomputeSpaceClusters(ctx, store)

	count, _ := store.Queries.CountSpacesByRegion(ctx, bp.Name)

	return c.JSON(fiber.Map{
		"success":      true,
		"generated":    totalGenerated,
		"totalForPart": count,
	})
}

// RecomputeClusters manually triggers cluster recomputation
func RecomputeClusters(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	recomputeSpaceClusters(ctx, store)

	return c.JSON(fiber.Map{"success": true})
}
