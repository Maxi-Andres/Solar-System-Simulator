/**
 * The noise every fictional world is made of: 3D simplex noise on the sphere's own direction,
 * summed into fractal octaves that stop where a pixel stops resolving them.
 *
 * **Why on the direction, in 3D.** A 2D pattern wrapped onto a sphere has a seam where its
 * ends meet and pinches at the poles. Sampled at the unit direction of each point, a 3D field
 * has neither: it is the same function everywhere on the sphere, and the poles are points like
 * any other.
 *
 * **Why simplex and not gradient noise on a cube lattice.** Four corners a sample instead of
 * eight, and no axis-aligned grain for the eye to find when the octaves line up. The corner
 * hash is an integer one (Wellons' lowbias32, a finaliser that passes avalanche tests), not
 * `fract(sin(x))`, whose quality depends on the driver's sine and falls apart on some GPUs
 * past a few hundred cells. The seed enters the hash, not the coordinates, so a world with
 * seed 1 and one with seed 9,000 cost the same and are equally sharp.
 *
 * **Why octaves stop at the pixel.** An octave finer than a pixel is not detail but noise
 * that shimmers as the world turns, and it is paid for in every fragment. `fbm` is told how
 * many radii a pixel spans (`footprint`), fades each octave out between four and two pixels a
 * cycle, and stops the loop there: a world a few pixels across pays for two octaves, one
 * filling the screen for seven or eight, a close pass over its surface for the maximum.
 */

/** The shared GLSL: `uSeedHash`, `simplex`, `fbm`, `ridged`. */
export const NOISE_GLSL = /* glsl */ `
  uniform uint uSeedHash;

  uint lowbias32(uint x) {
    x ^= x >> 16u;
    x *= 0x7feb352du;
    x ^= x >> 15u;
    x *= 0x846ca68bu;
    x ^= x >> 16u;
    return x;
  }

  /** A gradient for a lattice corner: three 10-bit fields of one hash, each -1..1. */
  vec3 cornerGradient(vec3 corner) {
    ivec3 c = ivec3(corner);
    uint h = lowbias32(
      uint(c.x) * 73856093u ^ uint(c.y) * 19349663u ^ uint(c.z) * 83492791u ^ uSeedHash
    );
    return vec3(uvec3(h, h >> 10u, h >> 20u) & 1023u) * (2.0 / 1023.0) - 1.0;
  }

  /** 3D simplex noise, roughly -1..1. */
  float simplex(vec3 p) {
    const float F3 = 1.0 / 3.0;
    const float G3 = 1.0 / 6.0;
    vec3 s = floor(p + dot(p, vec3(F3)));
    vec3 x0 = p - s + dot(s, vec3(G3));
    // Which of the six tetrahedra of the skewed cube the point is in.
    vec3 e = step(vec3(0.0), x0 - x0.yzx);
    vec3 i1 = e * (1.0 - e.zxy);
    vec3 i2 = 1.0 - e.zxy * (1.0 - e);
    vec3 x1 = x0 - i1 + G3;
    vec3 x2 = x0 - i2 + 2.0 * G3;
    vec3 x3 = x0 - 1.0 + 3.0 * G3;
    vec4 w = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    w *= w;
    w *= w;
    vec4 d = vec4(
      dot(cornerGradient(s), x0),
      dot(cornerGradient(s + i1), x1),
      dot(cornerGradient(s + i2), x2),
      dot(cornerGradient(s + 1.0), x3)
    );
    return dot(d, w) * 32.0;
  }

  // Each octave turned against the last, so their lattices never line up into a grain.
  const mat3 OCTAVE_TURN = mat3(
    0.00, 0.80, 0.60,
    -0.80, 0.36, -0.48,
    -0.60, -0.48, 0.64
  );

  /** How much of an octave of \`frequency\` cycles a radius survives a pixel of \`footprint\` radii. */
  float octaveWeight(float frequency, float footprint) {
    return clamp(2.0 - 4.0 * frequency * footprint, 0.0, 1.0);
  }

  /**
   * Fractal sum of \`octaves\` simplex octaves from \`frequency\` (cycles a radius), each twice
   * the last at a gain of \`gain\`; those finer than the pixel left out. Normalised by the full
   * sum's amplitude, so leaving the fine ones out changes the detail and not the mean.
   */
  float fbm(vec3 p, float frequency, int octaves, float gain, float footprint) {
    float sum = 0.0;
    float amplitude = 1.0;
    float total = 0.0;
    vec3 q = p * frequency;
    for (int i = 0; i < 10; i++) {
      if (i >= octaves) break;
      total += amplitude;
      float weight = octaveWeight(frequency, footprint);
      if (weight <= 0.0) {
        // The rest are finer still: count their amplitude, draw none of them.
        amplitude *= gain;
        continue;
      }
      sum += amplitude * weight * simplex(q);
      q = OCTAVE_TURN * q * 2.03;
      frequency *= 2.03;
      amplitude *= gain;
    }
    return sum / total;
  }

  /**
   * Billowed fractal: |noise| folded up, so each octave is rounded domes parted by sharp
   * creases -- the cells of a cumulus field rather than the smooth swell of plain fbm. -1..1.
   */
  float billow(vec3 p, float frequency, int octaves, float gain, float footprint) {
    float sum = 0.0;
    float amplitude = 1.0;
    float total = 0.0;
    vec3 q = p * frequency;
    for (int i = 0; i < 10; i++) {
      if (i >= octaves) break;
      total += amplitude;
      float weight = octaveWeight(frequency, footprint);
      if (weight > 0.0) sum += amplitude * weight * (2.0 * abs(simplex(q)) - 0.7);
      q = OCTAVE_TURN * q * 2.03;
      frequency *= 2.03;
      amplitude *= gain;
    }
    return sum / total;
  }

  /** Ridged fractal: sharp crests where the noise crosses zero, for mountain chains. 0..1. */
  float ridged(vec3 p, float frequency, int octaves, float footprint) {
    float sum = 0.0;
    float amplitude = 0.5;
    float total = 0.0;
    float previous = 1.0;
    vec3 q = p * frequency;
    for (int i = 0; i < 8; i++) {
      if (i >= octaves) break;
      float weight = octaveWeight(frequency, footprint);
      if (weight <= 0.0) break;
      float r = 1.0 - abs(simplex(q));
      r *= r;
      // Each octave strongest on the last one's crests: chains, not scattered bumps.
      sum += amplitude * weight * r * previous;
      total += amplitude;
      previous = r;
      q = OCTAVE_TURN * q * 2.1;
      frequency *= 2.1;
      amplitude *= 0.5;
    }
    return total > 0.0 ? sum / (total + 0.5 * amplitude) : 0.0;
  }
`;

/**
 * A world's seed as the 32-bit value its shader hashes with: the same seed always the same
 * world, and nearby seeds as different as distant ones.
 */
export function seedHash(seed: number): number {
  let x = (Math.floor(seed) ^ 0x9e3779b9) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

/** A float in [0, 1) drawn from `seed` and a `salt`, for choices made once on the CPU. */
export function seedFraction(seed: number, salt: number): number {
  return seedHash(seedHash(seed) ^ Math.imul(salt + 1, 0x27d4eb2d)) / 4294967296;
}
