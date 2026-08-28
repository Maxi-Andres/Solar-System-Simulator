import type { BodyDefinition } from '@sss/tools/types';
import * as THREE from 'three';

import { J2000_JD } from '../core/time.ts';
import { cross, dot, length, normalize, vec3, type Vec3 } from '../core/vec3.ts';

/**
 * Where a body's axis points, and which face is turned toward you.
 *
 * Until textures landed, orientation could be faked and nobody could tell: a
 * featureless sphere spinning about an arbitrary axis looks exactly like one spinning
 * about the right axis. It was faked, and wrongly -- the old code tilted the sphere
 * about the scene's z axis while the sphere spun about its local y, which left every
 * pole lying *in* the ecliptic plane rather than near-perpendicular to it. Flat
 * colours hid it completely.
 *
 * The real answer is the IAU rotational elements, carried in the catalog:
 *
 *   - (alpha0, delta0) point the north pole in the ICRF equatorial frame.
 *   - W = W0 + Wdot * d gives the angle from the body's ascending node on the ICRF
 *     equator, east along its own equator, to its prime meridian, with d in days
 *     from J2000 TDB.
 *
 * Everything here converts that into the frame the scene actually uses, which is
 * ecliptic ICRF -- because that is the frame the Horizons vectors arrive in
 * (REF_PLANE='ECLIPTIC'), so scene z is ecliptic north, not equatorial north.
 */

/**
 * Obliquity of the ecliptic at J2000, degrees.
 *
 * IAU 2006 value, 84381.406 arcseconds. This is the single rotation between the frame
 * the IAU pole directions are published in (ICRF equatorial) and the frame the
 * ephemerides and the scene live in (ICRF ecliptic). Getting it wrong tilts every
 * body in the Solar System by 23 degrees in unison, which is the kind of error that
 * looks like a rendering style.
 */
export const OBLIQUITY_J2000_DEG = 23.439291111111111;

const DEG = Math.PI / 180;

/** Days in a Julian century, the unit the IAU periodic terms are expressed in. */
const DAYS_PER_CENTURY = 36525;

/** The IAU elements of a body at one instant, periodic term included. */
export interface IauElements {
  /** Pole right ascension, ICRF equatorial, degrees. */
  readonly raDeg: number;
  /** Pole declination, ICRF equatorial, degrees. */
  readonly decDeg: number;
  /** Prime meridian angle W, degrees, not normalised. */
  readonly wDeg: number;
}

/**
 * The rotational elements at a given instant.
 *
 * Two corrections, both of which looked negligible and are not, and both of which
 * were caught by comparing against JPL rather than by reasoning:
 *
 *   - The linear pole rates, which for Earth are precession. By 2026 they have moved
 *     its pole 0.145 degrees -- ten times the residual of any other body.
 *   - Neptune's periodic term, which offsets its declination by half a degree and
 *     leaves the sub-solar latitude 0.278 degrees out when dropped, against 0.004
 *     when kept.
 *
 * With both in place every body's sub-solar latitude matches JPL's to under 0.03
 * degrees across 2026.
 */
export function iauElementsAt(jdTdb: number, body: BodyDefinition): IauElements {
  const days = jdTdb - J2000_JD;
  const w = body.primeMeridianDeg + body.rotationRateDegPerDay * days;

  const centuries = days / DAYS_PER_CENTURY;
  const raDeg = body.poleRaDeg + body.poleRaRateDegPerCentury * centuries;
  const decDeg = body.poleDecDeg + body.poleDecRateDegPerCentury * centuries;

  const nutation = body.poleNutation;
  if (nutation === null) {
    return { raDeg, decDeg, wDeg: w };
  }

  const n = (nutation.angleDeg + nutation.rateDegPerCentury * centuries) * DEG;
  return {
    raDeg: raDeg + nutation.raSinCoeffDeg * Math.sin(n),
    decDeg: decDeg + nutation.decCosCoeffDeg * Math.cos(n),
    wDeg: w + nutation.wSinCoeffDeg * Math.sin(n),
  };
}

/**
 * Rotates an ICRF equatorial vector into the ICRF ecliptic frame.
 *
 * A single rotation by -epsilon about the shared x axis (the equinox direction).
 */
export function equatorialToEcliptic(v: Vec3): Vec3 {
  const eps = OBLIQUITY_J2000_DEG * DEG;
  const cos = Math.cos(eps);
  const sin = Math.sin(eps);
  return vec3(v.x, v.y * cos + v.z * sin, -v.y * sin + v.z * cos);
}

