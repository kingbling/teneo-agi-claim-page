package dto

// UserLevelConfig represents configuration for a user level
type UserLevelConfig struct {
	MinUSDC    float64 `json:"minUSDC"`
	Multiplier float64 `json:"multiplier"`
	MaxShips   int     `json:"maxShips"`
	Label      string  `json:"label"`
}

// WorldBounds represents the brain boundaries
type WorldBounds struct {
	Min              float64 `json:"min"`
	Max              float64 `json:"max"`
	BoundaryMargin   float64 `json:"boundaryMargin"`
	BoundarySteerStrength float64 `json:"boundarySteerStrength"`
}

// GetDefaultUserLevelConfig returns the default user level configurations
func GetDefaultUserLevelConfig() map[UserLevel]UserLevelConfig {
	return map[UserLevel]UserLevelConfig{
		1: {MinUSDC: 0, Multiplier: 1.0, MaxShips: 1, Label: "Explorer"},
		2: {MinUSDC: 1, Multiplier: 1.2, MaxShips: 2, Label: "Navigator"},
		3: {MinUSDC: 10, Multiplier: 1.5, MaxShips: 3, Label: "Voyager"},
		4: {MinUSDC: 100, Multiplier: 1.9, MaxShips: 5, Label: "Captain"},
		5: {MinUSDC: 1000, Multiplier: 2.4, MaxShips: 10, Label: "Admiral"},
	}
}

// CalculateUserLevel calculates user level from USDC spent
func CalculateUserLevel(totalUSDCSpent float64) UserLevel {
	if totalUSDCSpent >= 1000 {
		return 5
	}
	if totalUSDCSpent >= 100 {
		return 4
	}
	if totalUSDCSpent >= 10 {
		return 3
	}
	if totalUSDCSpent >= 1 {
		return 2
	}
	return 1
}

// CalculateFinalETA calculates the final ETA based on user level and item boosts
func CalculateFinalETA(baseETAMinutes int, userLevel int, speedBoost float64) float64 {
	levelConfig := GetDefaultUserLevelConfig()[UserLevel(userLevel)]
	multiplier := levelConfig.Multiplier
	if multiplier == 0 {
		multiplier = 1.0
	}

	// ETA = baseETA / (userMultiplier * (1 + speedBoost))
	finalETA := float64(baseETAMinutes) / (multiplier * (1.0 + speedBoost))
	return finalETA
}

// ============ FRONTEND-COMPATIBLE CONFIG TYPES ============
// These types match the frontend GameConfig interface in src/stores/configStore.ts

// TraitEffect represents the effect of a trait on ship behavior
type TraitEffect struct {
	Type                 string  `json:"type"`
	SpeedBonus           float64 `json:"speedBonus,omitempty"`
	BurnPenalty          float64 `json:"burnPenalty,omitempty"`
	BurnReduction        float64 `json:"burnReduction,omitempty"`
	SpeedPenalty         float64 `json:"speedPenalty,omitempty"`
	DiscoveryBonus       float64 `json:"discoveryBonus,omitempty"`
	SolvePenalty         float64 `json:"solvePenalty,omitempty"`
	LootBonus            float64 `json:"lootBonus,omitempty"`
	LuckyChance          float64 `json:"luckyChance,omitempty"`
	LuckyMultiplier      float64 `json:"luckyMultiplier,omitempty"`
	CollaborativeBonus   float64 `json:"collaborativeBonus,omitempty"`
}

// GameConfigForFrontend matches the frontend GameConfig interface
type GameConfigForFrontend struct {
	Costs  CostConfig  `json:"costs"`
	Rates  RateConfig  `json:"rates"`
	World  WorldConfig `json:"world"`
	Traits map[string]TraitEffect `json:"traits"`
	Tiers  TierConfig  `json:"tiers"`
	Version string     `json:"version"`
}

