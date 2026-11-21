import type { BodyDefinition } from '@sss/tools/types';
import * as THREE from 'three';

import { POINT_LIGHT_HOOK } from './ringShadow.ts';
import { LIMB_DARKENING_U } from './starDisc.ts';

/**
 * Eclipses: one body's shadow on another.
 *
 * The Moon's on Earth in a solar eclipse, Earth's on the Moon in a lunar one, the Galilean
 * moons' on Jupiter and Jupiter's on them, and the same for every planet and its moons.
 * Saturn's rings shadow Saturn on their own (ringShadow.ts); this is bodies on bodies.
 *
 * ## How
 *
 * Analytic, per fragment, with no shadow map. From a point on the lit body the Sun is a
 * disc of angular radius a, and an occluder -- a sphere -- a disc of angular radius b, their
 * centres c apart:
 *
 *   a = asin(R_sun / d_sun),  b = asin(R_occ / d_occ),  c = the angle between the two
 *
 * The light reaching the point is the part of the Sun's disc the occluder leaves showing.
 * c >= a + b: none of it covered, full sunlight. c <= b - a: all of it, the umbra. Between,
 * the penumbra -- or, where b < a, the antumbra of an annular eclipse -- and the covered
 * part is the lens where the two discs overlap. Nothing about it is a fitted edge: the
 * penumbra's width and the umbra's size come from the real radii and distances, so the
 * Moon's umbra on Earth is the few hundred kilometres at most it really is, and its
 * penumbra thousands.
 *
 * Earth's sky takes the same occluders, turned into its own frame (atmosphere.ts), and
 * dims each sample of its in-scattered light by the sunlight reaching it: the air over the
 * umbra goes dark with the ground, while the sky seen from inside still sees the sunlit
 * air around it.
 *
 * ## The Sun is darker at its edge
 *
 * Its disc is not uniformly bright, and in a deep partial eclipse that matters: what is
 * left showing is a thin crescent of limb, which is darker than the centre. So the overlap
 * is weighted by the Sun's limb darkening, the same linear law the star discs are drawn
 * with (u = 0.6, starDisc.ts), by splitting the disc into the concentric rings below and
 * taking each ring's covered area at that ring's mean brightness. With 90% of the disc
 * covered by an equal one it leaves 7.4% of the light, where a uniform disc would leave 10%.
 *
 * ## Earth's air
 *
 * Earth's shadow on the Moon is larger than the solid Earth's: the lower atmosphere is
 * opaque to light grazing it, and that layer is part of the occluder. Herald and Sinnott
 * (2014), from 22,539 crater timings over 94 eclipses, put its effective height at 87 km,
 * and Espenak's predictions at EclipseWise are computed with it. So Earth occludes with its
 * equatorial radius plus 87 km here.
 *
 * The same air also bends sunlight into the umbra, and that light -- every sunrise and
 * sunset on Earth at once, reddened -- is what colours an eclipsed Moon copper. It is *not*
 * drawn: the umbra is dark. The totally eclipsed Moon is "10 or more f-stops dimmer than a
 * normal full Moon" (NASA SVS), a thousandth of its light or less; and through this
 * renderer's tone curve, which puts the lit Moon at a mid grey, even a hundredth of that is
 * 0 of 255 (shading.ts's model of it). Drawing it would change no pixel. The copper Moon of the photographs is an exposure a
 * thousand times longer, which the scene does not take.
 *
 * ## Where the occluder was when the light passed it
 *
 * The light reaching a point now passed the occluder a little earlier -- 1.3 s from the
 * Moon to Earth, 3.6 s from Ganymede to Jupiter -- and left the Sun minutes before that.
 * The occluder that matters is where it was then: its position now less its velocity
 * times that light time, the velocity about the Solar System's barycentre, and the same
 * for the Sun. It sounds negligible and is not. The Moon moves 30 km/s with Earth, so in
 * 1.3 s it is 39 km on: left out, the umbra fell 30 km off NASA's track, and the Moon
 * crossed into Earth's shadow 40 seconds late.
 *
 * ## Checked against real eclipses (eclipseShadow.test.ts)
 *
 * - The total solar eclipse of 12 August 2026: the shadow's axis within 0.9 km of NASA's
 *   Besselian elements, and the umbra on the ground within 3 to 5 km of their central line
 *   over Greenland, Iceland and the Atlantic. The path comes out 2-3% wider (300 km against
 *   294 at 17:46 UT), and all of that is two constants: NASA shades with a Moon 0.8 km
 *   smaller, to its limb valleys, and a Sun 300 km larger than the IAU's 695,700 km.
 * - The total lunar eclipses of 7 September 2025 and 3 March 2026: the umbra's radius at
 *   the Moon within 0.0001 degrees of EclipseWise's, totality beginning and ending within
 *   25 and 40 seconds. Its 0.005 deeper magnitude and slightly longer totality are Earth's
 *   flattening, which their shadow has and this one does not.
 * - Ganymede's shadow on Jupiter on 14 and 21 January 2026, reaching the limb within 25
 *   seconds of the published minute.
 *
 * ## Approximations
 *
 * - Every body is a sphere: the oblate planets occlude with their equatorial radius, which
 *   is the one their moons, orbiting in the equator, pass behind. A triaxial moon uses its
 *   mean radius.
 * - Two occluders over the same point multiply their shares rather than adding the area
 *   they cover together: exact when their discs on the Sun do not overlap each other,
 *   which is every case short of a mutual event during a shadow transit.
 * - Only the Sun's direct light is shadowed. The Flood and Shadow lighting modes' fill is a
 *   legibility aid, not sunlight, and lights an eclipsed body as it lights a night side.
 * - Earth's night lights come on by the Sun's height alone, so they stay off in the Moon's
 *   umbra.
 * - Rings are not shadowed by moons, nor moons by rings.
 *
 * ## Cost
 *
 * The occluders for each body are picked on the CPU each frame, in float64, from positions
 * the scene already has, and handed to the shader relative to the lit body -- small
 * numbers. Most frames no occluder's penumbra can reach, the count is zero, and the
 * shader's whole cost is one comparison.
 */

