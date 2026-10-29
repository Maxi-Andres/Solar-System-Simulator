import type { BodyDefinition, BodyId } from '@sss/tools/types';

import type { StateVector, Vec3 } from './vec3.ts';

/**
 * Proxima Centauri's planets (D3c): b and d, confirmed, and c, a candidate still argued
 * over -- each where its radial velocities put it, and each under the conventions those
 * velocities leave open, named as such.
 *
 * ## What is measured
 *
 * The star's wobble gives each planet's period, its minimum mass (m sin i) and, from the
 * star's mass, its distance; and it gives when along the orbit the planet passes in front
 * of the star as we see it -- its conjunction -- to within the fit's error.
 *
 * - **b:** Damasso et al. 2020, Sci. Adv. 6, eaax7467, Table 1: P = 11.185 d and
 *   inferior conjunction at BJD 2,457,897.9 (+0.3/-0.2), from which its place along the
 *   orbit now is known to about a day; a 0.04856 AU and m sin i 1.07 Earth masses from
 *   Faria et al. 2022, A&A 658, A115, Table C.1.
 * - **d:** Faria et al. 2022 Table C.1 (TM, adopted): P 5.122 d, a 0.02885 AU, m sin i
 *   0.26 Earth masses, and its phase as mean anomaly plus argument of periastron at their
 *   first night, 2019-02-10 -- uncertain by two radians either way, so where d is along
 *   its orbit is not really known. Confirmed by Suárez Mascareño et al. 2025 (A&A 700,
 *   A11) per the NASA Exoplanet Archive (queried 2026-10-28).
 * - **c (candidate):** Damasso et al. 2020 Table 1: P 1,900 d, conjunction BJD 2,455,892
 *   (+-101), a 1.48 AU, m sin i 5.8 Earth masses. Not among the Archive's confirmed
 *   planets: its authors themselves leave open that the signal is the star's own
 *   activity, and it is drawn grey and named as a candidate.
 *
 * All three are fitted as circular (b's and c's eccentricity fixed at zero by Damasso et
 * al.; Faria et al.'s for d is 0.04 +0.15/-0.04).
 *
 * ## What is not, and the convention for it
 *
 * None transits, so the tilt of the orbits is unknown, and so is which way across the sky
 * they run. They are drawn **edge-on as seen from the Sun**, the orbit's plane containing
 * our line of sight -- the one tilt at which the minimum mass is the mass -- with the line
 * where it crosses the sky running east-west at Proxima. Conjunction, where the RVs put
 * it, is then the planet straight between Proxima and the Sun.
 */

const AU_KM = 149_597_870.7;
/** Earth's GM, km^3/s^2 (IAU 2015 nominal). */
const GM_EARTH = 398_600.4;
const DAY_S = 86_400;

export type PlanetStatus = 'confirmed' | 'candidate';

export interface ProximaPlanet {
  readonly key: 'b' | 'c' | 'd';
  readonly name: string;
  readonly status: PlanetStatus;
  readonly periodDays: number;
  readonly semiMajorAxisAu: number;
  /** Minimum mass, Earth masses. */
  readonly minimumMassEarth: number;
  /**
   * Where it is along its orbit: at `epochJd` the argument of latitude u -- angle from
   * the ascending node, pi/2 at inferior conjunction (see the header).
   */
  readonly epochJd: number;
  readonly argumentAtEpochRad: number;
  readonly reference: string;
}

export const PROXIMA_PLANETS: readonly ProximaPlanet[] = [
  {
    key: 'd',
    name: 'Proxima Centauri d',
    status: 'confirmed',
    periodDays: 5.122,
    semiMajorAxisAu: 0.02885,
    minimumMassEarth: 0.26,
    // Faria et al. 2022: M0 + omega = 5.5 + 4.0 rad at their first night, 2019-02-10.
    epochJd: 2458524.8,
    argumentAtEpochRad: 5.5 + 4.0,
    reference: 'Faria et al. 2022, A&A 658, A115; confirmed by Suárez Mascareño et al. 2025, A&A 700, A11',
  },
  {
    key: 'b',
    name: 'Proxima Centauri b',
    status: 'confirmed',
    periodDays: 11.185,
    semiMajorAxisAu: 0.04856,
    minimumMassEarth: 1.07,
    // Damasso et al. 2020: inferior conjunction, u = pi/2, at BJD 2,457,897.9.
    epochJd: 2457897.9,
    argumentAtEpochRad: Math.PI / 2,
    reference: 'Anglada-Escudé et al. 2016, Nature 536, 437; Damasso et al. 2020; Faria et al. 2022',
  },
  {
    key: 'c',
    name: 'Proxima Centauri c (candidate)',
    status: 'candidate',
    periodDays: 1900,
    semiMajorAxisAu: 1.48,
    minimumMassEarth: 5.8,
    epochJd: 2455892,
    argumentAtEpochRad: Math.PI / 2,
    reference: 'Damasso et al. 2020, Sci. Adv. 6, eaax7467 (candidate, unconfirmed)',
  },
];

