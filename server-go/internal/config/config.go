package config

import (
	"os"
	"strconv"
)

// Config holds all configuration for the server
type Config struct {
	// Server
	Port string
	Env  string

	// Database
	DatabasePath string

	// JWT
	JWTSecret string

	// WebSocket
	WSSStateSyncInterval int // milliseconds
	WSSShipSyncInterval   int // milliseconds

	// Simulation
	SimulationEnabled   bool
	TickInterval        int // milliseconds
	TimeMultiplier      float64
	BrainBoundsMin      float64
	BrainBoundsMax      float64
	BoundaryMargin      float64
	BoundarySteerStrength float64
	BaseSpeed           float64
	BaseSearchSpeed     float64
	SearchSpeed         float64  // Alias for BaseSearchSpeed
	DetectionRadius     float64
	WanderTurnRate      float64

	// Travel Costs
	TravelCostPerUnit float64 // Points per unit distance
	TravelCostMinimum float64 // Minimum cost floor
	TravelTimePerUnit float64 // Game milliseconds per unit distance (default: 950000 = ~16 min/unit)
}

// Load loads configuration from environment variables with defaults
func Load() *Config {
	port := getEnv("PORT", "4000")

	return &Config{
		Port:               port,
		Env:                getEnv("NODE_ENV", "development"),
		DatabasePath:       getEnv("DATABASE_PATH", "./data/teneo.db"),
		JWTSecret:          getEnv("JWT_SECRET", "teneo-secret-key-change-in-production"),
		WSSStateSyncInterval: getEnvInt("WS_STATE_SYNC_INTERVAL", 5000),
		WSSShipSyncInterval:   getEnvInt("WS_SHIP_SYNC_INTERVAL", 5000),
		SimulationEnabled:   getEnvBool("SIMULATION_ENABLED", true),
		TickInterval:        getEnvInt("TICK_INTERVAL", 1000),
		TimeMultiplier:      getEnvFloat("TIME_MULTIPLIER", 100),
		BrainBoundsMin:      getEnvFloat("BRAIN_BOUNDS_MIN", -50),
		BrainBoundsMax:      getEnvFloat("BRAIN_BOUNDS_MAX", 50),
		BoundaryMargin:      getEnvFloat("BOUNDARY_MARGIN", 0.2),
		BoundarySteerStrength: getEnvFloat("BOUNDARY_STEER_STRENGTH", 0.3),
		BaseSpeed:           getEnvFloat("BASE_SPEED", 5.0),
		BaseSearchSpeed:     getEnvFloat("BASE_SEARCH_SPEED", 3.0),
		SearchSpeed:         getEnvFloat("BASE_SEARCH_SPEED", 3.0),
		DetectionRadius:     getEnvFloat("DETECTION_RADIUS", 2.0),
		WanderTurnRate:      getEnvFloat("WANDER_TURN_RATE", 0.5),
		TravelCostPerUnit:   getEnvFloat("TRAVEL_COST_PER_UNIT", 10.0),
		TravelCostMinimum:   getEnvFloat("TRAVEL_COST_MINIMUM", 5.0),
		TravelTimePerUnit:   getEnvFloat("TRAVEL_TIME_PER_UNIT", 950000), // ~16 min game time per unit
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func getEnvFloat(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if floatVal, err := strconv.ParseFloat(value, 64); err == nil {
			return floatVal
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolVal, err := strconv.ParseBool(value); err == nil {
			return boolVal
		}
	}
	return defaultValue
}
