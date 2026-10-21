import { SAT, SATELLITE_FLOATS, TYPE_SHIFT, REGIME_SHIFT } from '../core/satellites.ts';
import type { Vec3 } from '../core/vec3.ts';
import { crowdingScale, pixelSolidAngle } from './beltCrowding.ts';
import { OBLIQUITY_J2000_DEG } from './orientation.ts';
import { angularRadiusPixels, satelliteOpacity } from './scale.ts';
import { REGIME_SLOTS, SATELLITE_TYPE_ALPHA, SATELLITE_TYPE_SIZE_PX } from './satelliteShader.ts';

/**
 * How crowded the satellites are on screen, and when they are not drawn at all: the
 * belt's two conventions (see beltCrowding.ts), on Earth's scale.
 *
 * **Crowding.** Every dot is at least a pixel, so from far enough out the ten thousand
 * Starlinks in a shell 600 km thick pile into a solid disc over Earth. Each regime's dots
 * are drawn fainter as they crowd, by just enough to hold the light on the pixels the
 * regime covers to the belt's budget -- one number per regime per frame, nothing per
 * satellite. The regions are the textbook ones, as the belt's are: a factor of two moves
 * the dimming by a factor of two, which is the precision a legibility rule needs.
 *
 * **Fading.** The whole population goes as Earth's system closes up on screen, by the rule
 * a moon goes by (`satelliteOpacity`), on the GEO ring's radius: full while it is 24
 * pixels or more, gone at 12. By then the GEO ring is a smudge of Earth's own marker and
 * LEO is inside Earth's disc -- and from anywhere in the inner Solar System, Earth's
 * satellites cost nothing to draw.
 */

/** Where a regime lies, about Earth's centre, km. */
export interface SatelliteRegion {
  readonly name: string;
  /** A shell all round -- any inclination -- or a ring in the equator. */
  readonly shape: 'shell' | 'ring';
  readonly innerKm: number;
  readonly outerKm: number;
  /** For a ring: half its thickness out of the equator. */
  readonly halfThicknessKm: number;
}

/** In SATELLITE_REGIMES order: leo, meo, geo, heo. */
export const SATELLITE_REGIONS: readonly SatelliteRegion[] = [
  // Apogee under 2,000 km of altitude, by the data's own definition.
  { name: 'LEO', shape: 'shell', innerKm: 6_500, outerKm: 8_400, halfThicknessKm: 0 },
  // The navigation constellations, 19,000 to 26,600 km from the centre.
  { name: 'MEO', shape: 'shell', innerKm: 8_400, outerKm: 30_000, halfThicknessKm: 0 },
  // The geostationary ring, with the old satellites drifting a few degrees out of it.
  { name: 'GEO', shape: 'ring', innerKm: 41_000, outerKm: 43_300, halfThicknessKm: 2_200 },
  // Molniya and transfer orbits, out to 46,000 km at apogee.
  { name: 'HEO', shape: 'shell', innerKm: 6_500, outerKm: 46_000, halfThicknessKm: 0 },
];

/** The radius the whole population fades on: the GEO ring's, km. */
export const GEO_RADIUS_KM = 42_164;

const DEG = Math.PI / 180;
const EQUATOR_NORMAL = {
  x: 0,
  y: Math.sin(OBLIQUITY_J2000_DEG * DEG),
  z: Math.cos(OBLIQUITY_J2000_DEG * DEG),
};

/**
 * The solid angle, steradians, of a region seen from `cameraFromEarthKm`: a shell is the
 * disc it covers; a ring is the belt's ring -- its face foreshortened by the sine of the
 * elevation above the equator, plus its edge -- so edge-on it is a band, not nothing.
 */
export function regionAreaSr(region: SatelliteRegion, cameraFromEarthKm: Vec3): number {
  const d = Math.hypot(cameraFromEarthKm.x, cameraFromEarthKm.y, cameraFromEarthKm.z);
  if (!(d > region.outerKm)) {
    // Inside the region: it is all round, and nothing is crowded from there.
    return Infinity;
  }
  if (region.shape === 'shell') {
    return (Math.PI * region.outerKm * region.outerKm) / (d * d);
  }
  const sinElevation =
    Math.abs(
      cameraFromEarthKm.x * EQUATOR_NORMAL.x +
        cameraFromEarthKm.y * EQUATOR_NORMAL.y +
        cameraFromEarthKm.z * EQUATOR_NORMAL.z,
    ) / d;
  const cosElevation = Math.sqrt(Math.max(0, 1 - sinElevation * sinElevation));
  const face = Math.PI * (region.outerKm ** 2 - region.innerKm ** 2) * sinElevation;
  const edge = 4 * region.outerKm * region.halfThicknessKm * cosElevation;
  return (face + edge) / (d * d);
}

/** Each regime's dots drawn, and the light they bring: opacity times area, CSS pixels. */
export interface RegimeLight {
  readonly count: Float64Array;
  readonly light: Float64Array;
}

/** The light one dot of packed `flags` brings. */
function dotLight(flags: number): number {
  const type = (flags >>> TYPE_SHIFT) & 3;
  const size = SATELLITE_TYPE_SIZE_PX[type]!;
  return SATELLITE_TYPE_ALPHA[type]! * (Math.PI / 4) * size * size;
}

/**
 * Counts each regime's dots and sums their light, over the bulk records and the SGP4
 * tier's flags, skipping any whose chip is hidden. One pass, when the data or the chips
 * change.
 */
export function satelliteLight(
  records: Float32Array,
  chips: Uint8Array,
  extraFlags: readonly number[],
  extraChips: Uint8Array,
  chipVisible: Float32Array,
): RegimeLight {
  const count = new Float64Array(REGIME_SLOTS);
  const light = new Float64Array(REGIME_SLOTS);
  const add = (flags: number, chip: number): void => {
    if (chipVisible[chip] === 0) {
      return;
    }
    const regime = (flags >>> REGIME_SHIFT) & 3;
    count[regime] = count[regime]! + 1;
    light[regime] = light[regime]! + dotLight(flags);
  };
  for (let k = 0; k < chips.length; k += 1) {
    add(records[k * SATELLITE_FLOATS + SAT.flags]!, chips[k]!);
  }
  extraFlags.forEach((flags, k) => add(flags, extraChips[k]!));
  return { count, light };
}

/**
 * This frame's crowding scale for every regime, into `crowding` -- the shader's
 * `uRegimeCrowding` -- and the population's fade, returned. Allocates nothing.
 */
export function writeSatelliteCrowding(
  crowding: Float32Array,
  regimes: RegimeLight,
  cameraFromEarthKm: Vec3,
  fovDeg: number,
  viewportHeightPx: number,
): number {
  const pixelSr = pixelSolidAngle(fovDeg, viewportHeightPx);
  for (let regime = 0; regime < REGIME_SLOTS; regime += 1) {
    const count = regimes.count[regime]!;
    crowding[regime] = crowdingScale(
      count,
      count === 0 ? 0 : regimes.light[regime]! / count,
      regionAreaSr(SATELLITE_REGIONS[regime]!, cameraFromEarthKm),
      pixelSr,
    );
  }
  const d = Math.hypot(cameraFromEarthKm.x, cameraFromEarthKm.y, cameraFromEarthKm.z);
  return satelliteOpacity(angularRadiusPixels(GEO_RADIUS_KM, d, viewportHeightPx, fovDeg));
}
