import { SUN_ABSOLUTE_V } from './globularClusters.ts';
import {
  CLUSTER_EDGE_PC,
  CLUSTER_MASS,
  FLATTENING,
  massDensity,
  sampleMagnitudeLimit,
  type NuclearClusterSample,
} from './nuclearCluster.ts';
import { DWARF_ROWS, EVOLVED_ROWS, LF_STEP, STARS_PER_SOLAR_MASS } from './nuclearClusterPopulation.ts';

/**
 * The nuclear star cluster's light (NuclearCluster.tsx): the light of the stars its sample
 * does not draw, as a glow, and the exposure the cluster is drawn at.
 *
 * ## The glow: what the stars drawn leave out
 *
 * The sample (nuclearCluster.ts) is 204,000 stars of the model's 79 million and holds a
 * quarter of its light; the stars drawn from the camera are fewer again, those bright
 * enough from where it stands. The rest is drawn as the glow it is in any photograph of a
 * crowded field: the luminosity density of the model -- its mass density times the
 * population's V light per solar mass, LIGHT_PER_SOLAR_MASS -- times the share of that light
 * in stars too faint to be drawn at each point (faintLightShare), integrated along each
 * pixel's line of sight. A star is drawn where it is brighter than the picture's limit from
 * the camera and in the sample; so at each point the glow keeps the light of the stars
 * fainter than the brighter of those two limits, and stars and glow together hold the
 * model's light, 8.8 million suns in V, once and no more (nuclearClusterLight.test.ts).
 *
 * On the galaxies' exposure (LocalGroup.tsx WHITE_MU), through the same soft shoulder, in
 * the population's integrated colour, behind the same dust as its stars.
 *
 * ## The exposure: the cluster's own
 *
 * From the Sun the picture's exposure is fixed: Sirius white, the stars to V 8, a column of
 * 21 mag/arcsec^2 white. The cluster's sky is ten to fifteen magnitudes past it. From Sgr A*
 * the model puts 30,000 stars brighter than V -4 on the sky and its mean surface brightness
 * at 11.0 mag/arcsec^2 -- the sky of a bright twilight, 5 cd/m^2 -- and from outside its
 * centre is 11.7 and its half-light radius 14.6. At the Sun's exposure every star there is
 * past white and the glow is ten thousand times white: a white screen, which is what it is,
 * and shows nothing of the cluster.
 *
 * So near it the cluster is drawn at exposures of its own, as a camera taken there would
 * set them: shorter by so many magnitudes, added to every star's magnitude, and to the glow's
 * white column. The picture has two exposures everywhere -- the stars' and the galaxies' --
 * and each is metered here on what it draws:
 *
 * - **the stars'** so that the sky is drawn to the depth the sky from the Sun is: as many
 *   stars on the whole sky brighter than the picture's limit as the star catalogue holds
 *   (starsMeteredExposure). From Sgr A* that puts the limit at V -3.3 and white at -12.8: a
 *   few stars past white, most near the limit, as at home;
 * - **the glow's** so that its mean surface brightness is at 18% of white, as a camera's
 *   meter puts a scene's mean at middle grey (glowMeteredExposure): the mean over the part
 *   of the sky the cluster fills, or over the frame, whichever is the brighter -- from
 *   inside, looking at the centre, the frame is far brighter than the whole sky's mean --
 *   and never longer than the stars', so that the glow of the stars too faint to show is no
 *   brighter, against them, than at the Sun's two exposures.
 *
 * From inside the two meters agree within a magnitude, the stars' the shorter; from outside,
 * where the cluster's stars are faint and its light is its glow, the glow's is the shorter
 * by two to six, and the giants show one by one against the glow's falling edge as in a
 * photograph of a globular cluster. Both go back to the Sun's as the cluster shrinks on the
 * screen (exposureWeight): where it is a few pixels across it is drawn on the exposures
 * everything else is.
 */

/** The population's rows, both kinds. */
const ROWS = [...DWARF_ROWS, ...EVOLVED_ROWS];

/** A row's V light, solar units per star of the population, its middle magnitude taken. */
function rowLight(mv: number, share: number): number {
  return share * 10 ** (-0.4 * (mv + LF_STEP / 2 - SUN_ABSOLUTE_V));
}