/** The speed of light, km/s. */
const LIGHT_KM_S = 299_792.458;

/**
 * Where a body was when the light now reaching the lit body passed it: `offset` its
 * position from the lit body now, `velocity` its own about the barycentre, km and km/s.
 * The TypeScript twin of what EclipseSelector does inline.
 */
export function whenLightPassed(
  offset: readonly [number, number, number],
  velocity: readonly [number, number, number],
): [number, number, number] {
  const lightTime = Math.hypot(offset[0], offset[1], offset[2]) / LIGHT_KM_S;
  return [
    offset[0] - velocity[0] * lightTime,
    offset[1] - velocity[1] * lightTime,
    offset[2] - velocity[2] * lightTime,
  ];
}

/** Occluders per lit body, at most. More than four shadows on one body at once is unknown. */
export const ECLIPSE_MAX_OCCLUDERS = 4;

/**
 * The occulting layer around Earth, km: the height up to which the atmosphere is opaque to
 * grazing sunlight, as found from lunar-eclipse crater timings (Herald & Sinnott 2014).
 */
export const EARTH_OCCULTING_LAYER_KM = 87;

/**
 * The rings the Sun's disc is split into for limb darkening, as fractions of its radius.
 *
 * Narrower toward the limb, where the brightness changes fastest. Against a 2,000-ring
 * integral the covered light comes out within 0.3% of the Sun’s total in every geometry
 * the tests try.
 */
export const SUN_RING_EDGES = [0.3, 0.55, 0.75, 0.88, 0.96, 1] as const;

/**
 * Mean brightness of each ring under the linear law I(mu) = 1 - u (1 - mu), centre = 1.
 *
 * Integrated exactly: with x = r / a and mu = sqrt(1 - x^2), the light in a ring from x0
 * to x1 is (1 - u)(x1^2 - x0^2) + (2u/3)[(1 - x0^2)^1.5 - (1 - x1^2)^1.5], in units of
 * pi a^2.
 */
export const SUN_RING_BRIGHTNESS: readonly number[] = SUN_RING_EDGES.map((outer, index) => {
  const inner = index === 0 ? 0 : SUN_RING_EDGES[index - 1]!;
  const area = outer * outer - inner * inner;
  const light =
    (1 - LIMB_DARKENING_U) * area +
    ((2 * LIMB_DARKENING_U) / 3) * ((1 - inner * inner) ** 1.5 - (1 - outer * outer) ** 1.5);
  return light / area;
});

