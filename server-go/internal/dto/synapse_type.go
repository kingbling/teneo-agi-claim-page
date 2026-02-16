package dto

// SynapseTypeDTO is the API representation of a synapse type
// tygo: SynapseTypeDTO
type SynapseTypeDTO struct {
	ID             string  `json:"id"             tygo:""`
	Name           string  `json:"name"           tygo:""`
	DisplayName    string  `json:"displayName"    tygo:""`
	ColorR         float32 `json:"colorR"         tygo:""`
	ColorG         float32 `json:"colorG"         tygo:""`
	ColorB         float32 `json:"colorB"         tygo:""`
	PointsRequired int     `json:"pointsRequired" tygo:""`
	AGIRewardMin   int     `json:"agiRewardMin"   tygo:""`
	AGIRewardMax   int     `json:"agiRewardMax"   tygo:""`
	ModelFilename  *string `json:"modelFilename"  tygo:""`
	SortOrder      int     `json:"sortOrder"      tygo:""`
}
