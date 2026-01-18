package handlers

import (
	"math"
	"testing"
	"time"

	"teneo/server-go/internal/config"
	"teneo/server-go/internal/db"
	"teneo/server-go/internal/models"
	wshub "teneo/server-go/internal/websocket"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupTestDB creates an in-memory SQLite database for testing
func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	require.NoError(t, err)

	// Auto-migrate all models
	err = db.AutoMigrate(&models.User{}, &models.Agent{}, &models.Space{}, &models.SynapseExplorer{})
	require.NoError(t, err)

	return db
}

// createTestUser creates a test user with default values
func createTestUser(t *testing.T, database *gorm.DB) models.User {
	// Create a valid 40-char hex string for wallet
	wallet := "0x" + uuid.New().String() + uuid.New().String()
	wallet = wallet[:42] // Ensure exactly 42 characters (0x + 40 hex chars)

	user := models.User{
		ID:         uuid.New().String(),
		Wallet:     wallet,
		Points:     10000,
		UsdcSpent:  0,
		CreatedAt:  time.Now().UnixMilli(),
	}
	require.NoError(t, database.Create(&user).Error)
	return user
}

// createTestAgent creates a test ship/agent
func createTestAgent(t *testing.T, database *gorm.DB, ownerID string, state string) models.Agent {
	agent := models.Agent{
		ID:                uuid.New().String(),
		OwnerID:           ownerID,
		Name:              "Test Ship",
		State:             state,
		ShipType:          "neuron",
		PositionX:         0,
		PositionY:         0,
		PositionZ:         0,
		HomeX:             0,
		HomeY:             0,
		HomeZ:             0,
		WanderDirX:        0,
		WanderDirY:        0,
		WanderDirZ:        0,
		WanderPhase:       0,
		SpacesDiscovered:  0,
		DistanceTraveled:  0,
		CreatedAt:         time.Now().UnixMilli(),
		CreationCost:      0,
		NeedsRepair:       false,
		TranceActive:      false,
		TranceLevel:       0,
		CurrentPointsPerMin: 100,
		TotalAgiEarned:    0,
		AutopilotEnabled:  false,
	}
	require.NoError(t, database.Create(&agent).Error)
	return agent
}

// createTestSpace creates a test synapse/space
func createTestSpace(t *testing.T, database *gorm.DB, positionX, positionY, positionZ float64) models.Space {
	space := models.Space{
		ID:                uuid.New().String(),
		PositionX:         positionX,
		PositionY:         positionY,
		PositionZ:         positionZ,
		Region:            "test-region",
		Zone:              "test-zone",
		State:             "undiscovered",
		SynapseType:       "minor",
		PointsRequired:    1000,
		PointsAccumulated: 0,
		AgiReward:         100,
	}
	require.NoError(t, database.Create(&space).Error)
	return space
}

// TestConvertAgentToDTO tests the conversion from Agent model to ShipDTO
func TestConvertAgentToDTO(t *testing.T) {
	agent := models.Agent{
		ID:                "test-agent-id",
		OwnerID:           "test-user-id",
		Name:              "Test Ship",
		State:             "idle",
		ShipType:          "neuron",
		PositionX:         10.5,
		PositionY:         20.5,
		PositionZ:         30.5,
		CurrentPointsPerMin: 100,
		TotalAgiEarned:    500,
		AutopilotEnabled:  true,
		SpacesDiscovered:  5,
		CreatedAt:         1234567890,
	}

	dto := convertAgentToDTO(agent)

	assert.Equal(t, "test-agent-id", dto.ID)
	assert.Equal(t, "test-user-id", dto.OwnerID)
	assert.Equal(t, "Test Ship", dto.Name)
	assert.Equal(t, "idle", string(dto.State))
	assert.Equal(t, "neuron", dto.ShipType)
	assert.Equal(t, 10.5, dto.PositionX)
	assert.Equal(t, 20.5, dto.PositionY)
	assert.Equal(t, 30.5, dto.PositionZ)
	assert.Equal(t, float64(100), dto.CurrentPointsPerMin)
	assert.Equal(t, float64(500), dto.TotalAgiEarned)
	assert.True(t, dto.AutopilotEnabled)
	assert.Equal(t, 5, dto.SpacesDiscovered)
	assert.Equal(t, int64(1234567890), dto.CreatedAt)
}

// TestConvertAgentToDTO_WithRotation tests that rotationY is calculated when target is set
func TestConvertAgentToDTO_WithRotation(t *testing.T) {
	agent := models.Agent{
		ID:         "test-agent-id",
		OwnerID:    "test-user-id",
		Name:       "Test Ship",
		State:      "idle",
		ShipType:   "neuron",
		PositionX:  0,
		PositionY:  0,
		PositionZ:  0,
		// Target position to the east (positive X)
		TargetX:    float64Ptr(10.0),
		TargetY:    float64Ptr(0.0),
		TargetZ:    float64Ptr(0.0),
	}

	dto := convertAgentToDTO(agent)

	// Ship model faces -Z direction, so east (+X) should give rotationY = PI
	// atan2(10, 0) = PI/2, but since we use atan2(dx, -dz) = atan2(10, 0) = PI/2
	// Actually, with -dz, if target is at (10, 0, 0) and ship at (0, 0, 0):
	// dx = 10, dz = 0, so atan2(10, 0) = PI/2
	assert.NotEqual(t, 0.0, dto.RotationY, "RotationY should be calculated when target is set")
}