const TOTAL_ROW_LIGHT = ROWS.reduce((sum, [mv, share]) => sum + rowLight(mv, share), 0);
const TOTAL_ROW_SHARE = ROWS.reduce((sum, [, share]) => sum + share, 0);

/** V light per solar mass of living stars, solar units: 0.35. */
export const LIGHT_PER_SOLAR_MASS = (TOTAL_ROW_LIGHT / TOTAL_ROW_SHARE) * STARS_PER_SOLAR_MASS;

/** The model's whole V luminosity, solar units: 8.8 million. */
export const CLUSTER_LUMINOSITY_V = CLUSTER_MASS * LIGHT_PER_SOLAR_MASS;

/**
 * The cluster's half-light radius, pc: Schödel et al. 2014's effective radius, 4.2 +- 0.4.
 * What its size on the screen is reckoned by.
 */
export const HALF_LIGHT_RADIUS_PC = 4.2;

/**
 * The share of the population's V light in stars fainter than M_V `limit`. A row the limit
 * cuts is shared in proportion, as its stars are spread across it.
 */
export function faintLightShare(limit: number): number {
  let fainter = 0;
  for (const [mv, share] of ROWS) {
    fainter += rowLight(mv, share) * Math.min(1, Math.max(0, (mv + LF_STEP - limit) / LF_STEP));
  }
  return fainter / TOTAL_ROW_LIGHT;
}

/** faintLightShare as the shader reads it: FAINT_TABLE_SIZE values from FAINT_TABLE_FROM by FAINT_TABLE_STEP. */
export const FAINT_TABLE_FROM = -2;
export const FAINT_TABLE_STEP = 0.2;
export const FAINT_TABLE_SIZE = 112;
export const FAINT_TABLE: Float32Array = Float32Array.from({ length: FAINT_TABLE_SIZE }, (_, k) =>
  faintLightShare(FAINT_TABLE_FROM + k * FAINT_TABLE_STEP),
);

/** The table read as the shader reads it: clamped at both ends, linear between. */
export function faintShareFromTable(limit: number): number {
  const t = Math.min(FAINT_TABLE_SIZE - 1, Math.max(0, (limit - FAINT_TABLE_FROM) / FAINT_TABLE_STEP));
  const k = Math.min(Math.floor(t), FAINT_TABLE_SIZE - 2);
  return FAINT_TABLE[k]! + (FAINT_TABLE[k + 1]! - FAINT_TABLE[k]!) * (t - k);
}

/** The population's integrated B-V: its stars' light in B over their light in V. */
export const POPULATION_COLOUR_INDEX = (() => {
  let v = 0;
  let b = 0;
  for (const [mv, share, bv] of ROWS) {
    const light = rowLight(mv, share);
    v += light;
    b += light * 10 ** (-0.4 * bv);
  }
  return -2.5 * Math.log10(b / v);
})();

/** The luminosity density at ellipsoidal radius m, solar V luminosities per cubic parsec. */
export function luminosityDensity(m: number): number {
  return massDensity(m) * LIGHT_PER_SOLAR_MASS;
}

/** The faintest M_V drawn as a star at a point `distancePc` from the camera and `radiusPc` from the hole. */
export function drawnLimit(distancePc: number, radiusPc: number, cameraLimitAt10Pc: number, sampled: boolean): number {
  const fromCamera = cameraLimitAt10Pc - 5 * (Math.log10(Math.max(distancePc, 1e-9)) - 1);
  return sampled ? Math.min(fromCamera, sampleMagnitudeLimit(Math.max(radiusPc, 1e-9))) : -Infinity;
}

/** Steps along each line of sight, in the shader as here. */
export const GLOW_STEPS = 32;

/**
 * The light along a line of sight, L_Sun/pc^2 as a column: from `camera` (pc about the hole,
 * Galactic axes) along the unit `direction`, through the model's ellipsoid, each point's
 * luminosity density times `share` of it. What the glow's shader integrates, the same way:
 * the cusp makes the light pile up where the line passes nearest the hole, so the steps are
 * even in v, t = t* + s sinh v about that point, where the ellipsoidal radius is b cosh v
 * and the integrand smooth.
 */
