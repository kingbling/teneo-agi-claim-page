/**
 * Synapse Markers Shaders
 *
 * GLSL vertex and fragment shaders for synapse visualization.
 * Extracted from SpaceMarkers.tsx for cleaner code organization.
 */

/**
 * Vertex shader for synapse markers with state-based animation
 * Enhanced with dramatic type-based visual hierarchy and progress rings
 */
export const SYNAPSE_VERTEX_SHADER = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aState;
  attribute float aSynapseType;
  attribute float aProgress;  // 0.0-1.0 for exploration progress
  attribute float aHovered;   // 1.0 if hovered, 0.0 otherwise
  attribute float aFiltered;  // 1.0 if filtered out, 0.0 if matches filter
  attribute float aActionable; // 1.0 if can deploy to this synapse, 0.0 otherwise

  uniform float uTime;
  uniform float uSolvablePhase;    // 0.0-1.0, cycles for blinking effect
  uniform vec3 uCameraWorldPos;    // For distance-based priority
  uniform float uSolvableDensity;  // Fraction visible at once (0.3 = 30%)
  uniform float uSolvableOnly;     // 1.0 = filter mode at close zoom, 0.0 = disabled
  uniform float uHasActionable;    // 1.0 = at least one synapse is actionable (user has idle ship)

  varying vec3 vColor;
  varying float vState;
  varying float vSynapseType;
  varying float vProgress;
  varying float vHovered;
  varying float vFiltered;
  varying float vActionable;

  void main() {
    vColor = aColor;
    vState = aState;
    vSynapseType = aSynapseType;
    vProgress = aProgress;
    vHovered = aHovered;
    vFiltered = aFiltered;
    vActionable = aActionable;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    float pulse = 1.0;
    float sizeMultiplier = 1.0;

    // Filtered out synapses are smaller
    if (aFiltered > 0.5) {
      sizeMultiplier *= 0.6;
    }

    // State-based animation: 0=undiscovered, 1=exploring, 2=discovered
    if (aState < 0.5) {
      // Undiscovered: subtle breathing
      pulse = 1.0 + sin(uTime * 1.5 + position.x * 4.0) * 0.05;
      sizeMultiplier = 0.9;
    } else if (aState < 1.5) {
      // Being explored: gentle pulsing
      pulse = 1.0 + sin(uTime * 3.0 + position.y * 4.0) * 0.1;
      sizeMultiplier = 1.1;
    } else {
      // Discovered: stable
      pulse = 1.0 + sin(uTime * 0.8) * 0.03;
      sizeMultiplier = 1.0;
    }

    // Type-based animations - subtle effects for rarer types
    // Core synapses (type 3) have subtle pulse
    if (aSynapseType > 2.5 && aSynapseType < 3.5) {
      pulse *= 1.0 + sin(uTime * 2.0 + position.z * 4.0) * 0.05;
    }

    // Rare synapses (type 4) have gentle shimmer
    if (aSynapseType > 3.5 && aSynapseType < 4.5) {
      pulse *= 1.0 + sin(uTime * 2.5 + position.z * 5.0) * 0.06;
    }

    // Legendary synapses (type 5) have soft shimmer
    if (aSynapseType > 4.5 && aSynapseType < 5.5) {
      pulse *= 1.0 + sin(uTime * 3.0) * 0.08;
    }

    // Unique synapses (type 6) have noticeable pulse
    if (aSynapseType > 5.5) {
      pulse *= 1.0 + sin(uTime * 3.0) * 0.1;
    }

    // HOVER EFFECT: Scale up when hovered with dramatic pulsation
    if (aHovered > 0.5) {
      sizeMultiplier *= 2.5;  // Make hovered synapse much larger
      // Strong breathing pulse: oscillates between 0.7x and 1.3x
      pulse *= 0.85 + sin(uTime * 4.0) * 0.35;
    }

    // SOLVABLE DENSITY: Temporal visibility for solvable synapses at close zoom
    // Cycles through batches of solvables to reduce visual clutter while maintaining interactivity
    if (uSolvableOnly > 0.5 && aActionable > 0.5) {
      // Stable hash from position (deterministic per synapse - same synapse always in same phase)
      float posHash = fract(sin(dot(position.xyz, vec3(12.9898, 78.233, 45.164))) * 43758.5453);

      // Distance from camera in world space
      float camDist = length(uCameraWorldPos - position);

      // Priority zones based on camera distance:
      // < 0.5 units: Always visible (nearby synapses stay visible)
      // 0.5-1.5 units: 80% visible (medium distance thinning)
      // > 1.5 units: Cycling visibility with smooth blinking

      if (camDist >= 1.5) {
        // Far zone: cycle through synapses in rotating batches
        float cyclePos = fract(posHash + uSolvablePhase);
        // Smooth visibility with fade in/out (prevents jarring pop)
        float visible = smoothstep(0.0, 0.05, cyclePos)
                      * (1.0 - smoothstep(uSolvableDensity - 0.05, uSolvableDensity, cyclePos));
        if (visible < 0.1) {
          sizeMultiplier = 0.0;  // Hide this synapse this frame
        }
      } else if (camDist >= 0.5) {
        // Medium zone: thin out 20% of synapses (based on hash)
        if (posHash > 0.8) {
          sizeMultiplier = 0.0;
        }
      }
      // Close zone (< 0.5): all solvables visible, no thinning
    }

    // Distance-based scaling for consistent appearance
    float distScale = 80.0 / max(-mvPosition.z, 1.0);
    gl_PointSize = clamp(aSize * pulse * sizeMultiplier * distScale, 2.0, 32.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`

/**
 * Fragment shader for synapse markers with distinct state visuals
 * Enhanced with dramatic type-based visual hierarchy and progress rings
 */
export const SYNAPSE_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uHasActionable;    // 1.0 = at least one synapse is actionable

  varying vec3 vColor;
  varying float vState;
  varying float vSynapseType;
  varying float vProgress;
  varying float vHovered;
  varying float vFiltered;
  varying float vActionable;

  // Helper: Calculate angle from center (0-1 normalized)
  float getAngle(vec2 coord) {
    float angle = atan(coord.y, coord.x);
    return (angle + 3.14159) / (2.0 * 3.14159);  // Normalize to 0-1
  }

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    // Discard fragments outside the circle (fixes square appearance)
    if (dist > 0.5) discard;

    // Soft circular falloff
    float alpha = 1.0 - smoothstep(0.2, 0.5, dist);

    vec3 finalColor = vColor;

    // State-based visual treatment
    if (vState < 0.5) {
      // Undiscovered: muted, mysterious, inviting exploration
      finalColor *= 0.6;
      finalColor = mix(finalColor, vec3(0.3, 0.4, 0.55), 0.3);
      alpha *= 0.7;
      // Soft glow core
      float dimCore = smoothstep(0.15, 0.0, dist) * 0.3;
      finalColor += dimCore * vec3(0.5, 0.55, 0.7);
    } else if (vState < 1.5) {
      // Being explored/solved: DRAMATICALLY ENHANCED with bright pulsing glow
      finalColor = mix(finalColor, vec3(1.0, 0.85, 0.3), 0.5);
      alpha *= 1.4;

      // Pulsing intensity for solving state
      float solvePulse = 0.8 + 0.2 * sin(uTime * 4.0);

      // BRILLIANT HOT CORE - brighter and larger
      float warmCore = smoothstep(0.15, 0.0, dist) * 0.8 * solvePulse;
      finalColor += warmCore * vec3(1.0, 0.95, 0.85);  // Near-white hot core

      // INNER CYAN GLOW RING
      float innerGlow = smoothstep(0.22, 0.15, dist) * smoothstep(0.08, 0.15, dist);
      float cyanPulse = 0.7 + 0.3 * sin(uTime * 3.0 + 1.0);
      finalColor += innerGlow * vec3(0.3, 1.0, 1.0) * cyanPulse * 0.6;

      // PROGRESS RING - animated sweeping arc
      float ringInner = 0.28;
      float ringOuter = 0.38;
      float ringMask = smoothstep(ringInner - 0.02, ringInner, dist) * smoothstep(ringOuter + 0.02, ringOuter, dist);

      // Calculate angle for progress visualization
      float angle = getAngle(center);

      // Animated rotation offset (clockwise sweep)
      float rotationSpeed = 0.5;
      float rotation = fract(uTime * rotationSpeed);

      // Adjust angle with rotation
      float adjustedAngle = fract(angle + rotation);

      // Progress arc: filled from 0 to vProgress (simulated as 0.3-0.8 cycling animation if no real data)
      float simulatedProgress = 0.5 + 0.4 * sin(uTime * 0.3);  // Cycles between 0.1 and 0.9
      float effectiveProgress = max(vProgress, simulatedProgress);

      // Progress fill with smooth edge
      float progressFill = smoothstep(effectiveProgress + 0.02, effectiveProgress - 0.02, adjustedAngle);

      // Colored progress ring: bright cyan filled, dim gray unfilled - ENHANCED brightness
      vec3 progressColor = mix(vec3(0.2, 0.25, 0.3), vec3(0.4, 1.0, 1.0), progressFill);
      progressColor *= ringMask * 1.5 * solvePulse;

      // Leading edge glow (bright spark at progress front) - ENHANCED
      float leadingEdge = smoothstep(0.08, 0.0, abs(adjustedAngle - effectiveProgress)) * ringMask;
      progressColor += leadingEdge * vec3(1.0, 1.0, 1.0) * 2.0;

      finalColor += progressColor;
      alpha = max(alpha, ringMask * 0.98);

      // OUTER PULSING CYAN HALO - new concentric glow ring
      float outerHalo = smoothstep(0.5, 0.42, dist) * smoothstep(0.35, 0.42, dist);
      float haloPulse = 0.6 + 0.4 * sin(uTime * 2.5 + 0.5);
      finalColor += outerHalo * vec3(0.2, 0.9, 1.0) * haloPulse * 0.8;

      // SOFT EXTENDED GLOW beyond the point
      float extendedGlow = smoothstep(0.5, 0.35, dist) * 0.5 * solvePulse;
      alpha += extendedGlow * 0.5;

    } else {
      // Discovered: triumphant, bright, accomplished
      finalColor *= 1.3;
      alpha *= 1.1;
      // Bright white core
      float whiteCore = smoothstep(0.12, 0.0, dist) * 0.6;
      finalColor = mix(finalColor, vec3(1.0), whiteCore);
      // Success ring (greenish tint)
      float successRing = smoothstep(0.32, 0.38, dist) * smoothstep(0.48, 0.4, dist);
      finalColor += successRing * vec3(0.4, 0.9, 0.5) * 0.5;
    }

    // Type-based enhancements - restored for visual hierarchy

    // Core synapses (type 3): warm golden undertone
    if (vSynapseType > 2.5 && vSynapseType < 3.5) {
      float goldTint = smoothstep(0.3, 0.0, dist) * 0.25;
      finalColor += goldTint * vec3(1.0, 0.85, 0.3);
    }

    // Rare synapses (type 4): sparkle effect + outer glow
    if (vSynapseType > 3.5 && vSynapseType < 4.5) {
      alpha *= 1.15;
      float sparkle = smoothstep(0.08, 0.0, dist) * 0.4;
      finalColor += sparkle * vec3(1.0, 0.9, 0.85);
      // Red-ish outer ring
      float rareRing = smoothstep(0.38, 0.42, dist) * smoothstep(0.5, 0.44, dist);
      finalColor += rareRing * vec3(1.0, 0.5, 0.6) * 0.5;
    }

    // Legendary synapses (type 5): brilliant with magenta halo
    if (vSynapseType > 4.5 && vSynapseType < 5.5) {
      alpha *= 1.2;
      float brilliance = smoothstep(0.06, 0.0, dist) * 0.5;
      finalColor += brilliance * vec3(1.0, 1.0, 0.95);
      // Magenta outer halo
      float legendaryHalo = smoothstep(0.35, 0.45, dist) * smoothstep(0.55, 0.48, dist);
      finalColor += legendaryHalo * vec3(1.0, 0.5, 1.0) * 0.6;
    }

    // Unique synapses (type 6): dramatic beacon with double ring
    if (vSynapseType > 5.5) {
      alpha *= 1.3;
      // Brilliant white core
      float beacon = smoothstep(0.04, 0.0, dist) * 0.6;
      finalColor += beacon * vec3(1.0, 1.0, 0.9);
      // Inner golden ring
      float innerRing = smoothstep(0.2, 0.25, dist) * smoothstep(0.35, 0.28, dist);
      finalColor += innerRing * vec3(1.0, 0.9, 0.4) * 0.6;
      // Outer yellow halo
      float outerHalo = smoothstep(0.4, 0.5, dist) * smoothstep(0.6, 0.52, dist);
      finalColor += outerHalo * vec3(1.0, 1.0, 0.5) * 0.5;
    }

    // NON-ACTIONABLE DIMMING: When actionable synapses exist, dim non-actionable ones
    // Creates figure/ground contrast so solvable synapses pop
    if (uHasActionable > 0.5 && vActionable < 0.5 && vFiltered < 0.5) {
      float gray = dot(finalColor, vec3(0.299, 0.587, 0.114));
      finalColor = mix(finalColor, vec3(gray), 0.15);  // 15% desaturation
      finalColor *= 0.8;  // 20% brightness reduction
      alpha *= 0.85;      // 15% alpha reduction
    }

    // HOVER HIGHLIGHT: Dramatic pulsating glow when hovered
    if (vHovered > 0.5) {
      // Animated pulse for the entire effect
      float hoverPulse = 0.7 + 0.3 * sin(uTime * 4.0);

      // Brighten the whole synapse significantly
      finalColor *= 1.6;

      // Animated expanding ring - pulses outward
      float ringPhase = fract(uTime * 0.8);  // 0.8 = speed of expansion
      float ringCenter = 0.25 + ringPhase * 0.35;  // Ring expands from 0.25 to 0.6
      float ringWidth = 0.08 * (1.0 - ringPhase * 0.5);  // Ring gets thinner as it expands
      float expandingRing = smoothstep(ringCenter - ringWidth, ringCenter, dist)
                          * smoothstep(ringCenter + ringWidth, ringCenter, dist);
      expandingRing *= (1.0 - ringPhase);  // Fade out as it expands
      finalColor += expandingRing * vec3(0.3, 1.0, 1.0) * 2.0;

      // Static bright cyan outer ring (always visible)
      float hoverRing = smoothstep(0.32, 0.38, dist) * smoothstep(0.48, 0.40, dist);
      finalColor += hoverRing * vec3(0.4, 1.0, 1.0) * hoverPulse * 2.0;

      // Bright white core glow
      float hoverCore = smoothstep(0.2, 0.0, dist) * 0.8 * hoverPulse;
      finalColor += hoverCore * vec3(1.0, 1.0, 1.0);

      // Ensure full visibility
      alpha = 1.0;
    }

    // FILTER DIMMING: Reduce brightness and alpha for filtered-out synapses
    if (vFiltered > 0.5) {
      // Desaturate and dim significantly
      float gray = dot(finalColor, vec3(0.299, 0.587, 0.114));
      finalColor = mix(finalColor, vec3(gray), 0.7);  // 70% desaturation
      finalColor *= 0.25;  // Much dimmer
      alpha *= 0.3;  // Much more transparent
    }

    // ACTIONABLE HIGHLIGHT: Enhanced cyan-green pulsing effect for solvable synapses
    if (vActionable > 0.5 && vFiltered < 0.5) {
      // Dual-frequency pulse for organic breathing (3.5Hz + 1.2Hz)
      float pulse = 0.7 + 0.2 * sin(uTime * 3.5) + 0.1 * sin(uTime * 1.2 + 0.7);

      // Wide outer ring (0.36-0.50 dist) — cyan-green, 1.8x multiplier
      float outerRing = smoothstep(0.34, 0.38, dist) * smoothstep(0.52, 0.48, dist);
      vec3 ringColor = vec3(0.15, 1.0, 0.6) * pulse;  // Cyan-green
      finalColor += outerRing * ringColor * 1.8;

      // Inner radial wash — subtle green tint over entire point
      float innerWash = smoothstep(0.4, 0.0, dist) * 0.15 * pulse;
      finalColor += innerWash * vec3(0.2, 0.9, 0.5);

      // Core brightening pulse
      float corePulse = smoothstep(0.15, 0.0, dist) * 0.4 * pulse;
      finalColor += corePulse * vec3(0.4, 1.0, 0.7);

      // 1.2x overall brightness boost
      finalColor *= 1.2;

      // Ensure ring visibility
      alpha = max(alpha, outerRing * 0.85 * pulse);
    }

    // Allow rarer types to exceed 1.0 for bloom effect
    finalColor = min(finalColor, vec3(1.5));
    gl_FragColor = vec4(finalColor, alpha);
  }
`
