package dto

// BrainPartDTO is the API representation of a brain part
// tygo: BrainPartDTO
type BrainPartDTO struct {
	ID          string  `json:"id"          tygo:""`
	Name        string  `json:"name"        tygo:""`
	DisplayName string  `json:"displayName" tygo:""`
	Description string  `json:"description" tygo:""`
	CenterX     float64 `json:"centerX"     tygo:""`
	CenterY     float64 `json:"centerY"     tygo:""`
	CenterZ     float64 `json:"centerZ"     tygo:""`
	Radius      float64 `json:"radius"      tygo:""`
	ColorR      float64 `json:"colorR"      tygo:""`
	ColorG      float64 `json:"colorG"      tygo:""`
	ColorB      float64 `json:"colorB"      tygo:""`
	IsEnabled   bool    `json:"isEnabled"   tygo:""`
	SortOrder   int     `json:"sortOrder"   tygo:""`
}
