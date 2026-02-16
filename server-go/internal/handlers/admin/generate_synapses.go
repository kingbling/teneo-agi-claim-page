package admin

import (
	"errors"
	"log"
	"math/rand"

	"teneo/server-go/internal/brainshape"
	"teneo/server-go/internal/database"
	"teneo/server-go/internal/database/generated"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	pgxraw "github.com/jackc/pgx/v5"
)

// GenerateSynapses bulk-generates synapses of a given type
func GenerateSynapses(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()
	id := c.Params("id")

	var req struct {
		Count int `json:"count"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Count < 1 || req.Count > 100000 {
		return c.Status(400).JSON(fiber.Map{"error": "Count must be between 1 and 100,000"})
	}

	// Get synapse type
	st, err := store.Queries.GetSynapseType(ctx, id)
	if err != nil {
		if errors.Is(err, pgxraw.ErrNoRows) {
			return c.Status(404).JSON(fiber.Map{"error": "Synapse type not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get synapse type"})
	}

	log.Printf("[Admin] Generating %d %s synapses...", req.Count, st.Name)

	// Generate in batches of 50k for COPY efficiency
	const batchSize = 50000
	totalGenerated := 0

	for totalGenerated < req.Count {
		thisBatch := batchSize
		if totalGenerated+thisBatch > req.Count {
			thisBatch = req.Count - totalGenerated
		}

		rows := make([][]interface{}, 0, thisBatch)
		for i := 0; i < thisBatch; i++ {
			rawX, rawY, rawZ := brainshape.GenerateUniformSpherePoint()
			posX, posY, posZ := brainshape.ConstrainToBrainShape(rawX, rawY, rawZ)
			region := brainshape.FindClosestRegion(posX, posY, posZ)
			zone := brainshape.GetZone(posY)

			// Randomize AGI reward between min and max
			agiReward := int(st.AgiRewardMin)
			if st.AgiRewardMax > st.AgiRewardMin {
				agiReward = int(st.AgiRewardMin) + rand.Intn(int(st.AgiRewardMax-st.AgiRewardMin)+1)
			}

			rows = append(rows, []interface{}{
				uuid.New().String(),    // id
				posX,                   // position_x
				posY,                   // position_y
				posZ,                   // position_z
				region,                 // region
				zone,                   // zone
				1,                      // synapse_count
				"undiscovered",         // state
				st.Name,                // synapse_type
				int(st.PointsRequired), // points_required
				0,                      // points_accumulated
				agiReward,              // agi_reward
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

	log.Printf("[Admin] Generated %d %s synapses", totalGenerated, st.Name)

	// Get new count for the type
	count, _ := store.Queries.CountSpacesBySynapseType(ctx, st.Name)

	return c.JSON(fiber.Map{
		"success":       true,
		"generated":     totalGenerated,
		"totalForType":  count,
	})
}

// WipeSynapses deletes all synapses and related data (clean slate)
func WipeSynapses(c *fiber.Ctx) error {
	store := c.Locals("store").(*database.Store)
	ctx := c.Context()

	log.Println("[Admin] Wiping all synapses...")

	err := store.WithTx(ctx, func(q *generated.Queries) error {
		if _, err := store.Pool.Exec(ctx, "DELETE FROM synapse_explorers"); err != nil {
			return err
		}
		if _, err := store.Pool.Exec(ctx, "DELETE FROM agent_clusters"); err != nil {
			return err
		}
		if _, err := store.Pool.Exec(ctx, "DELETE FROM space_clusters"); err != nil {
			return err
		}
		if _, err := store.Pool.Exec(ctx, "DELETE FROM spaces"); err != nil {
			return err
		}
		// Reset agents to idle
		if _, err := store.Pool.Exec(ctx, "UPDATE agents SET state = 'idle', target_space_id = NULL, current_space_id = NULL"); err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		log.Printf("[Admin] Wipe failed: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to wipe synapses"})
	}

	log.Println("[Admin] Wipe complete")
	return c.JSON(fiber.Map{"success": true})
}
