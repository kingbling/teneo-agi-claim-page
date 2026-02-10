/**
 * Ship Marker Shaders
 *
 * GLSL vertex and fragment shaders for ship visualization.
 * Extracted from AgentMarkers.tsx for cleaner code organization.
 */

import {
  SHIP_MARKER_CONFIG,
  SHIP_STATE_PULSE,
  SHIP_SHAPE_CONFIG,
  SHIP_ENGINE_CONFIG,
} from '../core/brainConstants'

/**
 * Vertex shader for ship markers - uses constants from brainConstants.ts
 * State indices: 0=idle (gentle hover), 1=solving (orbit synapse), 2=(unused), 3=deploying, 4=returning
 */
export const SHIP_VERTEX_SHADER = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aState;

  uniform float uTime;

  varying vec3 vColor;
  varying float vState;

  void main() {
    vColor = aColor;
    vState = aState;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    float pulse = 1.0;

    // State-based animation (values from SHIP_STATE_PULSE in brainConstants.ts)
    // States: 0=idle, 1=solving, 2=(unused), 3=deploying, 4=returning
    if (aState < 0.5) {
      // Idle: no pulse (stationary)
      pulse = 1.0;
    } else if (aState < 1.5) {
      // Solving: subtle pulse (working at synapse)
      pulse = 1.0 + sin(uTime * 1.5) * 0.1;
    } else if (aState < 2.5) {
      // (unused state 2)
      pulse = 1.0;
    } else if (aState < 3.5) {
      // Deploying: rapid pulse (moving)
      pulse = 1.0 + sin(uTime * ${SHIP_STATE_PULSE.deploying.frequency.toFixed(1)}) * ${SHIP_STATE_PULSE.deploying.amplitude.toFixed(2)};
    } else {
      // Returning: gentle pulse (moving)
      pulse = 1.0 + sin(uTime * ${SHIP_STATE_PULSE.returning.frequency.toFixed(1)}) * ${SHIP_STATE_PULSE.returning.amplitude.toFixed(2)};
    }

    // Hidden particle (aSize set to 0 by hideSelectedShipParticle)
    if (aSize < 0.1) {
      gl_PointSize = 0.0;
      gl_Position = vec4(0.0, 0.0, -9999.0, 1.0);
      return;
    }

    // Distance-based scaling for consistent appearance (values from SHIP_MARKER_CONFIG)
    float distScale = ${SHIP_MARKER_CONFIG.distanceScale.toFixed(1)} / max(-mvPosition.z, 1.0);
    gl_PointSize = clamp(aSize * pulse * distScale, ${SHIP_MARKER_CONFIG.minPointSize.toFixed(1)}, ${SHIP_MARKER_CONFIG.maxPointSize.toFixed(1)});
    gl_Position = projectionMatrix * mvPosition;
  }
