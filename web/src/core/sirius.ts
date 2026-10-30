import { astrometricState, type Astrometry } from './alphaCentauri.ts';
import { skyAxes } from './exoplanets.ts';
import { julianEpochJd, skyOrbitState, type SkyOrbit, type SkyState } from './skyOrbit.ts';
import type { StateVector, Vec3 } from './vec3.ts';

/**
 * Sirius and its white dwarf (D6c): Sirius A and Sirius B on the orbit measured for them,
 * B a sphere of its real size -- 5,630 km in radius, smaller than the Earth, with more
 * mass than the Sun.
 *
 * The catalogue carries Sirius A on a straight line from Hipparcos's 1991 position and
 * motion -- the motion it had then, 0.46"/yr of which was its orbit about the pair's
 * barycentre, three years before periastron. Thirty-five years on that line has left the
 * orbit by arcseconds, AU at 2.6 pc. So, as Alpha Centauri's pair (alphaCentauri.ts),
 * both follow the orbit about a barycentre that moves straight, and the 3D stars that are
 * Sirius A and B are drawn there (orbitingStars.ts) and made bodies at start (siriusBodies.ts).
 *
 * ## Sources
 *
 * - **The orbit of B about A:** Bond et al. 2017, ApJ 840, 70 (arXiv 1703.10625), Table 4,
 *   J2000: P = 50.1284 yr, a = 7.4957", i = 136.336, Omega = 45.400, e = 0.59142, omega =
 *   149.161 degrees, periastron 1994.5715. Read in the visual-binary convention, as the
 *   other orbits here (blackHoles.ts); the paper does not say which node is ascending, so
 *   which of A and B is nearer us along the orbit is the convention's (ascending where B
 *   recedes), not a measurement.
 * - **Masses:** their dynamical masses, A 2.063 and B 1.018 solar masses.
 * - **Distance:** their adopted parallax, 378.9 mas (Hipparcos and the ground, weighted).
 * - **The barycentre:** worked out here, not published: Sirius A's Hipparcos position and
 *   proper motion (van Leeuwen 2007, HIP 32349, J1991.25) less A's own orbital offset and
 *   motion at that epoch -- the proper motion taken as A's instantaneous one there: the
 *   mission's mean over three years about that epoch, in which A's acceleration cancels to
 *   first order. Its radial velocity is Bond et al.'s system velocity corrected for A's
 *   gravitational redshift, -8.47 km/s.
 * - **The stars:** A 1.7144 solar radii and 9,845 K (Davis et al. 2011, at Bond et al.'s
 *   parallax); B 0.008098 solar radii and 25,369 K from HST spectra (Bond et al. 2017). Each
 *   is drawn in the colour its 3D star's photometry gives, as every star is.
 */

const DEG = Math.PI / 180;
const AU_KM = 149_597_870.7;

export const SIRIUS_A_MASS_SUN = 2.063;
export const SIRIUS_B_MASS_SUN = 1.018;
export const SIRIUS_A_RADIUS_SUN = 1.7144;
export const SIRIUS_B_RADIUS_SUN = 0.008098;
export const SIRIUS_A_TEMPERATURE_K = 9845;
export const SIRIUS_B_TEMPERATURE_K = 25_369;
export const SIRIUS_PARALLAX_MAS = 378.9;
export const SIRIUS_REFERENCE = 'Bond et al. 2017, ApJ 840, 70';

/** Bond et al. 2017 Table 4: B about A. */
export const SIRIUS_ORBIT = {
  periodYears: 50.1284,
  semiMajorAxisArcsec: 7.4957,
  inclinationDeg: 136.336,
  nodeDeg: 45.4,
  periastronYear: 1994.5715,
  eccentricity: 0.59142,
  argPeriastronDeg: 149.161,
} as const;

/** Sirius A, Hipparcos new reduction (van Leeuwen 2007), HIP 32349, at J1991.25. */
export const SIRIUS_A_HIPPARCOS = {
  raDeg: 101.2885410520664,
  decDeg: -16.713143062644765,
  pmRaMasPerYear: -546.01,
  pmDecMasPerYear: -1223.07,
  epochJd: julianEpochJd(1991.25),
} as const;

/** The system's radial velocity, km/s: Bond et al.'s, less A's gravitational redshift. */
export const SIRIUS_SYSTEM_RADIAL_KM_S = -8.47;

export const SIRIUS_TOTAL_MASS_SUN = SIRIUS_A_MASS_SUN + SIRIUS_B_MASS_SUN;
const FRACTION_B = SIRIUS_B_MASS_SUN / SIRIUS_TOTAL_MASS_SUN;

/** B about A in kilometres: the angle at the system's distance. */
export const SIRIUS_SKY_ORBIT: SkyOrbit = {
  semiMajorAxisKm: (SIRIUS_ORBIT.semiMajorAxisArcsec / (SIRIUS_PARALLAX_MAS / 1000)) * AU_KM,
  eccentricity: SIRIUS_ORBIT.eccentricity,
  inclinationDeg: SIRIUS_ORBIT.inclinationDeg,
  nodeDeg: SIRIUS_ORBIT.nodeDeg,
  argPeriastronDeg: SIRIUS_ORBIT.argPeriastronDeg,
  periastronJd: julianEpochJd(SIRIUS_ORBIT.periastronYear),
  periodDays: SIRIUS_ORBIT.periodYears * 365.25,
};