/** The whole disc's light in the same units: 1 - u/3. */
export const SUN_DISC_LIGHT = 1 - LIMB_DARKENING_U / 3;

/**
 * Area where two discs overlap: radii r and b, centres c apart. Any consistent units; here
 * angles in radians, small enough that the sky is flat across them.
 */
export function discOverlapArea(r: number, b: number, c: number): number {
  if (r <= 0 || b <= 0 || c >= r + b) {
    return 0;
  }
  if (c <= Math.abs(r - b)) {
    const smaller = Math.min(r, b);
    return Math.PI * smaller * smaller;
  }
  const r2 = r * r;
  const b2 = b * b;
  const c2 = c * c;
  // Half-angles of the two circular segments that make up the lens.
  const alpha = Math.acos(Math.min(1, Math.max(-1, (c2 + r2 - b2) / (2 * c * r))));
  const beta = Math.acos(Math.min(1, Math.max(-1, (c2 + b2 - r2) / (2 * c * b))));
  return r2 * (alpha - 0.5 * Math.sin(2 * alpha)) + b2 * (beta - 0.5 * Math.sin(2 * beta));
}

/**
 * Share of the Sun's light an occluder covers: 0 none, 1 all of it.
 *
 * `sunRadius` and `occluderRadius` are angular radii and `separation` the angle between
 * the two centres, all in radians, as seen from the lit point. Limb-darkened: see above.
 */
export function coveredSunlight(
  sunRadius: number,
  occluderRadius: number,
  separation: number,
): number {
  const a = sunRadius;
  if (separation >= a + occluderRadius) {
    return 0;
  }
  if (separation <= occluderRadius - a) {
    return 1;
  }
  let covered = 0;
  let inside = 0;
  for (let ring = 0; ring < SUN_RING_EDGES.length; ring += 1) {
    const upTo = discOverlapArea(a * SUN_RING_EDGES[ring]!, occluderRadius, separation);
    covered += SUN_RING_BRIGHTNESS[ring]! * (upTo - inside);
    inside = upTo;
  }
  return Math.min(1, Math.max(0, covered / (Math.PI * a * a * SUN_DISC_LIGHT)));
}

/** A sphere: its centre and radius, in any one unit and frame. */
export interface Sphere {
  readonly centre: readonly [number, number, number];
  readonly radius: number;
}

/**
 * The share of the Sun's light reaching a point, 0 in the umbra to 1 in full sunlight.
 *
 * The TypeScript twin of `eclipseSunlight` in the shader, so the geometry can be held
 * against real eclipses. All positions in one frame and unit; float64 here, float32 there.
 */
export function sunlightFraction(
  point: readonly [number, number, number],
  sun: Sphere,
  occluders: readonly Sphere[],
): number {
  const [px, py, pz] = point;
  const sx = sun.centre[0] - px;
  const sy = sun.centre[1] - py;
  const sz = sun.centre[2] - pz;
  const sunDistance = Math.hypot(sx, sy, sz);
  const a = Math.asin(Math.min(1, sun.radius / sunDistance));

  let light = 1;
  for (const occluder of occluders) {
    const ox = occluder.centre[0] - px;
    const oy = occluder.centre[1] - py;
    const oz = occluder.centre[2] - pz;
    const distance = Math.hypot(ox, oy, oz);
    // Behind the Sun, or the Sun's own far side: it cannot be in the way.
    if (distance >= sunDistance) {
      continue;
    }
    const b = Math.asin(Math.min(1, occluder.radius / distance));
    // atan2 of the cross and dot products, not acos of the dot: at the small angles that
    // matter here acos loses most of its digits, and in float32 all of them.
    const cx = sy * oz - sz * oy;
    const cy = sz * ox - sx * oz;
    const cz = sx * oy - sy * ox;
    const c = Math.atan2(Math.hypot(cx, cy, cz), sx * ox + sy * oy + sz * oz);
    light *= 1 - coveredSunlight(a, b, c);
  }
  return light;
}

/**
 * Whether `other` is one of the bodies that can shadow `lit`: its planet, its moons, or a
 * moon of the same planet. Pairs further apart than that -- Venus and Earth, Jupiter and
 * Saturn -- are never close enough for one to shadow the other: Venus's umbra ends 1.6
 * million km behind it, and a planet's penumbra at the next planet out covers a
 * negligible share of the Sun.
 */
