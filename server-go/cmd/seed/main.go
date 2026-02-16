package main

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"os"

	"teneo/server-go/internal/brainshape"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Synapse types distribution
var synapseTypes = []struct {
	typ    string
	weight float64
	config synapseConfig
}{
	{"minor", 0.60, synapseConfig{points: 3000, agi: 5, eta: 3}},
	{"complex", 0.25, synapseConfig{points: 6000, agi: 10, eta: 6}},
	{"deep", 0.10, synapseConfig{points: 12000, agi: 25, eta: 12}},
	{"core", 0.04, synapseConfig{points: 25000, agi: 50, eta: 25}},
	{"rare", 0.01, synapseConfig{points: 50000, agi: 100, eta: 50}},
}

type synapseConfig struct {
	points int
	agi    int
	eta    int
}

func selectSynapseType() string {
	r := rand.Float64()
	accum := 0.0
	for _, st := range synapseTypes {
		accum += st.weight
		if r < accum {
			return st.typ
		}
	}
	return "minor"
}

func getSynapseConfig(typ string) synapseConfig {
	for _, st := range synapseTypes {
		if st.typ == typ {
			return st.config
		}
	}
	return synapseConfig{points: 3000, agi: 5, eta: 3}
}

func main() {
	const targetCount = 500000

	ctx := context.Background()
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://teneo:teneo@localhost:5432/teneo?sslmode=disable"
	}

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}
	defer pool.Close()

	// Check current count
	var count int64
	if err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM spaces").Scan(&count); err != nil {
		log.Fatalf("Failed to count spaces: %v", err)
	}

	if count >= targetCount {
		log.Printf("[SEED] Database already has %d synapses, skipping seed", count)
		return
	}

	synapsesToCreate := targetCount - count
	log.Printf("[SEED] Generating %d synapses (current: %d, target: %d)...", synapsesToCreate, count, targetCount)

	// Generate all rows and use COPY protocol for bulk insert
	const batchSize = 50000
	totalGenerated := int64(0)

	for totalGenerated < synapsesToCreate {
		thisBatch := int64(batchSize)
		if totalGenerated+thisBatch > synapsesToCreate {
			thisBatch = synapsesToCreate - totalGenerated
		}

		rows := make([][]interface{}, 0, thisBatch)
		for i := int64(0); i < thisBatch; i++ {
			rawX, rawY, rawZ := brainshape.GenerateUniformSpherePoint()
			posX, posY, posZ := brainshape.ConstrainToBrainShape(rawX, rawY, rawZ)
			region := brainshape.FindClosestRegion(posX, posY, posZ)
			synapseType := selectSynapseType()
			cfg := getSynapseConfig(synapseType)

			rows = append(rows, []interface{}{
				uuid.New().String(), // id
				posX,               // position_x
				posY,               // position_y
				posZ,               // position_z
				region,             // region
				brainshape.GetZone(posY), // zone
				1,                  // synapse_count
				"undiscovered",     // state
				synapseType,        // synapse_type
				cfg.points,         // points_required
				0,                  // points_accumulated
				cfg.agi,            // agi_reward
				cfg.points / 20,    // brain_xp_reward
			})
		}

		copyCount, err := pool.CopyFrom(
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
			log.Fatalf("[SEED] COPY failed: %v", err)
		}

		totalGenerated += int64(copyCount)
		log.Printf("[SEED] Progress: %d/%d synapses", totalGenerated, synapsesToCreate)
	}

	fmt.Printf("[SEED] Done. Generated %d synapses.\n", totalGenerated)
}