/**
 * Unit vector toward a body's north pole, in the scene's ecliptic frame.
 *
 * Very nearly fixed in inertial space: a planet's axis keeps pointing the same way as
 * it goes round, which is why the seasons happen and why this is worth getting right.
 * It takes a date only because of Neptune's periodic term, which moves its pole by
 * under a degree over decades.
 */
export function poleDirection(jdTdb: number, body: BodyDefinition): Vec3 {
  const { raDeg, decDeg } = iauElementsAt(jdTdb, body);
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  return equatorialToEcliptic(
    vec3(Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)),
  );
}

/**
 * Unit vector toward the node Q: where the body's equator crosses the ICRF equator.
 *
 * By the IAU definition this sits at right ascension alpha0 + 90 degrees, on the
 * celestial equator. W is measured east from here, so it is the zero point the whole
 * prime-meridian calculation hangs off.
 */
export function nodeDirection(jdTdb: number, body: BodyDefinition): Vec3 {
  const ra = iauElementsAt(jdTdb, body).raDeg * DEG;
  // (cos(alpha0 + 90), sin(alpha0 + 90), 0), expanded.
  return equatorialToEcliptic(vec3(-Math.sin(ra), Math.cos(ra), 0));
}

/**
 * Prime meridian angle W at a given instant, in degrees, not normalised.
 *
 * Left un-normalised on purpose: callers feed it straight into a rotation, and
 * wrapping it would only add a discontinuity where none is needed.
 */
export function primeMeridianAngle(jdTdb: number, body: BodyDefinition): number {
  return iauElementsAt(jdTdb, body).wDeg;
}

/** Rotates `v` about the unit axis `axis` by `angleRad`, right-hand sense. */
function rotateAbout(v: Vec3, axis: Vec3, angleRad: number): Vec3 {
  // Rodrigues' rotation formula.
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const k = dot(axis, v) * (1 - cos);
  const perpendicular = cross(axis, v);
  return vec3(
    v.x * cos + perpendicular.x * sin + axis.x * k,
    v.y * cos + perpendicular.y * sin + axis.y * k,
    v.z * cos + perpendicular.z * sin + axis.z * k,
  );
}

/**
 * Unit vector toward the body's prime meridian at the equator, in the scene frame.
 *
 * The node Q, swung east about the pole by W. For Earth this points at the Greenwich
 * meridian, and it goes round once a sidereal day.
 */
export function primeMeridianDirection(jdTdb: number, body: BodyDefinition): Vec3 {
  return longitudeDirection(jdTdb, body, 0);
}

/**
 * Unit vector toward a given longitude on the body's equator, in the scene frame.
 *
 * The node Q, swung east about the pole by W and then by the longitude. At longitude
 * zero this is the prime meridian, which for Earth points at Greenwich and goes round
 * once a sidereal day.
 */
export function longitudeDirection(
  jdTdb: number,
  body: BodyDefinition,
  longitudeDeg: number,
): Vec3 {
  const pole = poleDirection(jdTdb, body);
  const node = nodeDirection(jdTdb, body);
  const angle = (primeMeridianAngle(jdTdb, body) + longitudeDeg) * DEG;
  return normalize(rotateAbout(node, pole, angle));
}

/**
 * The body's orientation as a quaternion, ready to assign to a mesh.
 *
 * Maps the local frame of a three.js SphereGeometry onto the real one. That geometry
 * puts its poles on local +/-y and wraps the image so that u = 0 -- the LEFT EDGE of
 * the file -- lands on local -x, with u increasing eastward (a right-hand rotation
 * about +y). So the basis is:
 *
 *   local +y  ->  the IAU north pole
 *   local -x  ->  whatever longitude the image starts at
 *   local +z  ->  90 degrees east of that
 *
 * That middle line is the one that bites. It is *not* the prime meridian in general:
 * Solar System Scope centres its maps on Greenwich, so their left edge is longitude
 * 180 W, while NASA's Pluto mosaic starts at 0. Assuming the prime meridian put every
 * SSS body half a turn out -- Earth showed Africa in daylight at a moment when the
 * Pacific should have been lit -- and no amount of self-consistency checking could
 * catch it, because the error lives between our maths and the image, and both halves
 * were internally fine. textureAlignment.test.ts closes that loop by reading the
 * actual pixels.
 *
 * Written as a basis rather than a sequence of Euler angles because there is no
 * ordering to get wrong, and because each column is independently checkable.
 */
export function bodyOrientation(jdTdb: number, body: BodyDefinition): THREE.Quaternion {
  const pole = poleDirection(jdTdb, body);
  const imageStart = longitudeDirection(jdTdb, body, body.textureLongitudeOriginDeg);
  // Right-handed: x cross y = z, and swinging the image's first column 90 degrees
  // east about the pole lands on exactly this.
  const east = cross(pole, imageStart);

  const basis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(-imageStart.x, -imageStart.y, -imageStart.z),
    new THREE.Vector3(pole.x, pole.y, pole.z),
    new THREE.Vector3(east.x, east.y, east.z),
  );
  return new THREE.Quaternion().setFromRotationMatrix(basis);
}

