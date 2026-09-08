import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { CATALOG, getBody } from '@sss/tools/catalog';
import { J2000_JD } from '../core/time.ts';
import { dot, length, vec3 } from '../core/vec3.ts';
import {
  bodyOrientation,
  directionToGeographic,
  longitudeDirection,
  equatorialToEcliptic,
  nodeDirection,
  OBLIQUITY_J2000_DEG,
  poleDirection,
  primeMeridianAngle,
  primeMeridianDirection,
} from './orientation.ts';

const earth = getBody('earth');
const venus = getBody('venus');
const uranus = getBody('uranus');
const mercury = getBody('mercury');

/** Where Earth's illustrative map starts, which is what the orientation is built on. */
const earthOrigin = earth.textures.illustrative.longitudeOriginDeg;

/** Angle between two vectors, degrees. */
function angleBetween(a: { x: number; y: number; z: number }, b: typeof a): number {
  const cos = dot(a, b) / (length(a) * length(b));
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

describe('equatorialToEcliptic', () => {
  it('leaves the equinox direction alone, since it is the rotation axis', () => {
    const x = equatorialToEcliptic(vec3(1, 0, 0));

    expect(x.x).toBeCloseTo(1, 12);
    expect(x.y).toBeCloseTo(0, 12);
    expect(x.z).toBeCloseTo(0, 12);
  });

  it('tilts the celestial pole by the obliquity, and no more', () => {
    const celestialPole = equatorialToEcliptic(vec3(0, 0, 1));

    expect(angleBetween(celestialPole, vec3(0, 0, 1))).toBeCloseTo(OBLIQUITY_J2000_DEG, 9);
  });

  it('preserves length, because it is a rotation', () => {
    const rotated = equatorialToEcliptic(vec3(3, -4, 12));

    expect(length(rotated)).toBeCloseTo(13, 12);
  });
});

describe('poleDirection', () => {
  it("puts Earth's pole 23.44 degrees from ecliptic north", () => {
    // Earth's IAU pole is the celestial pole by definition, so this is the obliquity.
    const pole = poleDirection(J2000_JD, earth);

    expect(angleBetween(pole, vec3(0, 0, 1))).toBeCloseTo(OBLIQUITY_J2000_DEG, 6);
  });

  it('returns unit vectors', () => {
    for (const body of CATALOG) {
      expect(length(poleDirection(J2000_JD, body))).toBeCloseTo(1, 12);
    }
  });

  it('lays Uranus almost in the ecliptic plane', () => {
    // Famously tipped on its side. Note this comes out at 82 degrees, not the 98 the
    // fact sheets publish: the IAU north pole and the rotational pole are opposite
    // ends of the same axis here. See rotationalPole().
    const pole = poleDirection(J2000_JD, uranus);
    const fromEclipticNorth = angleBetween(pole, vec3(0, 0, 1));

    expect(fromEclipticNorth).toBeCloseTo(82.28, 1);
    expect(180 - fromEclipticNorth).toBeCloseTo(uranus.axialTiltDeg, 0);
  });

  it('points Mercury straight up out of its own orbit', () => {
    // Mercury's axial tilt is 0.034 degrees, so its pole should sit almost exactly at
    // its orbital inclination of 7.0 degrees from ecliptic north. It does, to three
    // decimals -- which is a check on the obliquity rotation, not just on Mercury.
    const pole = poleDirection(J2000_JD, mercury);

    expect(angleBetween(pole, vec3(0, 0, 1))).toBeCloseTo(7.037, 2);
  });

  it('holds an axis still when the report gives it no rate at all', () => {
    // The whole reason seasons exist: the axis must not follow the orbit round.
    const fixed = CATALOG.filter(
      (body) =>
        body.poleNutation === null &&
        body.poleRaRateDegPerCentury === 0 &&
        body.poleDecRateDegPerCentury === 0,
    );
    expect(fixed.map((body) => body.id)).toEqual(['sun', 'venus', 'uranus', 'pluto']);

    for (const body of fixed) {
      expect(poleDirection(J2000_JD, body)).toEqual(poleDirection(J2000_JD + 36525, body));
    }
  });

  it('precesses the rest slowly, Earth fastest', () => {
    // Earth's axis traces its 26,000-year circle at about 0.85 degrees a century.
    // Small per year, and by 2026 it is already ten times larger than any other
    // error in the comparison against JPL -- which is how it was found.
    const drift = (body: typeof earth, days: number) =>
      angleBetween(poleDirection(J2000_JD, body), poleDirection(J2000_JD + days, body));

    // 0.557 deg/century, which is the 50.3 arcsec/yr of general precession projected
    // onto the pole by sin(23.44 deg). The RA rate contributes nothing: right
    // ascension is degenerate at declination 90.
    expect(drift(earth, 36525)).toBeCloseTo(0.557, 3);
    // And 0.145 deg by 2026 -- the exact residual that exposed the omission.
    expect(drift(earth, 26 * 365.25)).toBeCloseTo(0.145, 2);
    expect(drift(mercury, 36525)).toBeLessThan(0.05);
  });

  it("moves Neptune's pole, slowly, and no other", () => {
    // Its periodic term runs at 52.3 degrees per century, so a full cycle takes
    // nearly seven hundred years. Over that it swings the pole about a degree; across
    // this project's twenty-year window it barely moves at all.
    //
    // Which is the point worth understanding: the term matters not because it varies
    // but because of its *value*. It offsets Neptune's declination by half a degree
    // and stays there, and that offset is the 0.28 degrees of sub-solar latitude the
    // constant-only version was missing.
    const neptune = getBody('neptune');
    const overCenturies = angleBetween(
      poleDirection(J2000_JD, neptune),
      poleDirection(J2000_JD + 344 * 365.25, neptune),
    );
    const overOurWindow = angleBetween(
      poleDirection(J2000_JD + 9500, neptune),
      poleDirection(J2000_JD + 16800, neptune),
    );

    expect(overCenturies).toBeGreaterThan(0.5);
    expect(overCenturies).toBeLessThan(2);
    // 0.093 degrees across the twenty years, against a standing offset of 0.51.
    expect(overOurWindow).toBeLessThan(0.1);
  });
});

describe('nodeDirection', () => {
  it('is perpendicular to the pole, as a node on the equator must be', () => {
    for (const body of CATALOG) {
      const pole = poleDirection(J2000_JD, body);
      const node = nodeDirection(J2000_JD, body);

      expect(dot(pole, node)).toBeCloseTo(0, 12);
      expect(length(node)).toBeCloseTo(1, 12);
    }
  });
});

describe('primeMeridianAngle', () => {
  it('is W0 at J2000', () => {
    expect(primeMeridianAngle(J2000_JD, earth)).toBeCloseTo(earth.primeMeridianDeg, 12);
  });

  it('advances 360 degrees in one sidereal day for Earth', () => {
    const period = 360 / earth.rotationRateDegPerDay;
    const turn =
      primeMeridianAngle(J2000_JD + period, earth) - primeMeridianAngle(J2000_JD, earth);

    // 1e-8 rather than 1e-9: a Julian day near 2.45e6 has no more to give.
    expect(turn).toBeCloseTo(360, 7);
    // 23h 56m 4s, not 24 hours -- and it lands 6 milliseconds from the period the
    // fact sheets publish, which is two independent sources agreeing, not a bug.
    const hours = period * 24;
    expect(hours).toBeCloseTo(23.9345, 4);
    expect(Math.abs(hours - earth.rotationPeriodHours) * 3600).toBeLessThan(0.01);
  });

  it('runs backwards for Venus', () => {
    expect(primeMeridianAngle(J2000_JD + 100, venus)).toBeLessThan(
      primeMeridianAngle(J2000_JD, venus),
    );
  });
});

describe('bodyOrientation', () => {
  it("maps the sphere's axes onto the pole and the image's first column", () => {
    // three.js SphereGeometry: local +y is the north pole and local -x carries u = 0.
    // u = 0 is the LEFT EDGE OF THE FILE, which is not the prime meridian unless the
    // map happens to start there -- Earth's does not. Assuming it did is what drew
    // every Solar System Scope body half a turn out.
    const jd = J2000_JD + 1234.5;
    const quaternion = bodyOrientation(jd, earth, earthOrigin);
    const pole = poleDirection(jd, earth);
    const imageStart = longitudeDirection(jd, earth, earthOrigin);
    const meridian = primeMeridianDirection(jd, earth);

    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    const zero = new THREE.Vector3(-1, 0, 0).applyQuaternion(quaternion);

    // Not exact to the last bit: the directions go through a Rodrigues rotation and
    // the basis through a quaternion, so they agree to a millionth of a degree.
    expect(angleBetween(up, pole)).toBeLessThan(1e-5);
    expect(angleBetween(zero, imageStart)).toBeLessThan(1e-5);
    // And explicitly: for Earth those two are half a turn apart.
    expect(angleBetween(zero, meridian)).toBeCloseTo(180, 4);
  });

  it('starts Pluto at its prime meridian, unlike the rest', () => {
    // The one map from NASA rather than Solar System Scope, and the one that does
    // begin at longitude zero. If a future body copies the wrong neighbour, this and
    // textureAlignment.test.ts both notice.
    const jd = J2000_JD + 1234.5;
    const pluto = getBody('pluto');
    const zero = new THREE.Vector3(-1, 0, 0).applyQuaternion(bodyOrientation(jd, pluto, pluto.textures.illustrative.longitudeOriginDeg));

    expect(angleBetween(zero, primeMeridianDirection(jd, pluto))).toBeLessThan(1e-5);
  });

  it('is a pure rotation: no scaling, no reflection', () => {
    for (const body of CATALOG) {
      const quaternion = bodyOrientation(J2000_JD + 4000, body, body.textures.illustrative.longitudeOriginDeg);
      const basis = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);

      expect(quaternion.length()).toBeCloseTo(1, 12);
      // A reflection would flip east and west, mirroring every map.
      expect(basis.determinant()).toBeCloseTo(1, 12);
    }
  });

  it('turns the body about its axis while the axis barely moves', () => {
    const halfDay = 0.5;
    const before = bodyOrientation(J2000_JD, earth, earthOrigin);
    const after = bodyOrientation(J2000_JD + halfDay, earth, earthOrigin);

    const poleBefore = new THREE.Vector3(0, 1, 0).applyQuaternion(before);
    const poleAfter = new THREE.Vector3(0, 1, 0).applyQuaternion(after);
    const meridianBefore = new THREE.Vector3(-1, 0, 0).applyQuaternion(before);
    const meridianAfter = new THREE.Vector3(-1, 0, 0).applyQuaternion(after);

    // Half a sidereal day turns the prime meridian most of the way round...
    expect(angleBetween(meridianBefore, meridianAfter)).toBeGreaterThan(179);
    // ...while precession moves the axis by under a hundred-thousandth of a degree.
    expect(angleBetween(poleBefore, poleAfter)).toBeLessThan(1e-5);
    expect(angleBetween(poleBefore, poleDirection(J2000_JD, earth))).toBeCloseTo(0, 9);
  });
});

