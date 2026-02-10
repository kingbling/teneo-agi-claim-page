/**
 * Shared GLSL shader snippets used across brain visualization components.
 *
 * Each function returns a GLSL string to be interpolated into shader source.
 * Parameterized by constants that vary per-effect (distance numerator, clamp
 * range, fade thresholds).
 */

/**
 * Point size distance scaling — scales gl_PointSize inversely with camera
 * distance so particles look consistent at all zoom levels.
 *
 * Requires `mvPosition` (vec4) to be computed beforehand.
 * Returns a `float distScale` variable.
 *
 * @param numerator  Projection factor (40–300, larger = bigger at distance)
 * @param minDepth   Safe-division floor for -mvPosition.z (default 1.0)
 */
export function glslDistanceScale(numerator: number, minDepth = 1.0): string {
  return `float distScale = ${numerator.toFixed(1)} / max(-mvPosition.z, ${minDepth.toFixed(1)});`
}

/**
 * Clamp gl_PointSize to [min, max] range.
 *
 * @param expr  GLSL expression to clamp (e.g. "aSize * fade * distScale")
 * @param min   Minimum point size in pixels
 * @param max   Maximum point size in pixels
 */
export function glslClampPointSize(expr: string, min: number, max: number): string {
  return `gl_PointSize = clamp(${expr}, ${min.toFixed(1)}, ${max.toFixed(1)});`
}

/**
 * Soft circular particle alpha — produces smooth falloff from center to edge.
 * Uses `gl_PointCoord`.
 *
 * Emits `vec2 center`, `float dist`, `float circleAlpha` variables.
 *
 * @param inner  Inner edge of smoothstep (fully opaque inside)
 * @param outer  Outer edge of smoothstep (fully transparent outside)
 */
export function glslSoftCircle(inner: number, outer: number): string {
  return `vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    float circleAlpha = 1.0 - smoothstep(${inner.toFixed(1)}, ${outer.toFixed(1)}, dist);`
}

/**
 * Hard circle discard + soft alpha — discards fragments outside radius 0.5,
 * then applies smooth falloff for soft edges.
 *
 * Emits `vec2 center`, `float dist`, `float circleAlpha` variables.
 *
 * @param inner  Inner edge of smoothstep
 * @param outer  Outer edge of smoothstep
 */
export function glslCircleDiscard(inner: number, outer: number): string {
  return `vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;
    float circleAlpha = 1.0 - smoothstep(${inner.toFixed(1)}, ${outer.toFixed(1)}, dist);`
}