/** A point on a body's surface, as the maps label it. */
export interface Geographic {
  /** Degrees north of the body's equator, -90 to 90. */
  readonly latitudeDeg: number;
  /** Degrees east of the body's prime meridian, -180 to 180. */
  readonly longitudeDeg: number;
}

/**
 * Where a direction in the scene frame lands on the body's surface.
 *
 * The inverse of the orientation above, and the reason it exists is testing: "the Sun
 * is overhead at longitude 0 at local noon" is a claim anyone can check against an
 * almanac, while "this quaternion is correct" is not. The integration tests use it to
 * hold the whole chain -- pole, node, W, obliquity, UV convention -- against
 * measurable facts.
 */
export function directionToGeographic(
  direction: Vec3,
  jdTdb: number,
  body: BodyDefinition,
): Geographic {
  const pole = poleDirection(jdTdb, body);
  const meridian = primeMeridianDirection(jdTdb, body);
  const east = cross(pole, meridian);

  const len = length(direction);
  if (len === 0) {
    return { latitudeDeg: 0, longitudeDeg: 0 };
  }
  const unit = vec3(direction.x / len, direction.y / len, direction.z / len);

  return {
    latitudeDeg: Math.asin(Math.max(-1, Math.min(1, dot(unit, pole)))) / DEG,
    longitudeDeg: Math.atan2(dot(unit, east), dot(unit, meridian)) / DEG,
  };
}

/**
 * The pole a right-hand grip on the body's rotation points at.
 *
 * Not always the IAU north pole, and the difference is a real trap. For planets the
 * IAU picks north by which side of the invariable plane it falls on, so a body that
 * turns backwards gets a negative Wdot about a pole that still points roughly north:
 * Venus and Uranus. The planetary fact sheets instead quote axial tilt against the
 * *rotational* pole, which for those two is the opposite end of the same axis. That is
 * the whole reason Uranus is published at 97.77 degrees while its IAU pole sits 82.28
 * degrees from ecliptic north -- the two numbers are the same axis, described from
 * opposite ends.
 *
 * Rendering uses the IAU pole, because that is the one every published map is drawn
 * against. This function exists so the tilt can still be checked against the figure
 * the fact sheets publish.
 */
export function rotationalPole(jdTdb: number, body: BodyDefinition): Vec3 {
  const pole = poleDirection(jdTdb, body);
  return body.rotationRateDegPerDay >= 0 ? pole : vec3(-pole.x, -pole.y, -pole.z);
}

/**
 * Angle between a body's rotation axis and its orbital angular momentum, in degrees.
 *
 * This is axial tilt as the fact sheets define it, computed from two completely
 * independent sources: the IAU pole, and `r x v` from JPL's own state vectors. They
 * have no reason to agree unless both are right, which makes it the sharpest check
 * available that the pole is not merely plausible -- and it is the check that would
 * have caught the axis this step replaced, which lay in the ecliptic plane.
 */
export function obliquityToOrbit(
  jdTdb: number,
  body: BodyDefinition,
  position: Vec3,
  velocity: Vec3,
): number {
  const orbitNormal = normalize(cross(position, velocity));
  const cosine = dot(rotationalPole(jdTdb, body), orbitNormal);
  return Math.acos(Math.max(-1, Math.min(1, cosine))) / DEG;
}

/**
 * Converts a planetocentric latitude to a planetographic one, in degrees.
 *
 * Two different questions that give the same answer only on a perfect sphere.
 * Planetocentric latitude is the angle at the body's centre; planetographic is the
 * angle the local surface normal makes with the equator, which on a flattened body is
 * larger everywhere but the poles and the equator. Maps and mission products are
 * published planetographic; the geometry here is planetocentric.
 *
 * The gap is not academic. On Saturn it reaches 5.6 degrees, on Neptune 1.0, on Mars
 * 0.34. It is the reason our sub-solar latitude appeared to disagree with JPL's until
 * both were expressed the same way -- and it is worth having as a named function
 * rather than a fudge factor in a test, because the next person to compare a number
 * against a NASA table will hit the same wall.
 */
export function planetographicLatitude(latitudeDeg: number, body: BodyDefinition): number {
  const flatteningSquared = (body.radiusPolarKm / body.radiusEquatorialKm) ** 2;
  return Math.atan2(Math.tan(latitudeDeg * DEG), flatteningSquared) / DEG;
}
