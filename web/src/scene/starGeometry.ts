import type { StarCatalog } from '@sss/tools/types';

import { DAYS_PER_JULIAN_YEAR, J2000_JD } from '../core/time.ts';
import { vec3, type Vec3 } from '../core/vec3.ts';
import { starColor } from './blackbody.ts';
import { equatorialDirection } from './galactic.ts';
import { equatorialToEcliptic } from './orientation.ts';
import { MAS_PER_YEAR_TO_RAD } from './starRendering.ts';

/**
 * The catalogue as buffers the GPU can hold.
 *
 * Four attributes per star and nothing else: where it is, how fast it is moving, how
 * bright it is and what colour it is. The response -- how the magnitude becomes a
 * pixel -- stays in uniforms, so changing the exposure never means rebuilding 25,000
 * vertices.
 *
 * ## Two frames meet here
 *
 * The catalogue is equatorial: right ascension and declination against Earth's equator
 * at J2000. The scene is ecliptic, because that is the plane the planets are in. So
 * every direction goes through the same obliquity rotation the planets' poles do, from
 * `orientation.ts` -- which means that if that constant were ever wrong, the sky and
 * the planets would be wrong *together* rather than drifting apart, and the error would
 * be invisible instead of obvious. That is the right failure mode.
 *
 * The proper motions do not get rotated, and that is not an oversight. They are given
 * in the equatorial east/north basis at each star's own position, so the shader rebuilds
 * that basis from the equatorial pole -- carried into the scene's frame by
 * `EQUATORIAL_POLE_IN_SCENE` below -- and applies them there.
 */

/** The ICRF north celestial pole, expressed in the scene's ecliptic frame. */
export const EQUATORIAL_POLE_IN_SCENE: Vec3 = equatorialToEcliptic(vec3(0, 0, 1));

export interface StarAttributes {
  readonly count: number;
  /** Unit directions in the scene's ecliptic frame, at the catalogue's epoch. */
  readonly positions: Float32Array;
  /** Proper motion in radians per year, east and north in the equatorial basis. */
  readonly properMotions: Float32Array;
  readonly magnitudes: Float32Array;
  /** Linear sRGB at unit luminance, from the colour index through Planck and CIE. */
  readonly colors: Float32Array;
}

export function buildStarAttributes(catalog: StarCatalog): StarAttributes {
  const count = catalog.count;
  const positions = new Float32Array(count * 3);
  const properMotions = new Float32Array(count * 2);
  const magnitudes = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const direction = equatorialToEcliptic(
      equatorialDirection(catalog.ra[index] as number, catalog.dec[index] as number),
    );
    positions[index * 3] = direction.x;
    positions[index * 3 + 1] = direction.y;
    positions[index * 3 + 2] = direction.z;

    properMotions[index * 2] = (catalog.pmRa[index] as number) * MAS_PER_YEAR_TO_RAD;
    properMotions[index * 2 + 1] = (catalog.pmDec[index] as number) * MAS_PER_YEAR_TO_RAD;

    magnitudes[index] = catalog.mag[index] as number;

    const [red, green, blue] = starColor(catalog.bv[index] as number);
    colors[index * 3] = red;
    colors[index * 3 + 1] = green;
    colors[index * 3 + 2] = blue;
  }

  return { count, positions, properMotions, magnitudes, colors };
}

/**
 * Julian years from the catalogue's epoch to a simulation instant.
 *
 * Julian years, 365.25 days exactly, because that is the unit a catalogue proper motion
 * is published in -- not the tropical year and not a calendar one.
 */
export function yearsSinceEpoch(jdTdb: number): number {
  return (jdTdb - J2000_JD) / DAYS_PER_JULIAN_YEAR;
}
