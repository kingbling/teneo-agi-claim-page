package admin

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"teneo/server-go/internal/database"
	"teneo/server-go/internal/database/generated"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ListShipTypes returns all ship types with agent counts
func ListShipTypes(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	types, err := store.Queries.ListShipTypes(ctx)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to list ship types"})
	}

	result := make([]fiber.Map, len(types))
	for i, t := range types {
		count, _ := store.Queries.CountAgentsByShipType(ctx, t.Name)

		result[i] = fiber.Map{
			"id":                   t.ID,
			"name":                 t.Name,
			"displayName":          t.DisplayName,
			"description":          t.Description,
			"creationCost":         t.CreationCost,
			"speedMultiplier":      t.SpeedMultiplier,
			"solveSpeedMultiplier": t.SolveSpeedMultiplier,
			"fuelCapacity":         t.FuelCapacity,
			"detectionRadius":      t.DetectionRadius,
			"modelFilename":        t.ModelFilename,
			"isActive":             t.IsActive,
			"sortOrder":            t.SortOrder,
			"agentCount":           count,
			"createdAt":            t.CreatedAt,
			"updatedAt":            t.UpdatedAt,
		}
	}

	return c.JSON(fiber.Map{"shipTypes": result})
}

// GetShipTypeDetail returns a single ship type by ID
func GetShipTypeDetail(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	id := c.Params("id")

	t, err := store.Queries.GetShipType(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Ship type not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get ship type"})
	}

	count, _ := store.Queries.CountAgentsByShipType(ctx, t.Name)

	return c.JSON(fiber.Map{
		"id":                   t.ID,
		"name":                 t.Name,
		"displayName":          t.DisplayName,
		"description":          t.Description,
		"creationCost":         t.CreationCost,
		"speedMultiplier":      t.SpeedMultiplier,
		"solveSpeedMultiplier": t.SolveSpeedMultiplier,
		"fuelCapacity":         t.FuelCapacity,
		"detectionRadius":      t.DetectionRadius,
		"modelFilename":        t.ModelFilename,
		"isActive":             t.IsActive,
		"sortOrder":            t.SortOrder,
		"agentCount":           count,
		"createdAt":            t.CreatedAt,
		"updatedAt":            t.UpdatedAt,
	})
}

