package main

import (
	"context"
	"fmt"
	"log"
	"math"
	"math/rand"
	"os"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Brain shape scaling factors (must match frontend BRAIN_SCALE)
const (
	BRAIN_SCALE_X = 1.35 * 1.2 // Must match SynapseParticlesMinimal scaling
	BRAIN_SCALE_Y = 1.0 * 1.2
	BRAIN_SCALE_Z = 1.15 * 1.2
)

// Brain regions for labeling
var brainRegions = []struct {
	name   string
	center [3]float64
	radius float64
}{
	{"prefrontal_cortex", [3]float64{-0.6, 0.5, 0.2}, 0.4},
	{"motor_cortex", [3]float64{-0.4, 0.7, 0.0}, 0.3},
	{"somatosensory_cortex", [3]float64{-0.5, 0.4, -0.3}, 0.3},
	{"auditory_cortex", [3]float64{0.6, -0.2, 0.2}, 0.3},
	{"visual_cortex", [3]float64{0.4, -0.6, -0.1}, 0.4},
	{"hippocampus", [3]float64{0.5, -0.3, 0.1}, 0.25},
	{"thalamus", [3]float64{0.0, 0.0, 0.0}, 0.2},
	{"cerebellum", [3]float64{0.0, -0.8, -0.4}, 0.35},
	{"temporal_lobe", [3]float64{0.7, -0.1, 0.3}, 0.3},
	{"parietal_lobe", [3]float64{-0.6, 0.3, -0.2}, 0.3},
}

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

func constrainToBrainShape(rawX, rawY, rawZ float64) (float64, float64, float64) {
	x, y, z := rawX, rawY, rawZ
	r := math.Sqrt(x*x + y*y + z*z)
	if r > 1.0 {
		x /= r
		y /= r
		z /= r
		r = 1.0
	}
	var dirX, dirY, dirZ float64
	if r > 0.001 {
		dirX = x / r
		dirY = y / r
		dirZ = z / r
	}
	grooveDepth := math.Exp(-math.Abs(dirX)*6) * 0.15
	grooveFactor := 1.0 - grooveDepth*math.Max(0, dirY)
	frontalBulge := math.Max(0, dirZ*0.5+0.5) * math.Max(0, dirY*0.5+0.3) * 0.2
	temporalBulge := math.Max(0, math.Abs(dirX)-0.3) * math.Max(0, -dirY*0.5+0.3) * math.Max(0, dirZ*0.5+0.5) * 0.25
	occipitalBulge := math.Max(0, -dirZ*0.5+0.3) * math.Max(0, dirY*0.3+0.3) * 0.15
	cerebellumBulge := math.Max(0, -dirZ*0.5+0.2) * math.Max(0, -dirY*0.5+0.2) * (1 - math.Abs(dirX)*0.8) * 0.2
	bottomFlatten := math.Max(0, -dirY-0.5) * 0.15
	shapeMod := grooveFactor + frontalBulge + temporalBulge + occipitalBulge + cerebellumBulge - bottomFlatten
	finalR := r * shapeMod
	return dirX * finalR * BRAIN_SCALE_X,
		dirY * finalR * BRAIN_SCALE_Y,
		dirZ * finalR * BRAIN_SCALE_Z
}

func generateUniformSpherePoint() (float64, float64, float64) {
	for {
		x := rand.Float64()*2 - 1
		y := rand.Float64()*2 - 1
		z := rand.Float64()*2 - 1
		if x*x+y*y+z*z <= 1.0 {
			return x, y, z
		}
	}
}

func findClosestRegion(x, y, z float64) string {
	minDist := math.MaxFloat64
	closestRegion := "unknown"
	for _, region := range brainRegions {
		dx := x - region.center[0]
		dy := y - region.center[1]
		dz := z - region.center[2]
		dist := math.Sqrt(dx*dx + dy*dy + dz*dz)
		if dist < minDist && dist < region.radius {
			minDist = dist
			closestRegion = region.name
		}
	}
	return closestRegion
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

func getZone(y float64) string {
	if y > 0.3 {
		return "frontal"
	} else if y > 0 {
		return "parietal"
	} else if y > -0.3 {
		return "temporal"
	}
	return "occipital"
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
			rawX, rawY, rawZ := generateUniformSpherePoint()
			posX, posY, posZ := constrainToBrainShape(rawX, rawY, rawZ)
			region := findClosestRegion(posX, posY, posZ)
			synapseType := selectSynapseType()
			cfg := getSynapseConfig(synapseType)

			rows = append(rows, []interface{}{
				uuid.New().String(), // id
				posX,               // position_x
				posY,               // position_y
				posZ,               // position_z
				region,             // region
				getZone(posY),      // zone
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
