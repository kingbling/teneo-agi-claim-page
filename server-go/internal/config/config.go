package config

import (
	"bufio"
	"os"
	"strconv"
	"strings"
)

func init() {
	loadDotEnv()
}

// loadDotEnv reads .env from the current directory or parent directory.
// Only sets variables that are not already in the environment.
func loadDotEnv() {
	for _, path := range []string{".env", "../.env"} {
		f, err := os.Open(path)
		if err != nil {
			continue
		}
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			key, val, ok := strings.Cut(line, "=")
			if !ok {
				continue
			}
			key = strings.TrimSpace(key)
			val = strings.TrimSpace(val)
			// Strip surrounding quotes
			if len(val) >= 2 && (val[0] == '"' || val[0] == '\'') && val[len(val)-1] == val[0] {
				val = val[1 : len(val)-1]
			}
			// Don't override existing env vars
			if os.Getenv(key) == "" {
				os.Setenv(key, val)
			}
		}
		f.Close()
		return // loaded one file, done
	}
}

// Config holds all configuration for the server
type Config struct {
	// Server
	Port string
	Env  string

	// Database
	DatabaseURL string

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

	// Ambient Ships (world ships visible to all users)
	AmbientShipsMin    int     // 5 — minimum ambient ships (when many real ships active)
	AmbientShipsMax    int     // 15 — maximum ambient ships (when no real ships)
	AmbientSpeedFactor float64 // 0.8 — speed relative to real ships

	// Game Mechanics
	MaxShips         int     // Max ships per user (default 10)
	StartingPoints   float64 // Points given to new users (default 1000)
	StartingMaxShips int     // max_ships column for new users (default 10)

	// Teneo Community API
	TeneoCommunityAPIURL string
	TeneoCommunityAPIKey string
}

// Load loads configuration from environment variables with defaults
func Load() *Config {
	port := getEnv("PORT", "4000")

	return &Config{
		Port:               port,
		Env:                getEnv("NODE_ENV", "development"),
		DatabaseURL:        getEnv("DATABASE_URL", "postgres://teneo:teneo@localhost:5432/teneo?sslmode=disable"),
		JWTSecret:          getEnv("JWT_SECRET", "teneo-secret-key-change-in-production"),
		WSSStateSyncInterval: getEnvInt("WS_STATE_SYNC_INTERVAL", 5000),
		WSSShipSyncInterval:   getEnvInt("WS_SHIP_SYNC_INTERVAL", 5000),
		SimulationEnabled:   getEnvBool("SIMULATION_ENABLED", true),
		TickInterval:        getEnvInt("TICK_INTERVAL", 1000),
		TimeMultiplier:      getEnvFloat("TIME_MULTIPLIER", 5),
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

		MaxShips:         getEnvInt("MAX_SHIPS", 10),
		StartingPoints:   getEnvFloat("STARTING_POINTS", 1000),
		StartingMaxShips: getEnvInt("STARTING_MAX_SHIPS", 10),

		AmbientShipsMin:    getEnvInt("AMBIENT_SHIPS_MIN", 5),
		AmbientShipsMax:    getEnvInt("AMBIENT_SHIPS_MAX", 15),
		AmbientSpeedFactor: getEnvFloat("AMBIENT_SPEED_FACTOR", 8),

		TeneoCommunityAPIURL: getEnv("TENEO_COMMUNITY_API_URL", ""),
		TeneoCommunityAPIKey: getEnv("TENEO_COMMUNITY_API_KEY", ""),
	}
}

// LODGridSizes defines grid sizes for LOD cluster computation.
// Used by both simulation/engine.go and handlers/synapses.go.
var LODGridSizes = map[int]float64{
	0: 0.15, // ~2,500 clusters for detailed view
	1: 0.3,  // ~200 clusters for medium view
	2: 1.0,  // ~8 clusters for far view
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
