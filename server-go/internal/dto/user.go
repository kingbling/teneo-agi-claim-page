package dto

// User represents a user account
type User struct {
	ID            string    `json:"id"`
	Wallet        string    `json:"wallet"`
	Tier          UserTier  `json:"tier"`
	StakedAmount  float64   `json:"stakedAmount"`
	Points        float64   `json:"points"`
	TotalLootEarned float64 `json:"totalLootEarned"`
	CreatedAt     int64     `json:"createdAt"`
	// Masterplan 2026 fields
	UserLevel     *UserLevel `json:"userLevel,omitempty"`
	USDCSpent     *float64   `json:"usdcSpent,omitempty"`
	AgenticBalance *float64  `json:"agenticBalance,omitempty"`
	TotalAgiEarned *float64  `json:"totalAgiEarned,omitempty"`
	LotteryTickets *int      `json:"lotteryTickets,omitempty"`
	MaxShips      *int       `json:"maxShips,omitempty"`
}
