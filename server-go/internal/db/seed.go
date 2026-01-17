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

// Brain regions with relative weights for synapse distribution
// Coordinates are normalized to match frontend BRAIN_SCALE (~-1 to +1 range)
var brainRegions = []struct {
	name      string
	positionX float64
	positionY float64
	positionZ float64
	weight    float64 // Relative weight for synapse distribution
}{
	// Frontal lobe regions (largest, high weight)
	{"prefrontal_cortex", -0.6, 0.5, 0, 1.0},
	{"motor_cortex", -0.4, 0.7, 0.2, 0.8},
	{"broca_area", -0.7, 0.6, 0.3, 0.6},

	// Parietal lobe
	{"somatosensory_cortex", -0.5, 0.4, -0.3, 0.7},
	{"superior_parietal", -0.6, 0.3, -0.2, 0.5},

	// Temporal lobe
	{"auditory_cortex", 0.6, -0.2, 0.2, 0.7},
	{"wernicke_area", 0.7, -0.1, 0.3, 0.5},
	{"hippocampus", 0.5, -0.3, 0.1, 0.6},

	// Occipital lobe (visual processing)
	{"primary_visual", 0.4, -0.6, -0.1, 0.8},
	{"visual_association", 0.5, -0.5, -0.2, 0.6},

	// Subcortical structures
	{"thalamus", 0, 0, 0, 0.9},
	{"hypothalamus", 0, -0.2, 0.1, 0.4},
	{"amygdala", 0.3, -0.2, 0.2, 0.5},
	{"basal_ganglia", 0.2, 0.1, 0, 0.7},

	// Cerebellum and brainstem
	{"cerebellum", 0, -0.8, -0.4, 0.8},
	{"brainstem", 0, -0.4, -0.6, 0.6},
	{"pons", 0, -0.5, -0.5, 0.4},
	{"medulla", 0, -0.6, -0.7, 0.3},

	// Limbic system
	{"cingulate_gyrus", -0.1, 0.2, 0.1, 0.5},
	{"fornix", 0.1, -0.1, 0, 0.3},
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

// SeedSynapses generates initial synapse data for the brain
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
	log.Printf("[SEED] Generating %d synapses (current: %d, target: %d)...", synapsesToCreate, count, targetSynapseCount)

	// Calculate total weight for distribution
	totalWeight := 0.0
	for _, region := range brainRegions {
		totalWeight += region.weight
	}

	// Calculate synapses per region
	regionAllocations := make([]int, len(brainRegions))
	for i, region := range brainRegions {
		alloc := int(float64(synapsesToCreate) * region.weight / totalWeight)
		regionAllocations[i] = alloc
	}

	// Generate synapses using Fibonacci sphere algorithm for even distribution
	batchSize := 1000
	totalGenerated := 0

	for regionIdx, region := range brainRegions {
		alloc := regionAllocations[regionIdx]
		if alloc <= 0 {
			continue
		}

		// Generate in batches
		for batchStart := 0; batchStart < alloc; batchStart += batchSize {
			batchEnd := batchStart + batchSize
			if batchEnd > alloc {
				batchEnd = alloc
			}

			spaces := make([]models.Space, 0, batchEnd-batchStart)

			for i := batchStart; i < batchEnd; i++ {
				// Fibonacci sphere distribution for even coverage
				// Modified to cluster around region center
				phi := math.Acos(1 - 2*float64(i)/float64(alloc))
				theta := math.Pi * (1 + math.Sqrt(5)) * float64(i)

				// Larger spread for better cluster distribution
				radius := 0.1 + rand.Float64()*0.3

				offsetX := radius * math.Sin(phi) * math.Cos(theta)
				offsetY := radius * math.Sin(phi) * math.Sin(theta)
				offsetZ := radius * math.Cos(phi)

				// Add more randomness for better spread
				offsetX += (rand.Float64() - 0.5) * 0.1
				offsetY += (rand.Float64() - 0.5) * 0.1
				offsetZ += (rand.Float64() - 0.5) * 0.1

				// Select synapse type based on weights
				synapseType := selectSynapseType()
				config := getSynapseConfig(synapseType)

				space := models.Space{
					ID:                uuid.New().String(),
					PositionX:         region.positionX + offsetX,
					PositionY:         region.positionY + offsetY,
					PositionZ:         region.positionZ + offsetZ,
					Region:            region.name,
					Zone:              getZone(region.positionY),
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
	}

	log.Printf("[SEED] Generated %d synapses across %d brain regions", totalGenerated, len(brainRegions))
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