// CreateShipType creates a new ship type
func CreateShipType(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	var req struct {
		Name                 string  `json:"name"`
		DisplayName          string  `json:"displayName"`
		Description          string  `json:"description"`
		CreationCost         int     `json:"creationCost"`
		SpeedMultiplier      float64 `json:"speedMultiplier"`
		SolveSpeedMultiplier float64 `json:"solveSpeedMultiplier"`
		FuelCapacity         int     `json:"fuelCapacity"`
		DetectionRadius      float64 `json:"detectionRadius"`
		IsActive             *bool   `json:"isActive"`
		SortOrder            int     `json:"sortOrder"`
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
	if req.SpeedMultiplier <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Speed multiplier must be positive"})
	}
	if req.SolveSpeedMultiplier <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Solve speed multiplier must be positive"})
	}

	// Check name uniqueness
	_, err := store.Queries.GetShipTypeByName(ctx, req.Name)
	if err == nil {
		return c.Status(409).JSON(fiber.Map{"error": "Ship type name already exists"})
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	if req.FuelCapacity == 0 {
		req.FuelCapacity = 100
	}
	if req.DetectionRadius == 0 {
		req.DetectionRadius = 2.0
	}

	now := time.Now().UnixMilli()
	t, err := store.Queries.CreateShipType(ctx, generated.CreateShipTypeParams{
		ID:                   uuid.New().String(),
		Name:                 req.Name,
		DisplayName:          req.DisplayName,
		Description:          req.Description,
		CreationCost:         int32(req.CreationCost),
		SpeedMultiplier:      float32(req.SpeedMultiplier),
		SolveSpeedMultiplier: float32(req.SolveSpeedMultiplier),
		FuelCapacity:         int32(req.FuelCapacity),
		DetectionRadius:      float32(req.DetectionRadius),
		IsActive:             isActive,
		SortOrder:            int32(req.SortOrder),
		CreatedAt:            now,
		UpdatedAt:            now,
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create ship type"})
	}

	return c.JSON(fiber.Map{"success": true, "id": t.ID})
}

// UpdateShipType updates an existing ship type (merge-and-update pattern)
func UpdateShipType(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	id := c.Params("id")

	var req struct {
		Name                 *string  `json:"name"`
		DisplayName          *string  `json:"displayName"`
		Description          *string  `json:"description"`
		CreationCost         *int     `json:"creationCost"`
		SpeedMultiplier      *float64 `json:"speedMultiplier"`
		SolveSpeedMultiplier *float64 `json:"solveSpeedMultiplier"`
		FuelCapacity         *int     `json:"fuelCapacity"`
		DetectionRadius      *float64 `json:"detectionRadius"`
		ModelFilename        *string  `json:"modelFilename"`
		IsActive             *bool    `json:"isActive"`
		SortOrder            *int     `json:"sortOrder"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	existing, err := store.Queries.GetShipType(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Ship type not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get ship type"})
	}

	params := generated.UpdateShipTypeParams{
		ID:                   existing.ID,
		Name:                 existing.Name,
		DisplayName:          existing.DisplayName,
		Description:          existing.Description,
		CreationCost:         existing.CreationCost,
		SpeedMultiplier:      existing.SpeedMultiplier,
		SolveSpeedMultiplier: existing.SolveSpeedMultiplier,
		FuelCapacity:         existing.FuelCapacity,
		DetectionRadius:      existing.DetectionRadius,
		ModelFilename:        existing.ModelFilename,
		IsActive:             existing.IsActive,
		SortOrder:            existing.SortOrder,
		UpdatedAt:            time.Now().UnixMilli(),
	}

	if req.Name != nil {
		if *req.Name != existing.Name {
			_, err := store.Queries.GetShipTypeByName(ctx, *req.Name)
			if err == nil {
				return c.Status(409).JSON(fiber.Map{"error": "Ship type name already exists"})
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
	if req.CreationCost != nil {
		params.CreationCost = int32(*req.CreationCost)
	}
	if req.SpeedMultiplier != nil {
		params.SpeedMultiplier = float32(*req.SpeedMultiplier)
	}
	if req.SolveSpeedMultiplier != nil {
		params.SolveSpeedMultiplier = float32(*req.SolveSpeedMultiplier)
	}
	if req.FuelCapacity != nil {
		params.FuelCapacity = int32(*req.FuelCapacity)
	}
	if req.DetectionRadius != nil {
		params.DetectionRadius = float32(*req.DetectionRadius)
	}
	if req.ModelFilename != nil {
		params.ModelFilename = req.ModelFilename
	}
	if req.IsActive != nil {
		params.IsActive = *req.IsActive
	}
	if req.SortOrder != nil {
		params.SortOrder = int32(*req.SortOrder)
	}

	if err := store.Queries.UpdateShipType(ctx, params); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update ship type"})
	}

	return c.JSON(fiber.Map{"success": true})
}

// DeleteShipType deletes a ship type (refused if agents reference it)
func DeleteShipType(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	id := c.Params("id")

	t, err := store.Queries.GetShipType(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Ship type not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to check ship type"})
	}

	count, _ := store.Queries.CountAgentsByShipType(ctx, t.Name)
	if count > 0 {
		return c.Status(409).JSON(fiber.Map{
			"error": fmt.Sprintf("Cannot delete: %d ships of this type exist.", count),
		})
	}

	if err := store.Queries.DeleteShipType(ctx, id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete ship type"})
	}

	return c.JSON(fiber.Map{"success": true})
}

// UploadShipTypeModel handles GLB model file upload for a ship type
func UploadShipTypeModel(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	id := c.Params("id")

	t, err := store.Queries.GetShipType(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Ship type not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get ship type"})
	}

	file, err := c.FormFile("model")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "No model file provided"})
	}

	if file.Size > 5*1024*1024 {
		return c.Status(400).JSON(fiber.Map{"error": "File too large (max 5MB)"})
	}

	ext := filepath.Ext(file.Filename)
	if ext != ".glb" {
		return c.Status(400).JSON(fiber.Map{"error": "Only .glb files are accepted"})
	}

	modelsDir := "public/models"
	if err := os.MkdirAll(modelsDir, 0755); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create models directory"})
	}

	filename := t.Name + ".glb"
	destPath := filepath.Join(modelsDir, filename)

	src, err := file.Open()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to read uploaded file"})
	}
	defer src.Close()

	dst, err := os.Create(destPath)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save model file"})
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to write model file"})
	}

	if err := store.Queries.UpdateShipType(ctx, generated.UpdateShipTypeParams{
		ID:                   t.ID,
		Name:                 t.Name,
		DisplayName:          t.DisplayName,
		Description:          t.Description,
		CreationCost:         t.CreationCost,
		SpeedMultiplier:      t.SpeedMultiplier,
		SolveSpeedMultiplier: t.SolveSpeedMultiplier,
		FuelCapacity:         t.FuelCapacity,
		DetectionRadius:      t.DetectionRadius,
		ModelFilename:        &filename,
		IsActive:             t.IsActive,
		SortOrder:            t.SortOrder,
		UpdatedAt:            time.Now().UnixMilli(),
	}); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update model filename"})
	}

	return c.JSON(fiber.Map{"success": true, "filename": filename})
}
