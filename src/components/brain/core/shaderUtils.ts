/**
 * Shared Shader Utilities
 *
 * Common GLSL code snippets used across brain visualization components.
 */

// Simple point particle vertex shader
export const POINT_VERTEX_SHADER = `
  attribute vec3 aColor;
  attribute float aSize;

  varying vec3 vColor;

  void main() {
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * 1.5;
    gl_Position = projectionMatrix * mvPosition;
  }
`

// Simple point particle fragment shader
export const POINT_FRAGMENT_SHADER = `
  varying vec3 vColor;

  void main() {
    gl_FragColor = vec4(vColor, 0.85);
  }
`

// Soft glow fragment shader (circular)
export const GLOW_FRAGMENT_SHADER = `
  varying vec3 vColor;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    // Soft circular falloff
    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);

    gl_FragColor = vec4(vColor, alpha * 0.8);
  }
`

// Pulsing vertex shader (adds time-based size variation)
export const PULSE_VERTEX_SHADER = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aPhase;

  uniform float uTime;
  uniform float uPulseStrength;

  varying vec3 vColor;

  void main() {
    vColor = aColor;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // Pulsing size based on time and phase offset
    float pulse = 1.0 + sin(uTime * 2.0 + aPhase) * uPulseStrength;
    gl_PointSize = aSize * pulse;

    gl_Position = projectionMatrix * mvPosition;
  }
`

// Fire/burn particle shaders
export const FIRE_VERTEX_SHADER = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aLife;

  uniform float uTime;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;

    // Fade out as particle ages
    vAlpha = 1.0 - aLife;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // Shrink as particle ages
    gl_PointSize = aSize * (1.0 - aLife * 0.5);

    gl_Position = projectionMatrix * mvPosition;
  }
`

export const FIRE_FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    // Soft circular with fade
    float alpha = (1.0 - smoothstep(0.0, 0.5, dist)) * vAlpha;

    gl_FragColor = vec4(vColor, alpha);
  }
`

// Ring shader for search/solve radius
export const RING_VERTEX_SHADER = `
  uniform float uRadius;
  uniform float uProgress;

  varying float vProgress;

  void main() {
    vProgress = uProgress;

    // Scale position by radius
    vec3 scaledPos = position * uRadius;

    vec4 mvPosition = modelViewMatrix * vec4(scaledPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`

export const RING_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uProgress;

  varying float vProgress;

  void main() {
    // Pulse alpha based on progress
    float alpha = 0.3 + sin(vProgress * 6.28318) * 0.2;

    gl_FragColor = vec4(uColor, alpha);
  }
`

// Helper: Create shader material uniforms object
export function createTimeUniform(initialTime = 0) {
  return { uTime: { value: initialTime } }
}

// Helper: Create color uniform
export function createColorUniform(r: number, g: number, b: number) {
  return { uColor: { value: [r, g, b] } }
}

// Region-aware brain particle vertex shader
export const BRAIN_REGION_VERTEX_SHADER = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aRegionId;

  uniform float uSelectedRegion;
  uniform float uHighlightIntensity;

  varying vec3 vColor;
  varying float vHighlight;
  varying float vIsRegionSelected;  // Pass to fragment shader for dimming logic

  void main() {
    vColor = aColor;

    // Calculate if this particle is in the selected region
    float isSelected = step(abs(aRegionId - uSelectedRegion), 0.5);
    vHighlight = isSelected * uHighlightIntensity;
    vIsRegionSelected = step(0.01, uHighlightIntensity);  // 1.0 if any region selected

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // Distance-based scaling - particles get smaller when camera is closer
    float distToCamera = -mvPosition.z;
    float distScale = smoothstep(1.5, 6.0, distToCamera);

    // Enlarge highlighted particles more dramatically
    float sizeBoost = 1.0 + vHighlight * 0.8;
    gl_PointSize = aSize * 1.2 * sizeBoost * max(0.2, distScale);

    gl_Position = projectionMatrix * mvPosition;
  }
`

// Region-aware brain particle fragment shader with depth fog
export const BRAIN_REGION_FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vHighlight;
  varying float vIsRegionSelected;

  void main() {
    // Soft circular falloff
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;
    float softness = 1.0 - smoothstep(0.0, 0.5, dist);

    // Base brightness with highlight boost
    vec3 finalColor = vColor * (1.2 + vHighlight * 1.2);

    // Core glow - brighter for highlighted particles
    float coreGlow = smoothstep(0.2, 0.0, dist) * (0.35 + vHighlight * 0.4);
    finalColor += coreGlow * vColor;

    // Add white highlight to selected region particles
    if (vHighlight > 0.5) {
      float whiteCore = smoothstep(0.15, 0.0, dist) * 0.5;
      finalColor = mix(finalColor, vec3(1.0), whiteCore);
    }

    // Clamp to prevent bloom explosion
    finalColor = min(finalColor, vec3(1.5));

    // Alpha with highlight boost
    float alpha = softness * (0.65 + vHighlight * 0.25);

    // Dim non-highlighted particles when a region IS selected
    // vIsRegionSelected is 1.0 when any region is selected, 0.0 otherwise
    // Stronger dimming (0.65) for clearer contrast
    float dimFactor = 1.0 - (1.0 - vHighlight) * 0.65 * vIsRegionSelected;

    gl_FragColor = vec4(finalColor * dimFactor, alpha);
  }
`
