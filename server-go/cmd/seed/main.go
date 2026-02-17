package main

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"os"

	"teneo/server-go/internal/brainshape"
	_ "teneo/server-go/internal/config" // load .env

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
	{"minor", 0.60, synapseConfig{etaMin: 10, etaMax: 30, maxPerMin: 100, agiMin: 3, agiMax: 10}},
	{"complex", 0.25, synapseConfig{etaMin: 60, etaMax: 180, maxPerMin: 500, agiMin: 50, agiMax: 200}},
	{"deep", 0.10, synapseConfig{etaMin: 360, etaMax: 1440, maxPerMin: 2000, agiMin: 500, agiMax: 4000}},
	{"core", 0.04, synapseConfig{etaMin: 60, etaMax: 120, maxPerMin: 300, agiMin: 25, agiMax: 100}},
	{"rare", 0.01, synapseConfig{etaMin: 120, etaMax: 360, maxPerMin: 1000, agiMin: 100, agiMax: 500}},
}

type synapseConfig struct {
	etaMin    int
	etaMax    int
	maxPerMin int
	agiMin    int
	agiMax    int
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
	return synapseConfig{etaMin: 10, etaMax: 30, maxPerMin: 100, agiMin: 3, agiMax: 10}
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

			// Randomize ETA and derive points_required
			etaMinutes := cfg.etaMin
			if cfg.etaMax > cfg.etaMin {
				etaMinutes = cfg.etaMin + rand.Intn(cfg.etaMax-cfg.etaMin+1)
			}
			pointsRequired := etaMinutes * cfg.maxPerMin

			// Randomize AGI reward
			agiReward := cfg.agiMin
			if cfg.agiMax > cfg.agiMin {
				agiReward = cfg.agiMin + rand.Intn(cfg.agiMax-cfg.agiMin+1)
			}

			rows = append(rows, []interface{}{
				uuid.New().String(),      // id
				posX,                     // position_x
				posY,                     // position_y
				posZ,                     // position_z
				region,                   // region
				brainshape.GetZone(posY), // zone
				1,                        // synapse_count
				"undiscovered",           // state
				synapseType,              // synapse_type
				pointsRequired,           // points_required
				0,                        // points_accumulated
				agiReward,                // agi_reward
				pointsRequired / 20,      // brain_xp_reward
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
