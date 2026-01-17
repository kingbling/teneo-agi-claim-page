package models

// NFT represents a user's NFT
type NFT struct {
	ID        string  `gorm:"primaryKey" json:"id"`
	UserID    string  `gorm:"index" json:"userId"`
	NftType   string  `gorm:"index;column:nft_type" json:"nftType"`
	SynapseID *string `json:"synapseId,omitempty"`
	Metadata  string  `json:"metadata"`
	MintedAt  int64   `json:"mintedAt"`

	// Relations
	User    *User  `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Synapse *Space `gorm:"foreignKey:SynapseID" json:"synapse,omitempty"`
}

func (NFT) TableName() string { return "nfts" }
