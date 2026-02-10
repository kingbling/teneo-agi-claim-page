/**
 * World Ship Marker Shaders
 *
 * GLSL vertex and fragment shaders for ambient/other-user ship visualization.
 * Warm white-gold diamond markers with velocity-based streaking.
 * Extracted following the pattern of shipShaders.ts / synapseShaders.ts.
 */

import { WORLD_SHIP_CONFIG } from '../core/brainConstants'

/**
 * Vertex shader for world ship markers
 * - Distance-based sizing with clamp (like AgentMarkers)
 * - Velocity attribute for directional streak elongation
 * - Alpha attribute for fade-in/fade-out
 */
export const WORLD_SHIP_VERTEX_SHADER = `
  attribute float aAlpha;
  attribute vec3 aVelocity;

  uniform float uTime;

  varying float vAlpha;
  varying float vSpeed;
  varying vec2 vVelDir;

  void main() {
    vAlpha = aAlpha;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // Compute speed from velocity magnitude
    float speed = length(aVelocity);
    vSpeed = clamp(speed * 15.0, 0.0, 1.0);

    // Project velocity into screen space for streak direction
    vec3 velWorld = aVelocity;
    vec4 mvVel = modelViewMatrix * vec4(position + velWorld * 0.1, 1.0);
    vec2 screenVel = mvVel.xy / mvVel.w - mvPosition.xy / mvPosition.w;
    float screenVelLen = length(screenVel);
    vVelDir = screenVelLen > 0.001 ? screenVel / screenVelLen : vec2(0.0, 1.0);

    // Gentle pulse
    float pulse = 1.0 + sin(uTime * 2.0 + position.x * 10.0) * 0.08;

    // Distance-based scaling with clamp (matching AgentMarkers pattern)
    float distScale = ${WORLD_SHIP_CONFIG.distanceScale.toFixed(1)} / max(-mvPosition.z, 1.0);
    float size = ${WORLD_SHIP_CONFIG.pointSize.toFixed(1)} * pulse * distScale;

    // Elongate slightly in travel direction for streak feel
    float streakBoost = 1.0 + vSpeed * 0.3;
    size *= streakBoost;

    gl_PointSize = clamp(size, ${WORLD_SHIP_CONFIG.minPointSize.toFixed(1)}, ${WORLD_SHIP_CONFIG.maxPointSize.toFixed(1)});
    gl_Position = projectionMatrix * mvPosition;
  }
`

/**
 * Fragment shader for world ship markers
 * - Diamond/chevron shape (rotated square)
 * - Warm white-gold color with soft glow core
 * - Velocity-based directional streak
 */
export const WORLD_SHIP_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uTime;

  varying float vAlpha;
  varying float vSpeed;
  varying vec2 vVelDir;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);

    // Rotate coord slightly in velocity direction for streak feel
    float angle = atan(vVelDir.y, vVelDir.x);
    float stretch = 1.0 + vSpeed * 0.4;
    // Stretch along velocity direction
    float ca = cos(-angle);
    float sa = sin(-angle);
    vec2 rotated = vec2(
      coord.x * ca - coord.y * sa,
      coord.x * sa + coord.y * ca
    );
    rotated.x *= stretch;
    // Rotate back
    vec2 finalCoord = vec2(
      rotated.x * ca + rotated.y * sa,
      -rotated.x * sa + rotated.y * ca
    );

    // Diamond shape (rotated square)
    vec2 absCoord = abs(finalCoord);
    float diamond = absCoord.x + absCoord.y;

    // Bright core
    float core = 1.0 - smoothstep(0.15, 0.25, diamond);

    // Softer outer glow
    float glow = 1.0 - smoothstep(0.2, 0.45, diamond);

    // Discard outside shape
    if (glow < 0.01) discard;

    // Warm color: brighter core, softer glow
    vec3 coreColor = uColor * 1.4;
    vec3 glowColor = uColor * 0.8;
    vec3 finalColor = mix(glowColor, coreColor, core);

    // Hot white center for traveling ships
    float hotCenter = smoothstep(0.12, 0.0, diamond) * vSpeed * 0.6;
    finalColor += hotCenter * vec3(1.0, 1.0, 0.95);

    // Alpha: solid core, softer glow, modulated by per-ship alpha
    float alpha = core * 0.85 + glow * 0.5;
    alpha *= vAlpha;

    if (alpha < 0.02) discard;

    gl_FragColor = vec4(finalColor, alpha);
  }
`
