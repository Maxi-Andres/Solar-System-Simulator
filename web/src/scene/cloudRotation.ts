import type { BodyDefinition } from '@sss/tools/types';

import { J2000_JD } from '../core/time.ts';

/**
 * Venus's clouds go round in four and a half days; its ground takes 243.
 *
 * Venus's map is its cloud tops (CREDITS.md: "Venus is its atmosphere"), and the IAU rotation
 * every body is turned by is the solid planet's, measured by radar through the clouds -- one
 * turn in 243 days, backwards. The clouds the map shows do not turn with the ground: the whole
 * atmosphere above about 10 km super-rotates, and at the cloud tops, about 70 km up, the
 * equatorial wind blows westward -- the way the planet turns -- at about 100 m/s
 * (Sánchez-Lavega et al. 2017, Space Sci. Rev. 212, 1541; Akatsuki's ultraviolet cloud
 * tracking, Horinouchi et al. 2020, Science 368, 405).
 *
 * So the body keeps its IAU frame -- its pole, its longitudes, anything set on its ground --
 * and the map alone is slid round it, westward, at the cloud tops' rate over the ground:
 *
 *   100 m/s / (6051.8 + 70) km = 80.9 degrees a day, one lap of the ground in 4.45 days,
 *
 * and with the ground's own turn added, 4.37 days against the stars.
 *
 * Two things this does not do. The wind is the equator's, and the map is turned as one: at
 * the cloud tops the wind is near 100 m/s out to about 50 degrees either side, so those
 * latitudes go round faster in angle and the polar clouds slower (the same paper), which a
 * rigid map cannot show. And the map's clouds are no particular day's: where they stand at
 * any instant -- the slide is counted from J2000 -- is no observation.
 */
export const VENUS_CLOUD_TOP_WIND_M_S = 100;
export const VENUS_CLOUD_TOP_ALTITUDE_KM = 70;

/** The cloud tops' westward drift over the ground, degrees a day. */
export function cloudTopDriftRateDegPerDay(body: Pick<BodyDefinition, 'id' | 'radiusEquatorialKm'>): number | null {
  if (body.id !== 'venus') {
    return null;
  }
  const radiusM = (body.radiusEquatorialKm + VENUS_CLOUD_TOP_ALTITUDE_KM) * 1000;
  return ((VENUS_CLOUD_TOP_WIND_M_S / radiusM) * 86400 * 180) / Math.PI;
}

/**
 * How far west, in degrees, the clouds have drifted over the ground since J2000, wrapped to
 * [0, 360); null for a body whose map turns with it.
 */
export function cloudTopDriftDeg(body: Pick<BodyDefinition, 'id' | 'radiusEquatorialKm'>, jdTdb: number): number | null {
  const rate = cloudTopDriftRateDegPerDay(body);
  if (rate === null) {
    return null;
  }
  const drift = (rate * (jdTdb - J2000_JD)) % 360;
  return drift < 0 ? drift + 360 : drift;
}

/**
 * The map's horizontal offset that draws that drift: u runs east, so a cloud that has moved
 * west by `drift` is found where the image is `drift / 360` further east.
 */
export function cloudTopMapOffset(driftDeg: number): number {
  return driftDeg / 360;
}
