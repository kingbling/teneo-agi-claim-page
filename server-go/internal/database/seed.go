package database

import (
	"context"
	"fmt"
	"log"
	"math"
	"math/rand"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	seedTargetCount = 500000
	brainScaleX     = 1.3
	brainScaleY     = 1.0
	brainScaleZ     = 1.1
)

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

var synapseTypes = []struct {
	typ    string
	weight float64
	points int
	agi    int
	eta    int
}{
	{"minor", 0.60, 3000, 5, 3},
	{"complex", 0.25, 6000, 10, 6},
	{"deep", 0.10, 12000, 25, 12},
	{"core", 0.04, 25000, 50, 25},
	{"rare", 0.01, 50000, 100, 50},
}

// seedSpaces checks if the spaces table needs seeding and inserts 500k synapses if so.
func seedSpaces(ctx context.Context, pool *pgxpool.Pool) error {
	var count int64
	if err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM spaces").Scan(&count); err != nil {
		return fmt.Errorf("count spaces: %w", err)
	}

	if count >= seedTargetCount {
		log.Printf("[SEED] Already has %d synapses, skipping", count)
		return nil
	}

	toCreate := int64(seedTargetCount) - count
	log.Printf("[SEED] Generating %d synapses (current: %d)...", toCreate, count)

	const batchSize = 50000
	var totalGenerated int64

	for totalGenerated < toCreate {
		thisBatch := int64(batchSize)
		if totalGenerated+thisBatch > toCreate {
			thisBatch = toCreate - totalGenerated
		}

		rows := make([][]interface{}, 0, thisBatch)
		for i := int64(0); i < thisBatch; i++ {
			rawX, rawY, rawZ := uniformSpherePoint()
			posX, posY, posZ := constrainToBrainShape(rawX, rawY, rawZ)
			region := closestRegion(posX, posY, posZ)
			st := pickSynapseType()

			rows = append(rows, []interface{}{
				uuid.New().String(),
				posX, posY, posZ,
				region, zoneFromY(posY),
				1, "undiscovered", st.typ,
				st.points, 0, st.agi, st.points / 20,
			})
		}

		copyCount, err := pool.CopyFrom(ctx,
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
			return fmt.Errorf("COPY failed: %w", err)
		}

		totalGenerated += int64(copyCount)
		log.Printf("[SEED] Progress: %d/%d", totalGenerated, toCreate)
	}

	log.Printf("[SEED] Done. Generated %d synapses.", totalGenerated)
	return nil
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
	maxR := 0.92
	finalR := math.Min(r, maxR) * shapeMod
	return dirX * finalR * brainScaleX,
		dirY * finalR * brainScaleY,
		dirZ * finalR * brainScaleZ
}

func uniformSpherePoint() (float64, float64, float64) {
	for {
		x := rand.Float64()*2 - 1
		y := rand.Float64()*2 - 1
		z := rand.Float64()*2 - 1
		if x*x+y*y+z*z <= 1.0 {
			return x, y, z
		}
	}
}

func closestRegion(x, y, z float64) string {
	minDist := math.MaxFloat64
	closest := "unknown"
	for _, r := range brainRegions {
		dx := x - r.center[0]
		dy := y - r.center[1]
		dz := z - r.center[2]
		dist := math.Sqrt(dx*dx + dy*dy + dz*dz)
		if dist < minDist && dist < r.radius {
			minDist = dist
			closest = r.name
		}
	}
	return closest
}

func pickSynapseType() struct {
	typ    string
	points int
	agi    int
} {
	r := rand.Float64()
	accum := 0.0
	for _, st := range synapseTypes {
		accum += st.weight
		if r < accum {
			return struct {
				typ    string
				points int
				agi    int
			}{st.typ, st.points, st.agi}
		}
	}
	return struct {
		typ    string
		points int
		agi    int
	}{"minor", 3000, 5}
}

func zoneFromY(y float64) string {
	if y > 0.3 {
		return "frontal"
	} else if y > 0 {
		return "parietal"
	} else if y > -0.3 {
		return "temporal"
	}
	return "occipital"
}
