package dto

// UserLevelConfig represents configuration for a user level
type UserLevelConfig struct {
	MinUSDC    float64 `json:"minUSDC"`
	Multiplier float64 `json:"multiplier"`
	MaxShips   int     `json:"maxShips"`
	Label      string  `json:"label"`
}

// GetDefaultUserLevelConfig returns the default user level configurations
func GetDefaultUserLevelConfig() map[UserLevel]UserLevelConfig {
	return map[UserLevel]UserLevelConfig{
		1: {MinUSDC: 0, Multiplier: 1.0, MaxShips: 10, Label: "Explorer"},
		2: {MinUSDC: 1, Multiplier: 1.2, MaxShips: 10, Label: "Navigator"},
		3: {MinUSDC: 10, Multiplier: 1.5, MaxShips: 10, Label: "Voyager"},
		4: {MinUSDC: 100, Multiplier: 1.9, MaxShips: 10, Label: "Captain"},
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

// FrontendConfig is the slim config sent to the frontend via /api/config
type FrontendConfig struct {
	UserLevels map[UserLevel]UserLevelConfig `json:"userLevels"`
	MaxShips   int                           `json:"maxShips"`
	Version    string                        `json:"version"`
}

// GetFrontendConfig returns the config payload for the frontend
func GetFrontendConfig(maxShips int) FrontendConfig {
	return FrontendConfig{
		UserLevels: GetDefaultUserLevelConfig(),
		MaxShips:   maxShips,
		Version:    "1.0.0",
	}
}
