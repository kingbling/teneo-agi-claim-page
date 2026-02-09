package db

import (
	"log"
	"math"
	"math/rand"
	"time"

	"teneo/server-go/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Brain shape scaling factors (must match frontend BRAIN_SCALE)
const (
	BRAIN_SCALE_X = 1.3
	BRAIN_SCALE_Y = 1.0
	BRAIN_SCALE_Z = 1.1
)

// Brain regions for labeling (not for clustering)
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

// constrainToBrainShape applies brain shape deformations to ensure positions follow the brain's structure
// This matches the frontend constrainToBrainShape function in brainConstants.ts
func constrainToBrainShape(rawX, rawY, rawZ float64) (float64, float64, float64) {
	x, y, z := rawX, rawY, rawZ

	// Calculate distance from origin
	r := math.Sqrt(x*x + y*y + z*z)

	// If outside unit sphere, normalize to surface first
	if r > 1.0 {
		x /= r
		y /= r
		z /= r
		r = 1.0
	}

	// Get direction for shape calculation (unit sphere position)
	var dirX, dirY, dirZ float64
	if r > 0.001 {
		dirX = x / r
		dirY = y / r
		dirZ = z / r
	}

	// Apply brain shape deformations (matching frontend SynapseParticlesMinimal)
	// Central groove (longitudinal fissure)
	grooveDepth := math.Exp(-math.Abs(dirX)*6) * 0.15
	grooveFactor := 1.0 - grooveDepth*math.Max(0, dirY)

	// Regional bulges that define the brain's distinctive shape
	frontalBulge := math.Max(0, dirZ*0.5+0.5) * math.Max(0, dirY*0.5+0.3) * 0.2
	temporalBulge := math.Max(0, math.Abs(dirX)-0.3) * math.Max(0, -dirY*0.5+0.3) * math.Max(0, dirZ*0.5+0.5) * 0.25
	occipitalBulge := math.Max(0, -dirZ*0.5+0.3) * math.Max(0, dirY*0.3+0.3) * 0.15
	cerebellumBulge := math.Max(0, -dirZ*0.5+0.2) * math.Max(0, -dirY*0.5+0.2) * (1 - math.Abs(dirX)*0.8) * 0.2
	bottomFlatten := math.Max(0, -dirY-0.5) * 0.15

	// Combined shape modifier
	shapeMod := grooveFactor + frontalBulge + temporalBulge + occipitalBulge + cerebellumBulge - bottomFlatten

	// Apply shape and keep INSIDE the volume
	// Use 0.92 as max to keep synapses slightly inside the brain surface
	maxR := 0.92
	finalR := math.Min(r, maxR) * shapeMod

	// Apply final scaling with BRAIN_SCALE
	return dirX * finalR * BRAIN_SCALE_X,
		dirY * finalR * BRAIN_SCALE_Y,
		dirZ * finalR * BRAIN_SCALE_Z
}

// generateUniformSpherePoint generates a random point uniformly distributed in a sphere
func generateUniformSpherePoint() (float64, float64, float64) {
	// Use rejection sampling to get uniform distribution in sphere
	for {
		x := rand.Float64()*2 - 1
		y := rand.Float64()*2 - 1
		z := rand.Float64()*2 - 1
		if x*x+y*y+z*z <= 1.0 {
			return x, y, z
		}
	}
}

// findClosestRegion determines which brain region a position belongs to
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

// SeedSynapses generates initial synapse data for the brain
// Uses uniform sphere distribution with brain shape constraints
func SeedSynapses(database *gorm.DB) error {
	const targetSynapseCount = 500000 // 500k synapses target

	log.Println("[SEED] Checking if synapses need to be generated...")

	// Check if we already have enough synapses
	var count int64
	database.Model(&models.Space{}).Count(&count)
	if count >= targetSynapseCount {
		log.Printf("[SEED] Database already has %d synapses, skipping seed", count)
		return nil
	}

	// Seed random number generator
	rand.Seed(time.Now().UnixNano())

	synapsesToCreate := targetSynapseCount - count
	log.Printf("[SEED] Generating %d synapses uniformly distributed throughout brain volume (current: %d, target: %d)...", synapsesToCreate, count, targetSynapseCount)

	// Generate synapses uniformly distributed in brain volume
	batchSize := 1000
	totalGenerated := 0

	for batchStart := 0; batchStart < int(synapsesToCreate); batchStart += batchSize {
		batchEnd := batchStart + batchSize
		if batchEnd > int(synapsesToCreate) {
			batchEnd = int(synapsesToCreate)
		}

		spaces := make([]models.Space, 0, batchEnd-batchStart)

		for i := batchStart; i < batchEnd; i++ {
			// Generate uniform random point in sphere
			rawX, rawY, rawZ := generateUniformSpherePoint()

			// Apply brain shape constraints (matching frontend)
			posX, posY, posZ := constrainToBrainShape(rawX, rawY, rawZ)

			// Determine which brain region this position belongs to
			region := findClosestRegion(posX, posY, posZ)

			// Select synapse type based on weights
			synapseType := selectSynapseType()
			config := getSynapseConfig(synapseType)

			space := models.Space{
				ID:                uuid.New().String(),
				PositionX:         posX,
				PositionY:         posY,
				PositionZ:         posZ,
				Region:            region,
				Zone:              getZone(posY),
				SynapseCount:      1,
				State:             "undiscovered",
				SynapseType:       synapseType,
				PointsRequired:    config.points,
				PointsAccumulated: 0,
				AgiReward:         config.agi,
				BrainXpReward:     config.points / 20,
			}

			spaces = append(spaces, space)
			totalGenerated++
		}

		// Batch insert
		if err := database.Create(&spaces).Error; err != nil {
			log.Printf("[SEED] Error inserting batch: %v", err)
			// Continue on error
		}

		if totalGenerated%50000 == 0 {
			log.Printf("[SEED] Progress: %d/%d synapses generated", totalGenerated, synapsesToCreate)
		}
	}

	log.Printf("[SEED] Generated %d synapses uniformly distributed throughout brain volume", totalGenerated)
	return nil
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

// SeedSimulationState initializes the simulation state
func SeedSimulationState(database *gorm.DB) error {
	log.Println("[SEED] Initializing simulation state...")

	var state models.SimulationState
	result := database.First(&state)

	if result.Error != nil {
		// Create initial state
		state = models.SimulationState{
			ID:         1,
			TickCount:  0,
			LastTickAt: 0,
			IsRunning:  true,
		}
		if err := database.Create(&state).Error; err != nil {
			return err
		}
		log.Println("[SEED] Simulation state initialized")
	}

	return nil
}

// SeedAll runs all seed functions
func SeedAll(database *gorm.DB) error {
	if err := SeedSimulationState(database); err != nil {
		return err
	}
	if err := SeedSynapses(database); err != nil {
		return err
	}
	return nil
}
