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

// ListSynapseTypes returns all synapse types ordered by sort_order
func ListSynapseTypes(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	types, err := store.Queries.ListSynapseTypes(ctx)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to list synapse types"})
	}

	result := make([]fiber.Map, len(types))
	for i, t := range types {
		// Count synapses and total AGI for this type
		count, _ := store.Queries.CountSpacesBySynapseType(ctx, t.Name)
		totalAgi, _ := store.Queries.SumAGIBySynapseType(ctx, t.Name)

		result[i] = fiber.Map{
			"id":              t.ID,
			"name":            t.Name,
			"displayName":     t.DisplayName,
			"colorR":          t.ColorR,
			"colorG":          t.ColorG,
			"colorB":          t.ColorB,
			"etaMinutesMin":   t.EtaMinutesMin,
			"etaMinutesMax":   t.EtaMinutesMax,
			"maxPointsPerMin": t.MaxPointsPerMin,
			"agiRewardMin":    t.AgiRewardMin,
			"agiRewardMax":    t.AgiRewardMax,
			"modelFilename":   t.ModelFilename,
			"sortOrder":       t.SortOrder,
			"synapseCount":    count,
			"totalAgi":        totalAgi,
			"createdAt":       t.CreatedAt,
			"updatedAt":       t.UpdatedAt,
		}
	}

	return c.JSON(fiber.Map{"synapseTypes": result})
}

// GetSynapseTypeDetail returns a single synapse type by ID
func GetSynapseTypeDetail(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	id := c.Params("id")

	t, err := store.Queries.GetSynapseType(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Synapse type not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get synapse type"})
	}

	count, _ := store.Queries.CountSpacesBySynapseType(ctx, t.Name)
	totalAgi, _ := store.Queries.SumAGIBySynapseType(ctx, t.Name)

	return c.JSON(fiber.Map{
		"id":              t.ID,
		"name":            t.Name,
		"displayName":     t.DisplayName,
		"colorR":          t.ColorR,
		"colorG":          t.ColorG,
		"colorB":          t.ColorB,
		"etaMinutesMin":   t.EtaMinutesMin,
		"etaMinutesMax":   t.EtaMinutesMax,
		"maxPointsPerMin": t.MaxPointsPerMin,
		"agiRewardMin":    t.AgiRewardMin,
		"agiRewardMax":    t.AgiRewardMax,
		"modelFilename":   t.ModelFilename,
		"sortOrder":       t.SortOrder,
		"synapseCount":    count,
		"totalAgi":        totalAgi,
		"createdAt":       t.CreatedAt,
		"updatedAt":       t.UpdatedAt,
	})
}

// CreateSynapseType creates a new synapse type
func CreateSynapseType(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	var req struct {
		Name            string  `json:"name"`
		DisplayName     string  `json:"displayName"`
		ColorR          float32 `json:"colorR"`
		ColorG          float32 `json:"colorG"`
		ColorB          float32 `json:"colorB"`
		EtaMinutesMin   int     `json:"etaMinutesMin"`
		EtaMinutesMax   int     `json:"etaMinutesMax"`
		MaxPointsPerMin int     `json:"maxPointsPerMin"`
		AGIRewardMin    int     `json:"agiRewardMin"`
		AGIRewardMax    int     `json:"agiRewardMax"`
		ModelFilename   *string `json:"modelFilename"`
		SortOrder       int     `json:"sortOrder"`
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
	if req.EtaMinutesMin <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "ETA min must be positive"})
	}
	if req.EtaMinutesMax < req.EtaMinutesMin {
		return c.Status(400).JSON(fiber.Map{"error": "ETA max must be >= ETA min"})
	}
	if req.MaxPointsPerMin <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Max points/min must be positive"})
	}
	if req.AGIRewardMin < 0 || req.AGIRewardMax < req.AGIRewardMin {
		return c.Status(400).JSON(fiber.Map{"error": "AGI reward range is invalid"})
	}

	// Check name uniqueness
	_, err := store.Queries.GetSynapseTypeByName(ctx, req.Name)
	if err == nil {
		return c.Status(409).JSON(fiber.Map{"error": "Synapse type name already exists"})
	}

	now := time.Now().UnixMilli()
	t, err := store.Queries.CreateSynapseType(ctx, generated.CreateSynapseTypeParams{
		ID:              uuid.New().String(),
		Name:            req.Name,
		DisplayName:     req.DisplayName,
		ColorR:          req.ColorR,
		ColorG:          req.ColorG,
		ColorB:          req.ColorB,
		EtaMinutesMin:   int32(req.EtaMinutesMin),
		EtaMinutesMax:   int32(req.EtaMinutesMax),
		MaxPointsPerMin: int32(req.MaxPointsPerMin),
		AgiRewardMin:    int32(req.AGIRewardMin),
		AgiRewardMax:    int32(req.AGIRewardMax),
		ModelFilename:   req.ModelFilename,
		SortOrder:       int32(req.SortOrder),
		CreatedAt:       now,
		UpdatedAt:       now,
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create synapse type"})
	}

	return c.JSON(fiber.Map{"success": true, "id": t.ID})
}

