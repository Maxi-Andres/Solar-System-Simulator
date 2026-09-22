import { describe, expect, it } from 'vitest';

import { dot, length, type Vec3 } from '../core/vec3.ts';
import {
  directionToGalactic,
  equatorialDirection,
  GALACTIC_AXIS_RESIDUAL_DEG,
  GALACTIC_BASIS,
  galacticDirection,
} from './galactic.ts';
import { equatorialToEcliptic, OBLIQUITY_J2000_DEG } from './orientation.ts';

/**
 * Where the galaxy is.
 *
 * The thing that makes this worth testing rather than eyeballing is that a wrong sky
 * looks exactly like a right one. A band of light across a black field is convincing at
 * any angle, so "the rotation is correct" cannot be judged from the picture — it has to
 * be judged against objects whose positions were published in both frames long before
 * this project existed.
 *
 * So the tests convert known objects from equatorial coordinates into galactic ones and
 * compare against catalogued values. Sagittarius A* is the sharpest of them, and in a way
 * worth noticing: it does not land *on* the galactic centre, it lands 0.0725 degrees off
 * it, because the IAU frame was fixed in 1958 and the source was located precisely later.
 * Reproducing that offset is a stronger statement than making it vanish would be.
 */

/** Objects with catalogued positions in both frames. */
const OBJECTS: readonly {
  name: string;
  raDeg: number;
  decDeg: number;
  longitudeDeg: number;
  latitudeDeg: number;
}[] = [
  // The compact radio source at the galactic centre. l and b are tiny, not zero: the IAU
  // frame was fixed before Sgr A* was located this precisely.
  { name: 'Sagittarius A*', raDeg: 266.41684, decDeg: -29.00781, longitudeDeg: 359.944, latitudeDeg: -0.046 },
  { name: 'Andromeda (M31)', raDeg: 10.68471, decDeg: 41.26875, longitudeDeg: 121.174, latitudeDeg: -21.573 },
  { name: 'Large Magellanic Cloud', raDeg: 80.894, decDeg: -69.756, longitudeDeg: 280.465, latitudeDeg: -32.889 },
  { name: 'Orion Nebula (M42)', raDeg: 83.822, decDeg: -5.391, longitudeDeg: 209.011, latitudeDeg: -19.385 },
  { name: 'Crab Nebula (M1)', raDeg: 83.633, decDeg: 22.015, longitudeDeg: 184.557, latitudeDeg: -5.784 },
  { name: 'north celestial pole', raDeg: 0, decDeg: 90, longitudeDeg: 122.932, latitudeDeg: 27.128 },
];

/** Angle between two directions, in degrees. */
function separationDeg(a: Vec3, b: Vec3): number {
  const cosine = dot(a, b) / (length(a) * length(b));
  return (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI;
}

describe('the galactic frame', () => {
  it('puts catalogued objects where the catalogues put them', () => {
    for (const object of OBJECTS) {
      const scene = equatorialToEcliptic(equatorialDirection(object.raDeg, object.decDeg));
      const found = directionToGalactic(scene);
      const expected = galacticDirection(object.longitudeDeg, object.latitudeDeg);

      // Compared as an angle on the sky rather than coordinate by coordinate, because
      // longitude is meaningless near a pole and a degree of it is not a degree of arc.
      expect(separationDeg(scene, expected), object.name).toBeLessThan(0.02);
      expect(found.latitudeDeg, `${object.name} latitude`).toBeCloseTo(object.latitudeDeg, 2);
    }
  });

  it('lands Sagittarius A* the catalogued distance from the galactic centre', () => {
    // The sharpest check in the file, and it is sharper than "close to the centre". Sgr A*
    // is not *at* l = 0: the IAU frame was fixed in 1958, before the source was located
    // this precisely, and the catalogues put it at l = -0.056, b = -0.046 -- which is
    // 0.0725 degrees off the origin. So the test is that we reproduce the offset, not that
    // we make it vanish. Landing exactly on zero would mean something was being fitted.
    const scene = equatorialToEcliptic(equatorialDirection(266.41684, -29.00781));
    const catalogued = Math.hypot(0.056, 0.046);

    expect(separationDeg(scene, GALACTIC_BASIS.x)).toBeCloseTo(catalogued, 3);
  });

  it('is built from two published directions that are not quite perpendicular', () => {
    // Both are quoted to five decimals, which is finer than the definition is consistent
    // to. Worth a number rather than a silent orthonormalisation: a future value quoted
    // to more digits can be checked against this.
    expect(Math.abs(GALACTIC_AXIS_RESIDUAL_DEG)).toBeGreaterThan(0);
    expect(Math.abs(GALACTIC_AXIS_RESIDUAL_DEG)).toBeLessThan(0.01);
  });

  it('is an orthonormal right-handed basis after that is taken out', () => {
    const { x, y, z } = GALACTIC_BASIS;
    for (const axis of [x, y, z]) {
      expect(length(axis)).toBeCloseTo(1, 12);
    }
    expect(dot(x, y)).toBeCloseTo(0, 12);
    expect(dot(y, z)).toBeCloseTo(0, 12);
    expect(dot(z, x)).toBeCloseTo(0, 12);

    // x cross y = z, which is what makes `x cos b cos l + y cos b sin l + z sin b` the
    // usual definition rather than a mirror of it.
    const crossed = {
      x: x.y * y.z - x.z * y.y,
      y: x.z * y.x - x.x * y.z,
      z: x.x * y.y - x.y * y.x,
    };
    expect(separationDeg(crossed, z)).toBeLessThan(1e-5);
  });

  it('round-trips a direction through both coordinate systems', () => {
    for (const [l, b] of [
      [0, 0],
      [45, 20],
      [123.4, -56.7],
      [270, 89],
      [359.9, -89.9],
    ] as const) {
      const found = directionToGalactic(galacticDirection(l, b));

      expect(found.latitudeDeg).toBeCloseTo(b, 9);
      // Longitude is undefined at the poles, so only check it where it means something.
      if (Math.abs(b) < 89) {
        expect((found.longitudeDeg + 360) % 360).toBeCloseTo((l + 360) % 360, 7);
      }
    }
  });

  it('is tilted to the ecliptic by more than the ecliptic is to the equator', () => {
    // A sanity check with an answer anyone can look up: the galactic plane is inclined
    // about 60 degrees to the ecliptic, which is why the Milky Way crosses the zodiac
    // steeply rather than running along it.
    const eclipticPole = { x: 0, y: 0, z: 1 };
    const tilt = separationDeg(GALACTIC_BASIS.z, eclipticPole);

    expect(tilt).toBeGreaterThan(59);
    expect(tilt).toBeLessThan(61);
    expect(tilt).toBeGreaterThan(OBLIQUITY_J2000_DEG);
  });
});