`

/**
 * Fragment shader for ship markers - uses constants from brainConstants.ts
 */
export const SHIP_FRAGMENT_SHADER = `
  uniform float uTime;

  varying vec3 vColor;
  varying float vState;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);

    // Create a diamond/ship shape instead of circle
    // Using rotated square (diamond) as ship silhouette
    vec2 absCoord = abs(coord);
    float diamond = absCoord.x + absCoord.y;

    // SOLID opaque core (values from SHIP_SHAPE_CONFIG)
    float core = 1.0 - smoothstep(${SHIP_SHAPE_CONFIG.coreInner.toFixed(2)}, ${SHIP_SHAPE_CONFIG.coreOuter.toFixed(2)}, diamond);

    // Softer outer glow
    float glow = 1.0 - smoothstep(${SHIP_SHAPE_CONFIG.glowInner.toFixed(2)}, ${SHIP_SHAPE_CONFIG.glowOuter.toFixed(2)}, diamond);

    // Engine glow - ONLY for moving ships (values from SHIP_ENGINE_CONFIG)
    float engineGlow = 0.0;
    float engineDist = length(coord - vec2(0.0, 0.2));
    float baseEngine = (1.0 - smoothstep(0.0, ${SHIP_ENGINE_CONFIG.radius.toFixed(2)}, engineDist));

    // State check: only animate for moving ships
    // searching=1, deploying=3, returning=4 should glow
    // idle=0, exploring=2 should NOT glow
    if (vState > 0.5 && vState < 1.5) {
      // Searching: moderate glow
      engineGlow = baseEngine * 0.35 * (0.75 + sin(uTime * 5.0) * 0.25);
    } else if (vState > 2.5 && vState < 3.5) {
      // Deploying: strong glow
      engineGlow = baseEngine * ${SHIP_ENGINE_CONFIG.activeIntensity.toFixed(2)} * (0.7 + sin(uTime * ${SHIP_ENGINE_CONFIG.activeFlickerFreq.toFixed(1)}) * ${SHIP_ENGINE_CONFIG.activeFlickerAmp.toFixed(1)});
    } else if (vState > 3.5) {
      // Returning: moderate glow
      engineGlow = baseEngine * 0.4 * (0.75 + sin(uTime * 4.0) * 0.25);
    }

    // Combine effects - brighter core (values from SHIP_SHAPE_CONFIG)
    vec3 coreColor = vColor * ${SHIP_SHAPE_CONFIG.coreBrightness.toFixed(1)};
    vec3 glowColor = vColor * ${SHIP_SHAPE_CONFIG.glowBrightness.toFixed(1)};
    vec3 finalColor = mix(glowColor, coreColor, core);

    // Add engine glow ONLY for moving ships (colors from SHIP_ENGINE_CONFIG)
    if (vState > 0.5 && vState < 1.5) {
      // Searching: use active color
      vec3 engineColor = vec3(${SHIP_ENGINE_CONFIG.activeColor[0].toFixed(1)}, ${SHIP_ENGINE_CONFIG.activeColor[1].toFixed(1)}, ${SHIP_ENGINE_CONFIG.activeColor[2].toFixed(1)});
      finalColor += engineColor * engineGlow;
    } else if (vState > 2.5) {
      // Deploying or returning: use active color
      vec3 engineColor = vec3(${SHIP_ENGINE_CONFIG.activeColor[0].toFixed(1)}, ${SHIP_ENGINE_CONFIG.activeColor[1].toFixed(1)}, ${SHIP_ENGINE_CONFIG.activeColor[2].toFixed(1)});
      finalColor += engineColor * engineGlow;
    }

    // Alpha: SOLID for core, STRONGER glow (was 0.4, now 0.6)
    float alpha = core * 0.95 + glow * 0.6;
    alpha = max(alpha, engineGlow * 0.7);

    if (alpha < 0.05) discard;

    gl_FragColor = vec4(finalColor, alpha);
  }
`

/**
 * Selection ring vertex shader - animated rotating ring around selected ship
 */
export const SELECTION_RING_VERTEX_SHADER = `
  uniform float uTime;

  varying vec2 vUv;

  void main() {
    vUv = uv;

    // Rotate the ring slowly
    float angle = uTime * 1.5;
    float c = cos(angle);
    float s = sin(angle);

    vec3 pos = position;
    // Rotate around Y axis
    float newX = pos.x * c - pos.z * s;
    float newZ = pos.x * s + pos.z * c;
    pos.x = newX;
    pos.z = newZ;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

/**
 * Selection ring fragment shader - animated dashed cyan ring
 */
export const SELECTION_RING_FRAGMENT_SHADER = `
  uniform float uTime;

  varying vec2 vUv;

  void main() {
    // Ring pattern from UV (ring geometry provides this)
    float ringDist = abs(length(vUv - 0.5) - 0.35);
    float ringAlpha = 1.0 - smoothstep(0.0, 0.08, ringDist);

    // Animated dash pattern
    float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
    float dash = sin(angle * 8.0 + uTime * 4.0) * 0.5 + 0.5;
    dash = smoothstep(0.3, 0.7, dash);

    // Cyan glow color
    vec3 color = vec3(0.3, 0.95, 1.0);

    // Pulsing intensity
    float pulse = 0.7 + sin(uTime * 3.0) * 0.3;

    float alpha = ringAlpha * dash * pulse;

    gl_FragColor = vec4(color, alpha * 0.8);
  }
`
