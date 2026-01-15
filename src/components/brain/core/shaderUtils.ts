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

// Region-aware brain particle vertex shader - tiny crisp dots with distance scaling
// Supports depth-based visibility when zoomed on ship
export const BRAIN_REGION_VERTEX_SHADER = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aRegionId;

  uniform float uSelectedRegion;
  uniform float uHighlightIntensity;
  uniform vec3 uShipPosition;
  uniform int uIsShipZoom;

  varying vec3 vColor;
  varying float vHighlight;
  varying float vBehindShip;

  void main() {
    vColor = aColor;

    float isSelected = step(abs(aRegionId - uSelectedRegion), 0.5);
    vHighlight = isSelected * uHighlightIntensity;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // Depth-based visibility for ship zoom mode
    if (uIsShipZoom == 1) {
      // Ship position in view space
      vec4 shipViewPos = modelViewMatrix * vec4(uShipPosition, 1.0);
      float shipDepth = shipViewPos.z;
      float particleDepth = mvPosition.z;

      // Behind = particle further from camera than ship (more negative Z)
      // Add small offset so particles at same depth as ship are visible
      vBehindShip = particleDepth < (shipDepth + 0.05) ? 1.0 : 0.0;
    } else {
      vBehindShip = 1.0;  // Always visible when not in ship zoom
    }

    // Distance-based scaling for consistent particle density
    float distScale = 60.0 / max(-mvPosition.z, 1.0);
    float sizeBoost = 1.0 + vHighlight * 0.2;
    gl_PointSize = clamp(aSize * sizeBoost * distScale, 0.5, 4.0);

    gl_Position = projectionMatrix * mvPosition;
  }
`

// Region-aware brain particle fragment shader - crisp vibrant dots
// Supports depth-based visibility when zoomed on ship
export const BRAIN_REGION_FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vHighlight;
  varying float vBehindShip;

  void main() {
    // Discard particles in front of ship when in ship zoom mode
    if (vBehindShip < 0.5) discard;

    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    // Hard edge circle
    if (dist > 0.4) discard;

    // Vibrant base color with highlight boost
    vec3 finalColor = vColor * (1.4 + vHighlight * 0.8);

    // Core glow for extra vibrancy
    float coreGlow = smoothstep(0.2, 0.0, dist) * 0.3;
    finalColor += coreGlow * vColor;

    // Clamp to prevent over-saturation
    finalColor = min(finalColor, vec3(1.5));

    gl_FragColor = vec4(finalColor, 0.85);
  }
`
