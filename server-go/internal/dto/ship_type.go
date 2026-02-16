package dto

// ShipTypeDTO is the API representation of a ship type
// tygo: ShipTypeDTO
type ShipTypeDTO struct {
	ID                   string  `json:"id"                   tygo:""`
	Name                 string  `json:"name"                 tygo:""`
	DisplayName          string  `json:"displayName"          tygo:""`
	Description          string  `json:"description"          tygo:""`
	CreationCost         int     `json:"creationCost"         tygo:""`
	SpeedMultiplier      float64 `json:"speedMultiplier"      tygo:""`
	SolveSpeedMultiplier float64 `json:"solveSpeedMultiplier" tygo:""`
	FuelCapacity         int     `json:"fuelCapacity"         tygo:""`
	DetectionRadius      float64 `json:"detectionRadius"      tygo:""`
	ModelFilename        *string `json:"modelFilename"        tygo:""`
	IsActive             bool    `json:"isActive"             tygo:""`
	SortOrder            int     `json:"sortOrder"            tygo:""`
}