describe('directionToGeographic', () => {
  it('inverts longitudeDirection exactly', () => {
    const jd = J2000_JD + 987.65;

    // Build surface points from real geography -- not from the mesh's local frame,
    // which is anchored to wherever the image starts rather than to longitude zero.
    for (const [latitudeDeg, longitudeDeg] of [
      [0, 0],
      [51.48, -0.0] /* Greenwich */,
      [-33.45, -70.67] /* Santiago */,
      [40.71, -74.01] /* New York */,
      [35.68, 139.69] /* Tokyo */,
      [-90, 25],
    ] as const) {
      const lat = (latitudeDeg * Math.PI) / 180;
      const alongMeridian = longitudeDirection(jd, earth, longitudeDeg);
      const pole = poleDirection(jd, earth);
      const direction = vec3(
        alongMeridian.x * Math.cos(lat) + pole.x * Math.sin(lat),
        alongMeridian.y * Math.cos(lat) + pole.y * Math.sin(lat),
        alongMeridian.z * Math.cos(lat) + pole.z * Math.sin(lat),
      );

      const back = directionToGeographic(direction, jd, earth);

      if (Math.abs(latitudeDeg) < 89.9) {
        expect(back.latitudeDeg).toBeCloseTo(latitudeDeg, 8);
        expect(back.longitudeDeg).toBeCloseTo(longitudeDeg, 8);
      } else {
        // asin has an infinite derivative at the poles, so the last few digits go.
        // Longitude is meaningless there anyway.
        expect(back.latitudeDeg).toBeCloseTo(latitudeDeg, 5);
      }
    }
  });

  it('reports the pole as latitude 90', () => {
    const pole = poleDirection(J2000_JD, earth);

    expect(directionToGeographic(pole, J2000_JD, earth).latitudeDeg).toBeCloseTo(90, 9);
  });

  it('sweeps longitude westward as the body turns east under a fixed direction', () => {
    // Standing still in inertial space while Earth rotates east beneath you, your
    // longitude decreases. If this came out increasing, every map would be mirrored.
    const fixed = vec3(1, 0, 0);
    const first = directionToGeographic(fixed, J2000_JD, earth).longitudeDeg;
    const second = directionToGeographic(fixed, J2000_JD + 0.01, earth).longitudeDeg;
    const delta = ((second - first + 540) % 360) - 180;

    expect(delta).toBeCloseTo(-earth.rotationRateDegPerDay * 0.01, 6);
  });
});