// UpdateSynapseType updates an existing synapse type (merge-and-update pattern)
func UpdateSynapseType(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	id := c.Params("id")

	var req struct {
		Name            *string  `json:"name"`
		DisplayName     *string  `json:"displayName"`
		ColorR          *float32 `json:"colorR"`
		ColorG          *float32 `json:"colorG"`
		ColorB          *float32 `json:"colorB"`
		EtaMinutesMin   *int     `json:"etaMinutesMin"`
		EtaMinutesMax   *int     `json:"etaMinutesMax"`
		MaxPointsPerMin *int     `json:"maxPointsPerMin"`
		AGIRewardMin    *int     `json:"agiRewardMin"`
		AGIRewardMax    *int     `json:"agiRewardMax"`
		ModelFilename   *string  `json:"modelFilename"`
		SortOrder       *int     `json:"sortOrder"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	existing, err := store.Queries.GetSynapseType(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Synapse type not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get synapse type"})
	}

	params := generated.UpdateSynapseTypeParams{
		ID:              existing.ID,
		Name:            existing.Name,
		DisplayName:     existing.DisplayName,
		ColorR:          existing.ColorR,
		ColorG:          existing.ColorG,
		ColorB:          existing.ColorB,
		EtaMinutesMin:   existing.EtaMinutesMin,
		EtaMinutesMax:   existing.EtaMinutesMax,
		MaxPointsPerMin: existing.MaxPointsPerMin,
		AgiRewardMin:    existing.AgiRewardMin,
		AgiRewardMax:    existing.AgiRewardMax,
		ModelFilename:   existing.ModelFilename,
		SortOrder:       existing.SortOrder,
		UpdatedAt:       time.Now().UnixMilli(),
	}

	if req.Name != nil {
		// Check uniqueness if name is changing
		if *req.Name != existing.Name {
			_, err := store.Queries.GetSynapseTypeByName(ctx, *req.Name)
			if err == nil {
				return c.Status(409).JSON(fiber.Map{"error": "Synapse type name already exists"})
			}
		}
		params.Name = *req.Name
	}
	if req.DisplayName != nil {
		params.DisplayName = *req.DisplayName
	}
	if req.ColorR != nil {
		params.ColorR = *req.ColorR
	}
	if req.ColorG != nil {
		params.ColorG = *req.ColorG
	}
	if req.ColorB != nil {
		params.ColorB = *req.ColorB
	}
	if req.EtaMinutesMin != nil {
		params.EtaMinutesMin = int32(*req.EtaMinutesMin)
	}
	if req.EtaMinutesMax != nil {
		params.EtaMinutesMax = int32(*req.EtaMinutesMax)
	}
	if req.MaxPointsPerMin != nil {
		params.MaxPointsPerMin = int32(*req.MaxPointsPerMin)
	}
	if req.AGIRewardMin != nil {
		params.AgiRewardMin = int32(*req.AGIRewardMin)
	}
	if req.AGIRewardMax != nil {
		params.AgiRewardMax = int32(*req.AGIRewardMax)
	}
	if req.ModelFilename != nil {
		params.ModelFilename = req.ModelFilename
	}
	if req.SortOrder != nil {
		params.SortOrder = int32(*req.SortOrder)
	}

	if err := store.Queries.UpdateSynapseType(ctx, params); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update synapse type"})
	}

	return c.JSON(fiber.Map{"success": true})
}

// DeleteSynapseType deletes a synapse type (refused if synapses exist)
func DeleteSynapseType(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	id := c.Params("id")

	t, err := store.Queries.GetSynapseType(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Synapse type not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to check synapse type"})
	}

	count, _ := store.Queries.CountSpacesBySynapseType(ctx, t.Name)
	if count > 0 {
		return c.Status(409).JSON(fiber.Map{
			"error": fmt.Sprintf("Cannot delete: %d synapses of this type exist. Delete synapses first.", count),
		})
	}

	if err := store.Queries.DeleteSynapseType(ctx, id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete synapse type"})
	}

	return c.JSON(fiber.Map{"success": true})
}

// UploadSynapseTypeModel handles GLB model file upload for a synapse type
func UploadSynapseTypeModel(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	id := c.Params("id")

	t, err := store.Queries.GetSynapseType(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Synapse type not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get synapse type"})
	}

	file, err := c.FormFile("model")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "No model file provided"})
	}

	// Validate file size (5MB max)
	if file.Size > 5*1024*1024 {
		return c.Status(400).JSON(fiber.Map{"error": "File too large (max 5MB)"})
	}

	// Validate extension
	ext := filepath.Ext(file.Filename)
	if ext != ".glb" {
		return c.Status(400).JSON(fiber.Map{"error": "Only .glb files are accepted"})
	}

	// Ensure directory exists
	modelsDir := "public/models/synapses"
	if err := os.MkdirAll(modelsDir, 0755); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create models directory"})
	}

	// Save file
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

	// Update DB record
	if err := store.Queries.UpdateSynapseType(ctx, generated.UpdateSynapseTypeParams{
		ID:              t.ID,
		Name:            t.Name,
		DisplayName:     t.DisplayName,
		ColorR:          t.ColorR,
		ColorG:          t.ColorG,
		ColorB:          t.ColorB,
		EtaMinutesMin:   t.EtaMinutesMin,
		EtaMinutesMax:   t.EtaMinutesMax,
		MaxPointsPerMin: t.MaxPointsPerMin,
		AgiRewardMin:    t.AgiRewardMin,
		AgiRewardMax:    t.AgiRewardMax,
		ModelFilename:   &filename,
		SortOrder:       t.SortOrder,
		UpdatedAt:       time.Now().UnixMilli(),
	}); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update model filename"})
	}

	return c.JSON(fiber.Map{"success": true, "filename": filename})
}