export function proximaPlanetId(key: ProximaPlanet['key']): BodyId {
  return `proxima-${key}`;
}

/** The planets' ids, for telling one from any other body. */
export function proximaPlanetOf(id: BodyId): ProximaPlanet | null {
  return PROXIMA_PLANETS.find((planet) => proximaPlanetId(planet.key) === id) ?? null;
}

/** ICRS north, in the scene frame: the rotation the stars' frame uses (alphaCentauri.ts). */
const NORTH: Vec3 = (() => {
  const eps = (84381.448 / 3600) * (Math.PI / 180);
  return { x: 0, y: Math.sin(eps), z: Math.cos(eps) };
})();

/**
 * A planet's state about Proxima, scene frame, km and km/s: a circle of its semi-major
 * axis, edge-on to the Sun, at its argument of latitude for `jd`. `towardStar` is the unit
 * direction from the Sun to Proxima.
 */
export function planetStateAboutStar(planet: ProximaPlanet, jd: number, towardStar: Vec3): StateVector {
  const away = towardStar;
  // East on the sky at Proxima: north x line of sight, made unit.
  const ex = NORTH.y * away.z - NORTH.z * away.y;
  const ey = NORTH.z * away.x - NORTH.x * away.z;
  const ez = NORTH.x * away.y - NORTH.y * away.x;
  const n = Math.hypot(ex, ey, ez);
  const east = { x: ex / n, y: ey / n, z: ez / n };
  const omega = (2 * Math.PI) / (planet.periodDays * DAY_S);
  const u = planet.argumentAtEpochRad + omega * (jd - planet.epochJd) * DAY_S;
  const a = planet.semiMajorAxisAu * AU_KM;
  // Along the node line a cos u, along our line of sight -a sin u: in front (toward the
  // Sun) at u = pi/2, conjunction.
  const c = Math.cos(u);
  const s = Math.sin(u);
  return {
    position: {
      x: a * (c * east.x - s * away.x),
      y: a * (c * east.y - s * away.y),
      z: a * (c * east.z - s * away.z),
    },
    velocity: {
      x: a * omega * (-s * east.x - c * away.x),
      y: a * omega * (-s * east.y - c * away.y),
      z: a * omega * (-s * east.z - c * away.z),
    },
  };
}

/** The body a planet becomes: a marker, no sphere -- no radius has been measured. */
export function planetBodyDefinition(planet: ProximaPlanet, parent: BodyId): BodyDefinition {
  // A nominal radius, the Earth's, said to be one (radiusPublished false): none of the
  // three transits, so none has a measured radius. It only sets how close the camera may
  // come; the framing is planetFramingKm's.
  const framingRadiusKm = 6371;
  return {
    id: proximaPlanetId(planet.key),
    name: planet.name,
    horizonsId: '',
    center: '',
    elementsCenter: '',
    stepDays: 0,
    vectorWindow: 'full',
    parent,
    kind: 'planet',
    radiusEquatorialKm: framingRadiusKm,
    radiusPolarKm: framingRadiusKm,
    gmKm3S2: planet.minimumMassEarth * GM_EARTH,
    gmBodyOnlyKm3S2: planet.minimumMassEarth * GM_EARTH,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    triaxialRadiiKm: null,
    // A candidate in grey, the confirmed in a pale warm white: the colour says which.
    color: planet.status === 'candidate' ? '#7c7c7c' : '#d8c7a8',
    drawOrbit: true,
    textures: null,
    rings: null,
    mission: null,
    radiusPublished: false,
    shapeDrawn: false,
  };
}

/**
 * Where the camera stands to frame a planet, km from it: five times its orbit's radius,
 * from where the frame's height, 27 degrees, holds the whole circle with the star at its
 * centre -- a planet seen without a disc means nothing without the star it goes round.
 */
export function planetFramingKm(planet: ProximaPlanet): number {
  return 5 * planet.semiMajorAxisAu * AU_KM;
}
