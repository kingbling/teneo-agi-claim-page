package brainshape

import (
	"math"
	"math/rand"
)

// Brain shape scaling factors (must match frontend BRAIN_SCALE)
const (
	BrainScaleX = 1.35 * 1.2
	BrainScaleY = 1.0 * 1.2
	BrainScaleZ = 1.15 * 1.2
)

// BrainRegion defines a labeled region within the brain shape
type BrainRegion struct {
	Name   string
	Center [3]float64
	Radius float64
}

// BrainRegions defines the labeled regions within the brain
var BrainRegions = []BrainRegion{
	{"prefrontal_cortex", [3]float64{-0.6, 0.5, 0.2}, 0.4},
	{"motor_cortex", [3]float64{-0.4, 0.7, 0.0}, 0.3},
	{"somatosensory_cortex", [3]float64{-0.5, 0.4, -0.3}, 0.3},
	{"auditory_cortex", [3]float64{0.6, -0.2, 0.2}, 0.3},
	{"visual_cortex", [3]float64{0.4, -0.6, -0.1}, 0.4},
	{"hippocampus", [3]float64{0.5, -0.3, 0.1}, 0.25},
	{"thalamus", [3]float64{0.0, 0.0, 0.0}, 0.2},
	{"cerebellum", [3]float64{0.0, -0.8, -0.4}, 0.35},
	{"temporal_lobe", [3]float64{0.7, -0.1, 0.3}, 0.3},
	{"parietal_lobe", [3]float64{-0.6, 0.3, -0.2}, 0.3},
}

// ConstrainToBrainShape applies brain shape deformations to a raw sphere point
func ConstrainToBrainShape(rawX, rawY, rawZ float64) (float64, float64, float64) {
	x, y, z := rawX, rawY, rawZ
	r := math.Sqrt(x*x + y*y + z*z)
	if r > 1.0 {
		x /= r
		y /= r
		z /= r
		r = 1.0
	}
	var dirX, dirY, dirZ float64
	if r > 0.001 {
		dirX = x / r
		dirY = y / r
		dirZ = z / r
	}
	grooveDepth := math.Exp(-math.Abs(dirX)*6) * 0.15
	grooveFactor := 1.0 - grooveDepth*math.Max(0, dirY)
	frontalBulge := math.Max(0, dirZ*0.5+0.5) * math.Max(0, dirY*0.5+0.3) * 0.2
	temporalBulge := math.Max(0, math.Abs(dirX)-0.3) * math.Max(0, -dirY*0.5+0.3) * math.Max(0, dirZ*0.5+0.5) * 0.25
	occipitalBulge := math.Max(0, -dirZ*0.5+0.3) * math.Max(0, dirY*0.3+0.3) * 0.15
	cerebellumBulge := math.Max(0, -dirZ*0.5+0.2) * math.Max(0, -dirY*0.5+0.2) * (1 - math.Abs(dirX)*0.8) * 0.2
	bottomFlatten := math.Max(0, -dirY-0.5) * 0.15
	shapeMod := grooveFactor + frontalBulge + temporalBulge + occipitalBulge + cerebellumBulge - bottomFlatten
	finalR := r * shapeMod
	return dirX * finalR * BrainScaleX,
		dirY * finalR * BrainScaleY,
		dirZ * finalR * BrainScaleZ
}

// GenerateUniformSpherePoint generates a uniformly distributed random point inside a unit sphere
func GenerateUniformSpherePoint() (float64, float64, float64) {
	for {
		x := rand.Float64()*2 - 1
		y := rand.Float64()*2 - 1
		z := rand.Float64()*2 - 1
		if x*x+y*y+z*z <= 1.0 {
			return x, y, z
		}
	}
}

// FindClosestRegion returns the name of the brain region closest to the given point
func FindClosestRegion(x, y, z float64) string {
	minDist := math.MaxFloat64
	closestRegion := "unknown"
	for _, region := range BrainRegions {
		dx := x - region.Center[0]
		dy := y - region.Center[1]
		dz := z - region.Center[2]
		dist := math.Sqrt(dx*dx + dy*dy + dz*dz)
		if dist < minDist && dist < region.Radius {
			minDist = dist
			closestRegion = region.Name
		}
	}
	return closestRegion
}

// GetZone returns the brain zone based on Y coordinate
func GetZone(y float64) string {
	if y > 0.3 {
		return "frontal"
	} else if y > 0 {
		return "parietal"
	} else if y > -0.3 {
		return "temporal"
	}
	return "occipital"
}