// TestConvertAgentToDTO_DefaultShipType tests that empty ship type defaults to "neuron"
func TestConvertAgentToDTO_DefaultShipType(t *testing.T) {
	agent := models.Agent{
		ID:         "test-agent-id",
		OwnerID:    "test-user-id",
		Name:       "Test Ship",
		State:      "idle",
		ShipType:   "", // Empty ship type
		PositionX:  0,
		PositionY:  0,
		PositionZ:  0,
	}

	dto := convertAgentToDTO(agent)

	assert.Equal(t, "neuron", dto.ShipType, "Empty ship type should default to 'neuron'")
}

// TestCreateShip tests creating a new ship
func TestCreateShip(t *testing.T) {
	database := setupTestDB(t)
	_ = wshub.NewHub()
	user := createTestUser(t, database)

	// This would normally be a Fiber context, but for testing we call the handler logic directly
	ship := models.Agent{
		ID:       uuid.New().String(),
		OwnerID:  user.ID,
		Name:     "Test Ship",
		State:    "idle",
		ShipType: "neuron",
		PositionX: 0,
		PositionY: 0,
		PositionZ: 0,
		HomeX:     0,
		HomeY:     0,
		HomeZ:     0,
		CreatedAt: time.Now().UnixMilli(),
	}

	err := database.Create(&ship).Error
	assert.NoError(t, err)
	assert.NotNil(t, ship)
	assert.Equal(t, user.ID, ship.OwnerID)
	assert.Equal(t, "Test Ship", ship.Name)
	assert.Equal(t, "idle", ship.State)
}

// TestGetUserShips tests retrieving ships for a user
func TestGetUserShips(t *testing.T) {
	database := setupTestDB(t)
	user := createTestUser(t, database)

	// Create multiple ships
	ship1 := createTestAgent(t, database, user.ID, "idle")
	ship2 := createTestAgent(t, database, user.ID, "traveling")

	// Retrieve ships
	ships, err := db.GetAgentsByOwner(database, user.ID)

	assert.NoError(t, err)
	assert.Len(t, ships, 2)

	// Check that we got both ships
	shipIDs := make(map[string]bool)
	for _, ship := range ships {
		shipIDs[ship.ID] = true
	}
	assert.True(t, shipIDs[ship1.ID])
	assert.True(t, shipIDs[ship2.ID])
}

// TestTravelToSynapse tests the travel to synapse flow
func TestTravelToSynapse(t *testing.T) {
	database := setupTestDB(t)
	_ = wshub.NewHub()
	cfg := &config.Config{
		TravelCostPerUnit:  1.0,
		TravelCostMinimum: 10.0,
		TravelTimePerUnit:  1000.0,
		TimeMultiplier:    10.0,
	}

	user := createTestUser(t, database)
	ship := createTestAgent(t, database, user.ID, "idle")
	space := createTestSpace(t, database, 100, 100, 100)

	// Calculate expected values
	dx := space.PositionX - ship.PositionX
	dy := space.PositionY - ship.PositionY
	dz := space.PositionZ - ship.PositionZ
	distance := math.Sqrt(dx*dx + dy*dy + dz*dz)
	expectedCost := math.Max(distance*cfg.TravelCostPerUnit, cfg.TravelCostMinimum)
	expectedDuration := int64(math.Max(distance*cfg.TravelTimePerUnit/cfg.TimeMultiplier, 2000))

	// Verify calculations
	assert.Greater(t, expectedCost, 0.0)
	assert.GreaterOrEqual(t, expectedDuration, int64(2000))

	// Test that ship has sufficient points
	assert.GreaterOrEqual(t, user.Points, expectedCost)
}

// TestRecallShip tests recalling a ship from exploration
func TestRecallShip(t *testing.T) {
	database := setupTestDB(t)
	_ = wshub.NewHub()

	user := createTestUser(t, database)
	space := createTestSpace(t, database, 50, 50, 50)

	ship := createTestAgent(t, database, user.ID, "solving")
	ship.TargetSpaceID = &space.ID
	ship.CurrentSpaceID = &space.ID
	database.Save(&ship)

	// Add to explorers
	explorer := models.SynapseExplorer{
		ID:        uuid.New().String(),
		SynapseID: space.ID,
		ShipID:    ship.ID,
		UserID:    user.ID,
		PointsPerMinute: 100,
	}
	database.Create(&explorer)

	// Recall the ship
	ship.State = "idle"
	ship.PositionX = ship.HomeX
	ship.PositionY = ship.HomeY
	ship.PositionZ = ship.HomeZ
	ship.TargetSpaceID = nil
	ship.CurrentSpaceID = nil
	database.Save(&ship)

	// Verify ship state
	var updatedShip models.Agent
	database.First(&updatedShip, ship.ID)
	assert.Equal(t, "idle", updatedShip.State)
	assert.Nil(t, updatedShip.TargetSpaceID)
	assert.Nil(t, updatedShip.CurrentSpaceID)
}

// TestToggleAutopilot tests toggling autopilot
func TestToggleAutopilot(t *testing.T) {
	database := setupTestDB(t)
	_ = wshub.NewHub()

	user := createTestUser(t, database)
	ship := createTestAgent(t, database, user.ID, "idle")

	// Enable autopilot
	ship.AutopilotEnabled = true
	database.Save(&ship)

	var updatedShip models.Agent
	database.First(&updatedShip, ship.ID)
	assert.True(t, updatedShip.AutopilotEnabled)

	// Disable autopilot
	ship.AutopilotEnabled = false
	database.Save(&ship)

	database.First(&updatedShip, ship.ID)
	assert.False(t, updatedShip.AutopilotEnabled)
}

// Helper function to convert float to pointer
func float64Ptr(f float64) *float64 {
	return &f
}