// CostConfig contains cost-related game constants
type CostConfig struct {
	AGENT_BASE_COST      int     `json:"AGENT_BASE_COST"`
	TRAIT_COST_PER_LEVEL int     `json:"TRAIT_COST_PER_LEVEL"`
	REPAIR_COST_MULTIPLIER float64 `json:"REPAIR_COST_MULTIPLIER"`
	STARTING_USER_POINTS int     `json:"STARTING_USER_POINTS"`
	STARTING_AGENT_FUEL  int     `json:"STARTING_AGENT_FUEL"`
	REPAIR_FUEL_AMOUNT   int     `json:"REPAIR_FUEL_AMOUNT"`
}

// RateConfig contains rate-related game constants
type RateConfig struct {
	TICK_INTERVAL_MS   int     `json:"TICK_INTERVAL_MS"`
	BASE_BURN_RATE     float64 `json:"BASE_BURN_RATE"`
	BASE_SPEED         float64 `json:"BASE_SPEED"`
	BASE_SEARCH_SPEED  float64 `json:"BASE_SEARCH_SPEED"`
	DETECTION_RADIUS   float64 `json:"DETECTION_RADIUS"`
	WANDER_TURN_RATE   float64 `json:"WANDER_TURN_RATE"`
}

// WorldConfig contains world boundary settings
type WorldConfig struct {
	BRAIN_BOUNDS_MIN      float64 `json:"BRAIN_BOUNDS_MIN"`
	BRAIN_BOUNDS_MAX      float64 `json:"BRAIN_BOUNDS_MAX"`
	BOUNDARY_MARGIN       float64 `json:"BOUNDARY_MARGIN"`
	BOUNDARY_STEER_STRENGTH float64 `json:"BOUNDARY_STEER_STRENGTH"`
}

// TierConfig contains tier/level limits and bonuses
type TierConfig struct {
	Limits          map[string]int `json:"limits"`
	StakingBonuses  []StakingBonus `json:"stakingBonuses"`
}

// StakingBonus represents a staking threshold and bonus
type StakingBonus struct {
	Threshold int     `json:"threshold"`
	Bonus     int     `json:"bonus"`
}

// GetFrontendGameConfig returns game config in the format expected by frontend
func GetFrontendGameConfig(tickInterval int, timeMultiplier float64, boundsMin, boundsMax, margin, steerStrength float64) GameConfigForFrontend {
	return GameConfigForFrontend{
		Costs: CostConfig{
			AGENT_BASE_COST:       100,
			TRAIT_COST_PER_LEVEL:  50,
			REPAIR_COST_MULTIPLIER: 0.5,
			STARTING_USER_POINTS:  0,
			STARTING_AGENT_FUEL:   100,
			REPAIR_FUEL_AMOUNT:    50,
		},
		Rates: RateConfig{
			TICK_INTERVAL_MS:   tickInterval,
			BASE_BURN_RATE:     1.0,
			BASE_SPEED:         10.0,
			BASE_SEARCH_SPEED:  5.0,
			DETECTION_RADIUS:   5.0,
			WANDER_TURN_RATE:   0.1,
		},
		World: WorldConfig{
			BRAIN_BOUNDS_MIN:        boundsMin,
			BRAIN_BOUNDS_MAX:        boundsMax,
			BOUNDARY_MARGIN:         margin,
			BOUNDARY_STEER_STRENGTH: steerStrength,
		},
		Traits: map[string]TraitEffect{
			"swift": {
				Type:       "speed",
				SpeedBonus: 0.15,
			},
			"efficient": {
				Type:          "burn",
				BurnReduction: 0.10,
			},
			"lucky": {
				Type:            "discovery",
				LuckyChance:     0.05,
				LuckyMultiplier: 1.5,
			},
			"heavy": {
				Type:         "speed",
				SpeedPenalty: 0.10,
				LootBonus:    0.25,
			},
		},
		Tiers: TierConfig{
			Limits: map[string]int{
				"free":  1,
				"bronze": 2,
				"silver": 5,
				"gold":   10,
			},
			StakingBonuses: []StakingBonus{
				{Threshold: 100, Bonus: 1},
				{Threshold: 500, Bonus: 3},
				{Threshold: 1000, Bonus: 5},
			},
		},
		Version: "1.0.0",
	}
}
