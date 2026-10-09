import type { BodyDefinition, SurfaceTrack } from '@sss/tools/types';

import { longitudeDirection, poleDirection } from '../scene/orientation.ts';
import { add, cross, dot, normalize, scale, type StateVector, type Vec3 } from './vec3.ts';

/**
 * Craft on another body's ground: where they are in space, at any instant.
 *
 * A rover has no ephemeris. What is known is where it stands on its planet -- a
 * latitude and longitude, from NASA's traverse -- and the planet's own rotation, from
 * the IAU elements the surface maps are already aligned by. Put together they place it
 * exactly, every frame, with no table to interpolate and nothing sampled: the rover
 * turns with Mars because it is computed from the same rotation Mars is drawn with, and
 * so it cannot drift off the ground it stands on.
 *
 * The ground is the body's reference ellipsoid -- equatorial and polar radii from the
 * catalog -- since nothing here models terrain. Curiosity is really 4.5 km below it, at
 * the bottom of Gale crater; it is drawn on the ellipsoid, which is what Mars is drawn as.
 */

const DEG = Math.PI / 180;

/** Seconds per day, for turning a rotation rate in degrees per day into rad/s. */
const SECONDS_PER_DAY = 86_400;

/** Index of the stop in force at `jd`: the last one beginning at or before it, or -1. */
export function stopIndexAt(track: SurfaceTrack, jd: number): number {
  const t = track.t;
  if (t.length === 0 || jd < t[0]!) {
    return -1;
  }
  let low = 0;
  let high = t.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (t[mid]! <= jd) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

/** A point on a body's ground, with the directions that matter standing there. */
export interface SurfaceFrame {
  /** From the body's centre, km, in the scene's ecliptic frame. */
  readonly positionKm: Vec3;
  /** Perpendicular to the ellipsoid: which way is up for something standing there. */
  readonly up: Vec3;
  /** Along the ground, toward the body's north pole. */
  readonly north: Vec3;
  /** Along the ground, toward the east. */
  readonly east: Vec3;
}

/**
 * The ground at a planetocentric latitude and east longitude, at an instant.
 *
 * The radius is the ellipsoid's along that direction; "up" is the ellipsoid's normal,
 * which leans poleward of the radial by up to a third of a degree on Mars.
 */
export function surfaceFrame(
  host: BodyDefinition,
  latitudeDeg: number,
  longitudeDeg: number,
  jd: number,
): SurfaceFrame {
  const pole = poleDirection(jd, host);
  const equator = longitudeDirection(jd, host, longitudeDeg);
  const lat = latitudeDeg * DEG;
  const cosLat = Math.cos(lat);
  const sinLat = Math.sin(lat);
  const a = host.radiusEquatorialKm;
  const c = host.radiusPolarKm;
  const radius = 1 / Math.sqrt((cosLat * cosLat) / (a * a) + (sinLat * sinLat) / (c * c));

  const positionKm = add(scale(equator, radius * cosLat), scale(pole, radius * sinLat));
  // Gradient of x²/a² + y²/a² + z²/c²: the ellipsoid's outward normal.
  const up = normalize(
    add(scale(equator, (radius * cosLat) / (a * a)), scale(pole, (radius * sinLat) / (c * c))),
  );
  const north = normalize(add(pole, scale(up, -dot(pole, up))));
  const east = cross(north, up);
  return { positionKm, up, north, east };
}

/**
 * The craft's state relative to its host's centre: where the ground is, and how fast
 * the planet's spin carries it -- 239 m/s at Curiosity's latitude.
 */
export function surfaceState(
  host: BodyDefinition,
  latitudeDeg: number,
  longitudeDeg: number,
  jd: number,
): StateVector {
  const { positionKm } = surfaceFrame(host, latitudeDeg, longitudeDeg, jd);
  const rateRadPerSecond = ((host.rotation?.rotationRateDegPerDay ?? 0) * DEG) / SECONDS_PER_DAY;
  const omega = scale(poleDirection(jd, host), rateRadPerSecond);
  return { position: positionKm, velocity: cross(omega, positionKm) };
}

/**
 * The direction a craft's front faces, from its heading in degrees clockwise from north.
 * Null headings are a convention: north.
 */
export function headingDirection(frame: SurfaceFrame, headingDeg: number | null): Vec3 {
  const heading = (headingDeg ?? 0) * DEG;
  return add(scale(frame.north, Math.cos(heading)), scale(frame.east, Math.sin(heading)));
}
