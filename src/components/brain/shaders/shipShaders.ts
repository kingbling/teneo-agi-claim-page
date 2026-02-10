/**
 * Ship Selection Ring Shaders
 *
 * GLSL shaders for the animated selection ring around selected ships.
 */

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
