package models

// ItemShop represents an item available for purchase
type ItemShop struct {
	ID              string  `gorm:"primaryKey" json:"id"`
	Name            string  `json:"name"`
	Description     *string `json:"description,omitempty"`
	Cost            int     `json:"cost"`
	EffectType      string  `json:"effectType"`
	EffectValue     float64 `json:"effectValue"`
	DurationMinutes *int    `json:"durationMinutes,omitempty"`
	IsAvailable     bool    `gorm:"default:true" json:"isAvailable"`
	CreatedAt       int64   `json:"createdAt"`
}

func (ItemShop) TableName() string { return "item_shop" }

// UserPurchase represents a user's purchase
type UserPurchase struct {
	ID          string  `gorm:"primaryKey" json:"id"`
	UserID      string  `gorm:"index" json:"userId"`
	ItemID      string  `json:"itemId"`
	ShipID      *string `json:"shipId,omitempty"`
	PurchasedAt int64   `json:"purchasedAt"`
	ExpiresAt   *int64  `json:"expiresAt,omitempty"`
	IsActive    bool    `gorm:"index;default:true" json:"isActive"`

	// Relations
	User *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Item *ItemShop `gorm:"foreignKey:ItemID" json:"item,omitempty"`
	Ship *Agent    `gorm:"foreignKey:ShipID" json:"ship,omitempty"`
}

func (UserPurchase) TableName() string { return "user_purchases" }