export function column(
  camera: readonly [number, number, number],
  direction: readonly [number, number, number],
  share: (distancePc: number, radiusPc: number) => number = () => 1,
  steps = GLOW_STEPS,
): number {
  const q = FLATTENING;
  const cs = [camera[0], camera[1], camera[2] / q];
  const ds = [direction[0], direction[1], direction[2] / q];
  const a = ds[0]! * ds[0]! + ds[1]! * ds[1]! + ds[2]! * ds[2]!;
  const half = cs[0]! * ds[0]! + cs[1]! * ds[1]! + cs[2]! * ds[2]!;
  const cc = cs[0]! * cs[0]! + cs[1]! * cs[1]! + cs[2]! * cs[2]!;
  const disc = half * half - a * (cc - CLUSTER_EDGE_PC * CLUSTER_EDGE_PC);
  if (disc <= 0) return 0;
  const root = Math.sqrt(disc);
  const t0 = Math.max(0, (-half - root) / a);
  const t1 = (-half + root) / a;
  if (t1 <= t0) return 0;
  const tStar = -half / a;
  const b = Math.max(Math.sqrt(Math.max(cc - (half * half) / a, 0)), 1e-6);
  const s = b / Math.sqrt(a);
  const v0 = Math.asinh((t0 - tStar) / s);
  const v1 = Math.asinh((t1 - tStar) / s);
  const dv = (v1 - v0) / steps;
  let sum = 0;
  for (let k = 0; k < steps; k += 1) {
    const v = v0 + (k + 0.5) * dv;
    const t = tStar + s * Math.sinh(v);
    const radius = Math.hypot(camera[0] + t * direction[0], camera[1] + t * direction[1], camera[2] + t * direction[2]);
    sum += luminosityDensity(b * Math.cosh(v)) * share(t, radius) * s * Math.cosh(v);
  }
  return sum * dv;
}

/** Directions on the sky the meter reads, spread evenly over the cap the cluster fills, and steps along each. */
const METER_DIRECTIONS = 96;
const METER_STEPS = 32;

/**
 * The cluster's mean surface brightness over the part of the sky it fills, from `camera`
 * (pc about the hole, Galactic axes), L_Sun/pc^2: from inside the whole sky, from outside
 * the cap of its bounding sphere -- each line of sight's column, on a Fibonacci lattice.
 */
export function meanColumn(camera: readonly [number, number, number]): number {
  const distance = Math.hypot(camera[0], camera[1], camera[2]);
  const inside = distance <= CLUSTER_EDGE_PC;
  // The cap's axis, toward the hole, and its edge, as the cosine of its angular radius.
  const axis = inside ? [0, 0, 1] : [-camera[0] / distance, -camera[1] / distance, -camera[2] / distance];
  const cosEdge = inside ? -1 : Math.sqrt(1 - (CLUSTER_EDGE_PC / distance) ** 2);
  const helper = Math.abs(axis[0]!) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = normalise(cross(axis, helper));
  const e2 = cross(axis, e1);
  const golden = Math.PI * (3 - Math.sqrt(5));
  let sum = 0;
  for (let k = 0; k < METER_DIRECTIONS; k += 1) {
    const cz = 1 - ((k + 0.5) / METER_DIRECTIONS) * (1 - cosEdge);
    const sz = Math.sqrt(Math.max(0, 1 - cz * cz));
    const phi = k * golden;
    const direction: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < 3; i += 1) {
      direction[i] = axis[i]! * cz + (e1[i]! * Math.cos(phi) + e2[i]! * Math.sin(phi)) * sz;
    }
    sum += column(camera, direction, undefined, METER_STEPS);
  }
  return sum / METER_DIRECTIONS;
}

/**
 * The mean of the columns along `directions` (unit, Galactic axes) from `camera`: the meter
 * over the frame, read along a grid of its lines of sight.
 */
export function meanColumnAlong(
  camera: readonly [number, number, number],
  directions: readonly (readonly [number, number, number])[],
): number {
  let sum = 0;
  for (const direction of directions) {
    sum += column(camera, direction, undefined, METER_STEPS);
  }
  return sum / Math.max(1, directions.length);
}