/** The direction to Sirius at 1991.25: the sky's axes the orbit is laid on. */
const TOWARD: Vec3 = (() => {
  const p = astrometricState({
    ...SIRIUS_A_HIPPARCOS,
    parallaxMas: SIRIUS_PARALLAX_MAS,
    radialVelocityKmS: 0,
  }).position;
  const n = Math.hypot(p.x, p.y, p.z);
  return { x: p.x / n, y: p.y / n, z: p.z / n };
})();
const AXES = skyAxes(TOWARD);

function onAxes(v: { east: number; north: number; away: number }): Vec3 {
  return {
    x: v.east * AXES.east.x + v.north * AXES.north.x + v.away * AXES.away.x,
    y: v.east * AXES.east.y + v.north * AXES.north.y + v.away * AXES.away.y,
    z: v.east * AXES.east.z + v.north * AXES.north.z + v.away * AXES.away.z,
  };
}

/** B about A, scene frame, km and km/s. */
export function siriusRelativeState(jd: number): StateVector {
  const sky: SkyState = skyOrbitState(SIRIUS_SKY_ORBIT, jd);
  return { position: onAxes(sky.position), velocity: onAxes(sky.velocity) };
}

/** The barycentre at 1991.25 and its velocity: A's Hipparcos state less A's orbit then. */
const BARYCENTRE: StateVector = (() => {
  const atEpoch = siriusRelativeState(SIRIUS_A_HIPPARCOS.epochJd);
  // A's own orbital motion along the line of sight then, so the barycentre's is the system's.
  const aAway = -FRACTION_B * skyOrbitState(SIRIUS_SKY_ORBIT, SIRIUS_A_HIPPARCOS.epochJd).velocity.away;
  const entry: Astrometry = {
    ...SIRIUS_A_HIPPARCOS,
    parallaxMas: SIRIUS_PARALLAX_MAS,
    radialVelocityKmS: SIRIUS_SYSTEM_RADIAL_KM_S + aAway,
  };
  const a = astrometricState(entry);
  return {
    position: {
      x: a.position.x + FRACTION_B * atEpoch.position.x,
      y: a.position.y + FRACTION_B * atEpoch.position.y,
      z: a.position.z + FRACTION_B * atEpoch.position.z,
    },
    velocity: {
      x: a.velocity.x + FRACTION_B * atEpoch.velocity.x,
      y: a.velocity.y + FRACTION_B * atEpoch.velocity.y,
      z: a.velocity.z + FRACTION_B * atEpoch.velocity.z,
    },
  };
})();

/** The barycentre about the Sun, scene frame, km and km/s: a straight line. */
export function siriusBarycentreState(jd: number): StateVector {
  const seconds = (jd - SIRIUS_A_HIPPARCOS.epochJd) * 86_400;
  const { position: p, velocity: v } = BARYCENTRE;
  return {
    position: { x: p.x + v.x * seconds, y: p.y + v.y * seconds, z: p.z + v.z * seconds },
    velocity: v,
  };
}

/** Sirius A about the Sun: the barycentre, less B's share of the relative orbit. */
export function siriusAState(jd: number): StateVector {
  const bary = siriusBarycentreState(jd);
  const rel = siriusRelativeState(jd);
  return {
    position: {
      x: bary.position.x - FRACTION_B * rel.position.x,
      y: bary.position.y - FRACTION_B * rel.position.y,
      z: bary.position.z - FRACTION_B * rel.position.z,
    },
    velocity: {
      x: bary.velocity.x - FRACTION_B * rel.velocity.x,
      y: bary.velocity.y - FRACTION_B * rel.velocity.y,
      z: bary.velocity.z - FRACTION_B * rel.velocity.z,
    },
  };
}

/** Sirius B about the Sun: the barycentre, plus A's share of the relative orbit. */
export function siriusBState(jd: number): StateVector {
  const bary = siriusBarycentreState(jd);
  const rel = siriusRelativeState(jd);
  const share = 1 - FRACTION_B;
  return {
    position: {
      x: bary.position.x + share * rel.position.x,
      y: bary.position.y + share * rel.position.y,
      z: bary.position.z + share * rel.position.z,
    },
    velocity: {
      x: bary.velocity.x + share * rel.velocity.x,
      y: bary.velocity.y + share * rel.velocity.y,
      z: bary.velocity.z + share * rel.velocity.z,
    },
  };
}

/** B's orbit about A, km, scene frame: `segments` steps evenly spaced in eccentric anomaly. */
export function siriusRelativePolylineKm(segments = 512): Vec3[] {
  const o = SIRIUS_SKY_ORBIT;
  const points: Vec3[] = [];
  for (let k = 0; k <= segments; k += 1) {
    const E = (k / segments) * 2 * Math.PI;
    const jd = o.periastronJd + (o.periodDays * (E - o.eccentricity * Math.sin(E))) / (2 * Math.PI);
    points.push(siriusRelativeState(jd).position);
  }
  return points;
}

/** B's share of the pair's mass: A's orbit is -this of the relative one, B's 1 - this. */
export const SIRIUS_FRACTION_B = FRACTION_B;

/** For the tests and the panel: the angle B is from A on the sky at `jd`, arcseconds. */
export function siriusSeparationArcsec(jd: number): number {
  const sky = skyOrbitState(SIRIUS_SKY_ORBIT, jd).position;
  return (Math.hypot(sky.east, sky.north) / AU_KM) * (SIRIUS_PARALLAX_MAS / 1000);
}

/** Its position angle, degrees east of north. */
export function siriusPositionAngleDeg(jd: number): number {
  const sky = skyOrbitState(SIRIUS_SKY_ORBIT, jd).position;
  return ((Math.atan2(sky.east, sky.north) / DEG) % 360 + 360) % 360;
}