export function mayShadow(lit: BodyDefinition, other: BodyDefinition): boolean {
  if (other.id === lit.id) {
    return false;
  }
  return (
    other.parent === lit.id ||
    lit.parent === other.id ||
    (lit.parent !== null && other.parent === lit.parent)
  );
}

/** The radius a body occludes with, km: see the approximations above. */
export function occludingRadiusKm(body: BodyDefinition): number {
  const triaxial = body.triaxialRadiiKm;
  const radius =
    triaxial === null || triaxial === undefined
      ? body.radiusEquatorialKm
      : Math.cbrt(triaxial[0] * triaxial[1] * triaxial[2]);
  return body.id === 'earth' ? radius + EARTH_OCCULTING_LAYER_KM : radius;
}

/** What the shader reads: the Sun and up to four occluders, relative to the lit body. */
export interface EclipseUniforms {
  /** How many of `uEclipseOccluders` are in use; 0 skips the whole test. */
  readonly uEclipseCount: { value: number };
  /** The Sun's centre relative to the lit body's (xyz) and its radius (w). */
  readonly uEclipseSun: { value: THREE.Vector4 };
  readonly uEclipseOccluders: { value: THREE.Vector4[] };
  /**
   * The lit body's centre in the scene, for the vertex shader to measure a vertex from.
   * Unused in a frame the fragment already knows its offset in (the atmosphere's).
   */
  readonly uEclipseCentre: { value: THREE.Vector3 };
}

export function eclipseUniforms(): EclipseUniforms {
  return {
    uEclipseCount: { value: 0 },
    uEclipseSun: { value: new THREE.Vector4(1, 0, 0, 0) },
    uEclipseOccluders: {
      value: Array.from({ length: ECLIPSE_MAX_OCCLUDERS }, () => new THREE.Vector4()),
    },
    uEclipseCentre: { value: new THREE.Vector3() },
  };
}

/**
 * The per-frame choice of occluders for one lit body, written straight into its uniforms.
 *
 * `begin` with the Sun, `offer` each body that may shadow this one, all in km relative to
 * the lit body's centre and in float64, with each one's velocity about the barycentre so
 * it can be put back where the light passed it (see above). An occluder is kept only if
 * its penumbra can reach some point of the lit body this frame, and the four that could
 * cover the most of the Sun win. Nothing is allocated.
 */
export class EclipseSelector {
  readonly uniforms: EclipseUniforms = eclipseUniforms();
  readonly #scores = new Float64Array(ECLIPSE_MAX_OCCLUDERS);
  #litRadiusKm = 0;
  #sunX = 0;
  #sunY = 0;
  #sunZ = 0;
  #sunDistance = 1;
  #sunAngle = 0;
  #kmPerUnit = 1;

  /**
   * Starts a frame. Positions go to the shader divided by `kmPerUnit`, the scene's unit.
   */
  begin(
    litRadiusKm: number,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    sunRadiusKm: number,
    kmPerUnit: number,
  ): void {
    const lightTime = Math.hypot(x, y, z) / LIGHT_KM_S;
    const sunX = x - vx * lightTime;
    const sunY = y - vy * lightTime;
    const sunZ = z - vz * lightTime;
    this.#litRadiusKm = litRadiusKm;
    this.#sunX = sunX;
    this.#sunY = sunY;
    this.#sunZ = sunZ;
    this.#sunDistance = Math.hypot(sunX, sunY, sunZ);
    this.#sunAngle = Math.asin(Math.min(1, sunRadiusKm / this.#sunDistance));
    this.#kmPerUnit = kmPerUnit;
    this.uniforms.uEclipseSun.value.set(
      sunX / kmPerUnit,
      sunY / kmPerUnit,
      sunZ / kmPerUnit,
      sunRadiusKm / kmPerUnit,
    );
    this.uniforms.uEclipseCount.value = 0;
  }

