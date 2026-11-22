import * as THREE from 'three';

import { seedFraction } from './noise.ts';

/**
 * Impact craters for airless worlds: bowls with raised rims and ejecta, at many sizes, some
 * fresh and bright, a few with ray systems.
 *
 * **Where the craters are.** Each octave is a 3D lattice of cells over the sphere's direction;
 * a cell may hold one impact, at a seeded point inside it, of a seeded size skewed toward the
 * small as real size distributions are. Only points in a thin shell about the surface count,
 * so every point of the surface sees the same impacts as its neighbours and no crater is cut
 * off where one point's search ends and the next one's begins: an impact's reach (its rim and
 * ejecta) plus the shell's half-thickness never passes the cells searched. The baked octaves
 * search the 27 cells about a point, the one octave live up close only the 8 nearest -- a third
 * of the cost, for craters a fifth of a cell across rather than a quarter.
 *
 * **What a crater is.** A simple crater's depth is about a fifth of its diameter, its rim
 * stands a little under a tenth of it, and its ejecta thins with distance as about the cube of
 * it (Melosh, *Impact Cratering*, 1989); the shape here is that, in units of the crater's
 * radius. Old craters are softened -- shallower, their rims worn down -- and only fresh ones
 * keep the bright ejecta that darkens with space weathering on the Moon and Mercury. A ray
 * crater (Tycho, Copernicus) throws bright streaks out to ten radii and more.
 *
 * Heights are in the world's radii, so the relief shades at its true slope.
 */
export const CRATER_GLSL = /* glsl */ `
  uniform vec4 uRays[2];

  /**
   * Eight random values for a lattice cell: one full hash, and a second word from it by one
   * multiply -- a weaker mix, but its bytes only place the impact within its cell.
   */
  void cellRandom(ivec3 c, uint salt, out vec4 a, out vec4 b) {
    uint h = lowbias32(uint(c.x) * 73856093u ^ uint(c.y) * 19349663u ^ uint(c.z) * 83492791u ^ uSeedHash ^ salt);
    uint g = (h ^ (h >> 15u)) * 0x2c1b3c6du;
    a = vec4(uvec4(h, h >> 8u, h >> 16u, h >> 24u) & 255u) / 255.0;
    b = vec4(uvec4(g, g >> 8u, g >> 16u, g >> 24u) & 255u) / 255.0;
  }

  /** Relief at x = distance / radius, in radii of the crater: bowl, rim and ejecta. */
  float craterShape(float x, float fresh) {
    float worn = mix(0.45, 1.0, fresh);
    float bowl = x < 1.0 ? (x * x - 1.0) * 0.4 * worn : 0.0;
    float rim = 0.09 * worn * exp(-pow((x - 1.0) / 0.16, 2.0));
    float ejecta = x > 1.0 ? 0.03 * worn / (x * x * x) : 0.0;
    return bowl + rim + ejecta;
  }

  /**
   * One octave of craters at \`frequency\` cells a radius: relief (radii) and fresh ejecta's
   * brightness. \`wide\` searches 27 cells, craters up to a quarter of a cell across in
   * radius; otherwise 8, up to an eighth. Craters narrower than about two \`footprint\`s fade.
   */
  vec2 craterOctave(vec3 direction, float frequency, float density, uint salt, float footprint, bool wide) {
    vec3 p = direction * frequency;
    int n = wide ? 3 : 2;
    ivec3 base = wide ? ivec3(floor(p)) - 1 : ivec3(floor(p - 0.5));
    // Shell half-thickness plus reach (2.5 radii) stays within the cells searched.
    float shell = (wide ? 0.4 : 0.2) / frequency;
    float largest = (wide ? 0.24 : 0.12) / frequency;
    vec2 sum = vec2(0.0);
    for (int i = 0; i < 27; i++) {
      if (i >= n * n * n) break;
      ivec3 c = base + ivec3(i % n, (i / n) % n, i / (n * n));
      vec4 a;
      vec4 b;
      cellRandom(c, salt, a, b);
      if (a.x > density) continue;
      vec3 impact = (vec3(c) + b.xyz) / frequency;
      float from = length(impact);
      if (abs(from - 1.0) > shell) continue;
      float radius = largest * mix(0.22, 1.0, a.y * a.y);
      float x = length(direction - impact / from) / radius;
      if (x > 2.5) continue;
      float shown = smoothstep(1.5 * footprint, 3.0 * footprint, radius) * smoothstep(2.5, 2.0, x);
      float fresh = a.z * a.z;
      sum.x += shown * radius * craterShape(x, fresh);
      sum.y += shown * fresh * fresh * (x < 1.2 ? 1.0 : exp(-(x - 1.2) * 2.5));
    }
    return sum;
  }

  /** A ray crater's relief and brightness: \`ray\` its centre (unit) and radius (radii). */
  vec2 rayCrater(vec3 direction, vec4 ray) {
    if (ray.w <= 0.0) return vec2(0.0);
    vec3 centre = ray.xyz;
    float x = length(direction - centre) / ray.w;
    if (x > 16.0) return vec2(0.0);
    vec3 offset = direction - centre * dot(direction, centre);
    vec3 u = normalize(cross(centre, abs(centre.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 v = cross(centre, u);
    float angle = atan(dot(offset, v), dot(offset, u));
    // Noise on a circle of the angle, so the streaks close round with no seam, drifting a
    // little with distance so they are not perfectly straight.
    vec3 around = vec3(cos(angle), sin(angle), 0.0);
    float streaks = simplex(around * 9.0 + vec3(0.0, 0.0, 0.05 * x + 3.0 * ray.w))
      + 0.5 * simplex(around * 23.0 + vec3(0.0, 0.0, 0.1 * x + 7.0));
    float rays = smoothstep(0.2, 0.75, streaks) * (x > 1.0 ? exp(-(x - 1.0) / 5.0) : 0.0);
    float ejecta = x < 1.1 ? 0.6 : exp(-(x - 1.1) * 1.5);
    return vec2(ray.w * craterShape(x, 1.0), 1.4 * rays + ejecta);
  }

  vec2 rayCraters(vec3 direction) {
    return rayCrater(direction, uRays[0]) + rayCrater(direction, uRays[1]);
  }
`;

/**
 * A world's ray craters: none, one or two by its seed -- most airless worlds in the Solar System
 * show one or two young rayed craters at most from a distance -- each a centre and a radius.
 */
export function rayCraterPlacements(seed: number): THREE.Vector4[] {
  const draw = seedFraction(seed, 40);
  const count = draw < 0.15 ? 2 : draw < 0.5 ? 1 : 0;
  return [0, 1].map((i) => {
    if (i >= count) return new THREE.Vector4(0, 0, 0, 0);
    const z = seedFraction(seed, 41 + i) * 2 - 1;
    const longitude = seedFraction(seed, 43 + i) * Math.PI * 2;
    const ring = Math.sqrt(1 - z * z);
    return new THREE.Vector4(
      ring * Math.cos(longitude),
      z,
      ring * Math.sin(longitude),
      0.025 + 0.035 * seedFraction(seed, 45 + i),
    );
  });
}
