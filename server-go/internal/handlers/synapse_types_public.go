package handlers

import (
	"context"

	"teneo/server-go/internal/database"
	"teneo/server-go/internal/dto"

	"github.com/gofiber/fiber/v2"
)

// ListPublicSynapseTypes returns all synapse types for the frontend (public, no auth required)
func ListPublicSynapseTypes(c *fiber.Ctx, store *database.Store) error {
	ctx := context.Background()

	types, err := store.Queries.ListSynapseTypes(ctx)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to list synapse types"})
	}

	result := make([]dto.SynapseTypeDTO, len(types))
	for i, t := range types {
		var modelFilename *string
		if t.ModelFilename != nil {
			modelFilename = t.ModelFilename
		}
		result[i] = dto.SynapseTypeDTO{
			ID:             t.ID,
			Name:           t.Name,
			DisplayName:    t.DisplayName,
			ColorR:         t.ColorR,
			ColorG:         t.ColorG,
			ColorB:         t.ColorB,
			PointsRequired: int(t.PointsRequired),
			AGIRewardMin:   int(t.AgiRewardMin),
			AGIRewardMax:   int(t.AgiRewardMax),
			ModelFilename:  modelFilename,
			SortOrder:      int(t.SortOrder),
		}
	}

	return c.JSON(fiber.Map{"synapseTypes": result})
}
