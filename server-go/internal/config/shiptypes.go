package config

import "math/rand"

// ShipType defines the visual style and characteristics of a ship
type ShipType string

const (
	// ShipTypeNeuron - Agile interceptor with diamond fuselage, swept delta wings, twin engines
	ShipTypeNeuron ShipType = "neuron"
	// ShipTypeSynapse - Heavy explorer with wide rectangular hull, stubby wings, quad engines
	ShipTypeSynapse ShipType = "synapse"
	// ShipTypeDendrite - Sleek scout with long needle fuselage, minimal fins, single large engine
	ShipTypeDendrite ShipType = "dendrite"
	// ShipTypeAxon - Signal carrier with elongated body
	ShipTypeAxon ShipType = "axon"
	// ShipTypeCortex - Command vessel with broad structure
	ShipTypeCortex ShipType = "cortex"
)

// AllShipTypes contains all valid ship types
var AllShipTypes = []ShipType{ShipTypeNeuron, ShipTypeSynapse, ShipTypeDendrite, ShipTypeAxon, ShipTypeCortex}

// RandomShipType returns a randomly selected ship type
func RandomShipType() ShipType {
	return AllShipTypes[rand.Intn(len(AllShipTypes))]
}

// IsValidShipType checks if a string is a valid ship type
func IsValidShipType(s string) bool {
	for _, t := range AllShipTypes {
		if string(t) == s {
			return true
		}
	}
	return false
}
