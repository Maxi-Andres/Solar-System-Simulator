/**
 * A ring system's optical depth against radius, shared by the rings that draw it and the world
 * whose day side they shadow.
 *
 * **Why one function in two shaders.** A ring's shadow on its planet is the ring itself, seen
 * from the star: where the ring is dense the band of shadow across the cloud tops is dark, and
 * where a gap opens the sunlight comes through it. Saturn shows it in every Cassini frame. Two
 * profiles kept in step by hand would drift; one string included in both cannot.
 *
 * **What the profile is.** Nothing about a fictional ring is measured, so it is built from what
 * real ones show: optically thin near the planet (Saturn's C ring, tau around 0.1), a dense
 * middle (the B ring, past 1), a fainter outer band, sharp-edged gaps cleared by resonances
 * (the Cassini Division, the Encke gap), and radial structure at every scale down to the
 * kilometre. The seed places the gaps and the bands' strengths; radii are in the world's radii
 * and `x` is the fraction of the way from the inner edge to the outer.
 */

export const RING_GLSL = /* glsl */ `
  uniform vec2 uRingRadii;
  uniform float uRingSeed;

  float ringHash(float n) {
    return fract(sin(n * 12.9898 + uRingSeed * 78.233) * 43758.5453);
  }

  /** Smooth 1D value noise, 0..1. Arguments stay small, so the sine hash is safe here. */
  float ringNoise(float x) {
    float i = floor(x);
    float f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(ringHash(i), ringHash(i + 1.0), f);
  }

  /** A gap of half-width \`width\` at \`centre\`, 0 inside it and 1 outside, soft over \`edge\`. */
  float ringGap(float x, float centre, float width, float edge) {
    return smoothstep(width, width + edge, abs(x - centre));
  }

  /**
   * Normal optical depth at \`x\` (0 at the inner edge, 1 at the outer). \`detail\` is the
   * finest structure kept, in cycles across the ring: the shadow on the planet needs only the
   * broad bands, the rings themselves as much as their pixels resolve.
   */
  float ringDepthAt(float x, float detail) {
    if (x <= 0.0 || x >= 1.0) return 0.0;
    // Three bands: a thin inner one, the dense one, a fainter outer one, their borders seeded.
    float innerEdge = 0.18 + 0.12 * ringHash(1.0);
    float outerEdge = 0.62 + 0.12 * ringHash(2.0);
    float tau = mix(0.08, 0.18, ringNoise(x * 9.0 + 3.0));
    tau = mix(tau, 0.9 + 1.0 * ringNoise(x * 7.0 + 11.0), smoothstep(innerEdge - 0.02, innerEdge + 0.03, x));
    tau = mix(tau, 0.35 + 0.35 * ringNoise(x * 5.0 + 17.0), smoothstep(outerEdge - 0.01, outerEdge + 0.01, x));
    // The division between the dense band and the outer one, and two narrow gaps.
    tau *= mix(0.08, 1.0, ringGap(x, outerEdge - 0.025, 0.012 + 0.012 * ringHash(3.0), 0.004));
    tau *= ringGap(x, 0.85 + 0.1 * ringHash(4.0), 0.003 + 0.003 * ringHash(5.0), 0.0015);
    tau *= mix(0.3, 1.0, ringGap(x, 0.06 + 0.08 * ringHash(6.0), 0.006, 0.004));
    // Fine radial structure, octave by octave while the pixels resolve it.
    float fine = 0.0;
    float amplitude = 0.45;
    float frequency = 40.0;
    for (int i = 0; i < 4; i++) {
      float keep = clamp(2.0 - frequency / detail, 0.0, 1.0);
      fine += amplitude * keep * (ringNoise(x * frequency + float(i) * 31.0) - 0.5);
      frequency *= 3.7;
      amplitude *= 0.7;
    }
    tau *= max(1.0 + fine * 1.6, 0.05);
    // The edges themselves fade over a few per cent rather than stopping at a line.
    return tau * smoothstep(0.0, 0.02, x) * (1.0 - smoothstep(0.97, 1.0, x));
  }

  /** Fraction of the ring's span at radius \`r\` radii. */
  float ringFraction(float r) {
    return (r - uRingRadii.x) / max(uRingRadii.y - uRingRadii.x, 1e-6);
  }

  /** Sunlight through the rings to a point at \`direction\` on the sphere, star toward \`toStar\`. */
  vec3 ringTransmission(vec3 direction, vec3 toStar) {
    if (uRingRadii.y <= 0.0 || abs(toStar.y) < 1e-4) return vec3(1.0);
    // Where the ray toward the star crosses the equatorial plane.
    float t = -direction.y / toStar.y;
    if (t <= 0.0) return vec3(1.0);
    vec3 crossing = direction + t * toStar;
    float tau = ringDepthAt(ringFraction(length(crossing.xz)), 60.0);
    return vec3(exp(-tau / abs(toStar.y)));
  }
`;
