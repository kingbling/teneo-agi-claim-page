package models

// User represents a player account
type User struct {
	ID               string  `gorm:"primaryKey" json:"id"`
	Wallet           string  `gorm:"uniqueIndex" json:"wallet"`
	Tier             string  `gorm:"default:free" json:"tier"`
	StakedAmount     float64 `gorm:"default:0" json:"stakedAmount"`
	Points           float64 `gorm:"default:1000" json:"points"`
	TotalLootEarned  int     `gorm:"default:0" json:"totalLootEarned"`
	CreatedAt        int64   `json:"createdAt"`
	UserLevel        int     `gorm:"index;default:1" json:"userLevel"`
	UsdcSpent        float64 `gorm:"default:0" json:"usdcSpent"`
	AgenticBalance   int     `gorm:"default:0" json:"agenticBalance"`
	TotalAgiEarned   int     `gorm:"default:0" json:"totalAgiEarned"`
	TotalTeneoEarned int     `gorm:"default:0" json:"totalTeneoEarned"`
	LotteryTickets   int     `gorm:"default:0" json:"lotteryTickets"`
	NftCount         int     `gorm:"default:0" json:"nftCount"`
	MaxShips         int     `gorm:"default:1" json:"maxShips"`
	AuthNonce        *string `json:"authNonce,omitempty"`
	AuthNonceIssuedAt *int64 `json:"authNonceIssuedAt,omitempty"`
	IsAdmin          bool    `gorm:"default:false" json:"isAdmin"`
	BannedAt         *int64  `json:"bannedAt,omitempty"`
	BanReason        *string `json:"banReason,omitempty"`

	// Relations
	Agents []Agent `gorm:"foreignKey:OwnerID" json:"agents,omitempty"`
}

func (User) TableName() string { return "users" }