function cross(a: readonly number[], b: readonly number[]): number[] {
  return [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
}

function normalise(a: readonly number[]): number[] {
  const length = Math.hypot(a[0]!, a[1]!, a[2]!);
  return [a[0]! / length, a[1]! / length, a[2]! / length];
}

/**
 * The magnitude, as seen from `camera` (pc about the hole, Galactic axes) behind `extinction`,
 * of the `count`-th brightest star of the sample: counted in a histogram of 0.05-magnitude
 * bins rather than sorted, over every `stride`-th star (the sample is in no order of
 * brightness, so a stride is a fair draw of it), a pass a few milliseconds long. Infinity if
 * it holds fewer.
 */
export function nthBrightestMagnitude(
  sample: NuclearClusterSample,
  camera: readonly [number, number, number],
  count: number,
  extinction = 0,
  stride = 1,
): number {
  const from = -40;
  const step = 0.05;
  const bins = new Uint32Array(2000);
  const wanted = count / stride;
  for (let i = 0; i < sample.count; i += stride) {
    const dx = sample.positions[i * 3]! - camera[0];
    const dy = sample.positions[i * 3 + 1]! - camera[1];
    const dz = sample.positions[i * 3 + 2]! - camera[2];
    const m = sample.absoluteV[i]! + 2.5 * Math.log10(Math.max(dx * dx + dy * dy + dz * dz, 1e-24)) - 5;
    const k = Math.floor((m - from) / step);
    bins[Math.min(bins.length - 1, Math.max(0, k))]! += 1;
  }
  let seen = 0;
  for (let k = 0; k < bins.length; k += 1) {
    seen += bins[k]!;
    if (seen >= wanted) return from + (k + 1) * step + extinction;
  }
  return Infinity;
}

/**
 * The exposure metered on the stars, magnitudes shorter than the Sun's: the one at which the
 * `count`-th brightest star on the sky, of magnitude `nthMagnitude`, is at the picture's
 * limit -- as the catalogue's `count` stars down to `limit` are from the Sun.
 */
export function starsMeteredExposure(nthMagnitude: number, limit: number): number {
  return limit - nthMagnitude;
}

/** The shoulder's level a meter puts a scene's mean at: 1 - e^-x = 0.18, middle grey. */
export const MIDDLE_GREY_X = -Math.log(1 - 0.18);

/**
 * The exposure metered on the glow, magnitudes shorter than the Sun's: the one at which
 * `meanColumnSeen` (L_Sun/pc^2, the dust in front taken off) is at middle grey, against
 * `whiteColumn`, the column drawn white at the Sun's exposure.
 */
export function glowMeteredExposure(meanColumnSeen: number, whiteColumn: number): number {
  return 2.5 * Math.log10(meanColumnSeen / MIDDLE_GREY_X / whiteColumn);
}

/**
 * How much of the cluster's own exposure is taken, 0 to 1, by the size of its half-light
 * radius on the screen, CSS pixels: all of it from EXPOSURE_FULL_PX, none below
 * EXPOSURE_FROM_PX, smoothly in the logarithm between. A cluster a few pixels across is a
 * point in a wider picture, and that picture's exposure is the Sun's.
 */
export const EXPOSURE_FROM_PX = 3;
export const EXPOSURE_FULL_PX = 30;
export function exposureWeight(halfLightPx: number): number {
  const t = Math.min(
    1,
    Math.max(0, Math.log(halfLightPx / EXPOSURE_FROM_PX) / Math.log(EXPOSURE_FULL_PX / EXPOSURE_FROM_PX)),
  );
  return t * t * (3 - 2 * t);
}

/**
 * The exposures drawn, magnitudes shorter than the Sun's, weighed: the stars' as metered on
 * them, the glow's the shorter of its meter and theirs; neither longer than the Sun's.
 */
export function clusterExposure(
  starsMetered: number,
  glowMetered: number,
  weight: number,
): { readonly stars: number; readonly glow: number } {
  const stars = Math.max(0, starsMetered);
  return { stars: weight * stars, glow: weight * Math.max(stars, glowMetered) };
}