describe('the catalog agrees with itself', () => {
  it('derives the same rotation period from W as from the fact sheets', () => {
    for (const body of CATALOG) {
      const fromRate = Math.abs(360 / body.rotationRateDegPerDay) * 24;
      const fromSheet = Math.abs(body.rotationPeriodHours);

      // The two sources are independent, so they agree to their own precision
      // rather than exactly: Mercury is the worst at 0.007%.
      expect(Math.abs(fromRate - fromSheet) / fromSheet).toBeLessThan(0.0005);
    }
  });

  it('keeps Venus and Uranus retrograde in both conventions', () => {
    expect(venus.rotationRateDegPerDay).toBeLessThan(0);
    expect(venus.rotationPeriodHours).toBeLessThan(0);
    expect(uranus.rotationRateDegPerDay).toBeLessThan(0);
    expect(uranus.rotationPeriodHours).toBeLessThan(0);
  });

  it('lets Pluto disagree with itself, because the two conventions differ', () => {
    // Not an oversight. For dwarf planets the IAU uses the positive pole from the
    // right-hand rule, so W always increases; the fact sheets call Pluto retrograde
    // because its 122.5 degree obliquity tips the axis past its orbit normal. Both
    // describe the same rotation. Pinned here so nobody "fixes" it.
    const pluto = getBody('pluto');

    expect(pluto.rotationRateDegPerDay).toBeGreaterThan(0);
    expect(pluto.rotationPeriodHours).toBeLessThan(0);
    expect(pluto.axialTiltDeg).toBeGreaterThan(90);
  });

  it('gives every body a pole on the celestial sphere', () => {
    for (const body of CATALOG) {
      expect(body.poleRaDeg).toBeGreaterThanOrEqual(0);
      expect(body.poleRaDeg).toBeLessThan(360);
      expect(Math.abs(body.poleDecDeg)).toBeLessThanOrEqual(90);
      expect(body.primeMeridianDeg).toBeGreaterThanOrEqual(0);
      expect(body.primeMeridianDeg).toBeLessThan(360);
    }
  });
});