  /**
   * Offers one body. Returns how much of the Sun it could cover from the lit body's
   * nearest point, 0 when its penumbra misses the body altogether.
   */
  offer(
    nowX: number,
    nowY: number,
    nowZ: number,
    vx: number,
    vy: number,
    vz: number,
    radiusKm: number,
  ): number {
    const lightTime = Math.hypot(nowX, nowY, nowZ) / LIGHT_KM_S;
    const x = nowX - vx * lightTime;
    const y = nowY - vy * lightTime;
    const z = nowZ - vz * lightTime;
    const distance = Math.hypot(x, y, z);
    const lit = this.#litRadiusKm;
    if (distance <= lit || distance >= this.#sunDistance) {
      return 0;
    }
    const dot = x * this.#sunX + y * this.#sunY + z * this.#sunZ;
    if (dot <= 0) {
      return 0;
    }
    const cx = this.#sunY * z - this.#sunZ * y;
    const cy = this.#sunZ * x - this.#sunX * z;
    const cz = this.#sunX * y - this.#sunY * x;
    const separation = Math.atan2(Math.hypot(cx, cy, cz), dot);
    // From a point of the lit body rather than its centre, the occluder can look up to
    // `lit` km nearer and shift by as much against the Sun; both widen the reach.
    const nearest = Math.max(distance - lit, radiusKm);
    const occluderAngle = Math.asin(Math.min(1, radiusKm / nearest));
    const shift = Math.asin(Math.min(1, lit / distance)) + lit / this.#sunDistance;
    if (separation >= this.#sunAngle + occluderAngle + shift) {
      return 0;
    }
    const ratio = occluderAngle / this.#sunAngle;
    const score = Math.min(1, ratio * ratio);

    // Insertion into the few kept, best first.
    const count = this.uniforms.uEclipseCount.value;
    let slot = count;
    while (slot > 0 && this.#scores[slot - 1]! < score) {
      slot -= 1;
    }
    if (slot >= ECLIPSE_MAX_OCCLUDERS) {
      return score;
    }
    const occluders = this.uniforms.uEclipseOccluders.value;
    const last = Math.min(count, ECLIPSE_MAX_OCCLUDERS - 1);
    for (let i = last; i > slot; i -= 1) {
      occluders[i]!.copy(occluders[i - 1]!);
      this.#scores[i] = this.#scores[i - 1]!;
    }
    const unit = this.#kmPerUnit;
    occluders[slot]!.set(x / unit, y / unit, z / unit, radiusKm / unit);
    this.#scores[slot] = score;
    this.uniforms.uEclipseCount.value = Math.min(count + 1, ECLIPSE_MAX_OCCLUDERS);
    return score;
  }

  /**
   * Writes the same frame into another set of uniforms, turned by `rotation` and scaled
   * by `scale`: the lit body's own frame, for a shader that works there (the atmosphere).
   */
  copyTransformed(target: EclipseUniforms, rotation: THREE.Quaternion, scale: number): void {
    const count = this.uniforms.uEclipseCount.value;
    target.uEclipseCount.value = count;
    if (count === 0) {
      return;
    }
    transformInto(target.uEclipseSun.value, this.uniforms.uEclipseSun.value, rotation, scale);
    for (let i = 0; i < count; i += 1) {
      transformInto(
        target.uEclipseOccluders.value[i]!,
        this.uniforms.uEclipseOccluders.value[i]!,
        rotation,
        scale,
      );
    }
  }
}

const scratchVector = new THREE.Vector3();

function transformInto(
  target: THREE.Vector4,
  source: THREE.Vector4,
  rotation: THREE.Quaternion,
  scale: number,
): void {
  scratchVector.set(source.x, source.y, source.z).applyQuaternion(rotation).multiplyScalar(scale);
  target.set(scratchVector.x, scratchVector.y, scratchVector.z, source.w * scale);
}

/** A float as a GLSL literal, always with a decimal point. */
function glslFloat(value: number): string {
  return value.toFixed(8);
}

/** The limb-darkening rings, unrolled: no arrays, so it compiles under any GLSL version. */
const RING_GLSL = SUN_RING_EDGES.map(
  (edge, ring) => `
    upTo = eclipseOverlapArea(a * ${glslFloat(edge)}, b, c);
    covered += ${glslFloat(SUN_RING_BRIGHTNESS[ring]!)} * (upTo - inside);
    inside = upTo;`,
).join('');

/**
 * The shader side: `eclipseSunlight(offset)`, the share of sunlight reaching a point at
 * `offset` from the lit body's centre, in the frame and unit the uniforms are in. Line for
 * line the functions above.
 */
export const ECLIPSE_GLSL = /* glsl */ `
#define ECLIPSE_MAX_OCCLUDERS ${ECLIPSE_MAX_OCCLUDERS}
uniform int uEclipseCount;
uniform vec4 uEclipseSun;
uniform vec4 uEclipseOccluders[ECLIPSE_MAX_OCCLUDERS];

float eclipseOverlapArea(float r, float b, float c) {
  if (c >= r + b) {
    return 0.0;
  }
  if (c <= abs(r - b)) {
    float smaller = min(r, b);
    return PI * smaller * smaller;
  }
  float r2 = r * r;
  float b2 = b * b;
  float c2 = c * c;
  float alpha = acos(clamp((c2 + r2 - b2) / (2.0 * c * r), -1.0, 1.0));
  float beta = acos(clamp((c2 + b2 - r2) / (2.0 * c * b), -1.0, 1.0));
  return r2 * (alpha - 0.5 * sin(2.0 * alpha)) + b2 * (beta - 0.5 * sin(2.0 * beta));
}

float eclipseCoveredSunlight(float a, float b, float c) {
  if (c >= a + b) {
    return 0.0;
  }
  if (c <= b - a) {
    return 1.0;
  }
  float covered = 0.0;
  float inside = 0.0;
  float upTo;
  ${RING_GLSL}
  return clamp(covered / (PI * a * a * ${glslFloat(SUN_DISC_LIGHT)}), 0.0, 1.0);
}

float eclipseSunlight(vec3 offset) {
  if (uEclipseCount <= 0) {
    return 1.0;
  }
  vec3 toSun = uEclipseSun.xyz - offset;
  float sunDistance = length(toSun);
  vec3 sunDirection = toSun / sunDistance;
  float a = asin(min(1.0, uEclipseSun.w / sunDistance));
  float light = 1.0;
  for (int i = 0; i < ECLIPSE_MAX_OCCLUDERS; i++) {
    if (i >= uEclipseCount) {
      break;
    }
    vec4 occluder = uEclipseOccluders[i];
    vec3 toOccluder = occluder.xyz - offset;
    float occluderDistance = length(toOccluder);
    if (occluderDistance >= sunDistance) {
      continue;
    }
    vec3 direction = toOccluder / occluderDistance;
    float b = asin(min(1.0, occluder.w / occluderDistance));
    float c = atan(length(cross(sunDirection, direction)), dot(sunDirection, direction));
    light *= 1.0 - eclipseCoveredSunlight(a, b, c);
  }
  return light;
}
`;

/**
 * Teaches a lit body's material to be eclipsed.
 *
 * Chained after whatever patch the material already carries -- Earth's extras, the cloud
 * deck's density, Saturn's ring shadow -- rather than replacing it, and keyed so that each
 * combination compiles its own program: three.js shares a program between materials whose
 * keys match, and the key is by default the patch function's source, which for this
 * wrapper is the same on every body.
 *
 * The offset from the body's centre is taken in the scene's orientation, from the model
 * matrix's rotation and scale -- so it carries a planet's flattening -- plus the model's
 * own position against the body's centre: zero for the body's mesh, and for the ground
 * under a lander (surfaceGround.ts), which shares this material, the lander's place.
 */
export function applyEclipseShadow(
  material: THREE.MeshStandardMaterial,
  uniforms: EclipseUniforms,
): void {
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey();

  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uEclipseCentre;
        varying vec3 vEclipseOffset;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vEclipseOffset = mat3(modelMatrix) * transformed + (modelMatrix[3].xyz - uEclipseCentre);`,
      );

    // Another patch may already have expanded the lighting chunk to hook the same line.
    let fragment = shader.fragmentShader.replace(
      '#include <lights_fragment_begin>',
      THREE.ShaderChunk.lights_fragment_begin,
    );
    if (!fragment.includes(POINT_LIGHT_HOOK)) {
      throw new Error('three.js moved the point light hook; eclipses need a new injection point.');
    }
    fragment = fragment
      .replace('#include <common>', `#include <common>\nvarying vec3 vEclipseOffset;\n${ECLIPSE_GLSL}`)
      .replace(
        POINT_LIGHT_HOOK,
        `${POINT_LIGHT_HOOK}
        // Another body between this point and the Sun. The direct light only: see
        // eclipseShadow.ts.
        directLight.color *= eclipseSunlight(vEclipseOffset);`,
      );
    shader.fragmentShader = fragment;
  };
  material.customProgramCacheKey = () => `${previousKey}|eclipse`;
  material.needsUpdate = true;
}
