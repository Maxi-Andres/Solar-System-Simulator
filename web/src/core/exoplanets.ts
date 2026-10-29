import type { BodyDefinition, BodyId } from '@sss/tools/types';

import { solveKepler } from './kepler.ts';
import { J2000_JD } from './time.ts';
import type { StateVector, Vec3 } from './vec3.ts';

/**
 * Planets of other stars (D3c, D4a): each on the orbit its discoverers fitted, and under
 * stated conventions for whatever the fit leaves open. The data are in proximaPlanets.ts
 * and planetarySystems.ts; this is what they have in common.
 *
 * ## What a fit gives, and what it does not
 *
 * A planet found by its star's wobble (radial velocities) gives its period, its distance
 * (from the star's mass), its eccentricity, and when along the orbit it passes in front of
 * the star as we see it -- its inferior conjunction -- usually to within days. It gives its
 * minimum mass, m sin i, and not the tilt i, nor which way the orbit runs across the sky
 * (the position angle of its ascending node). A few planets have more: a tilt from the
 * star's motion on the sky (astrometry), or from the planet's own light.
 *
 * ## Conventions, where nothing was measured
 *
 * - **Tilt unknown:** the orbit is drawn **edge-on as seen from the Sun**, its plane holding
 *   our line of sight -- the one tilt at which the minimum mass is the mass.
 * - **Node unknown:** the line where the orbit crosses the sky runs **east-west** at the star.
 * - **Phase unknown:** the planet is at periastron at J2000.0 -- a stand-in, said so.
 *
 * ## Frame
 *
 * The sky's axes at the star: east, north, and away from us. The position follows the
 * visual-binary convention (Thiele-Innes; as alphaCentauri.ts's AB orbit): with u the
 * argument of latitude, north = r (cos u cos node - sin u sin node cos i), east = r (cos u
 * sin node + sin u cos node cos i), away = r sin u sin i. The ascending node is where the
 * planet moves away from us, and inferior conjunction -- the planet straight between the
 * star and the Sun -- is u = -90 degrees.
 */

const AU_KM = 149_597_870.7;
const DAY_S = 86_400;
const DEG = Math.PI / 180;
/** Earth's GM, km^3/s^2 (IAU 2015 nominal). */
export const GM_EARTH = 398_600.4;

/**
 * - confirmed: in the NASA Exoplanet Archive's confirmed planets, unflagged.
 * - disputed: in the Archive, but with its controversy flag set -- published, and argued over.
 * - candidate: not in the Archive's confirmed planets at all.
 */
export type PlanetStatus = 'confirmed' | 'disputed' | 'candidate';

/** Where along its orbit a planet is: from when it was last in front of its star, or unknown. */
export type PlanetPhase =
  /** Inferior conjunction at `jd`. */
  | { readonly kind: 'conjunction'; readonly jd: number }
  /** At `jd`, `rad` of mean anomaly past inferior conjunction. */
  | { readonly kind: 'pastConjunction'; readonly jd: number; readonly rad: number }
  | { readonly kind: 'unknown' };

export interface ExoPlanet {
  readonly id: BodyId;
  readonly name: string;
  readonly status: PlanetStatus;
  readonly periodDays: number;
  readonly semiMajorAxisAu: number;
  readonly eccentricity: number;
  /** The planet's argument of periastron from the ascending node, degrees; 0 for a circle. */
  readonly argPeriastronDeg: number;
  /** Earth masses: the minimum mass m sin i, unless the tilt is measured. */
  readonly massEarth: number;
  readonly massIsMinimum: boolean;
  readonly phase: PlanetPhase;
  /** Measured tilt to the sky, degrees; null where it is not (drawn edge-on). */
  readonly inclinationDeg: number | null;
  /** Measured position angle of the ascending node, degrees east of north; null if not. */
  readonly nodeDeg: number | null;
  readonly reference: string;
}

/** Edge-on and an east-west node: the conventions for what is not measured (see the header). */
const EDGE_ON_DEG = 90;
const EAST_WEST_NODE_DEG = 90;

/** ICRS north, in the scene frame: the rotation the stars' frame uses (alphaCentauri.ts). */
const NORTH: Vec3 = (() => {
  const eps = (84381.448 / 3600) * DEG;
  return { x: 0, y: Math.sin(eps), z: Math.cos(eps) };
})();

/** The sky's axes at a star, scene frame, from the unit direction from the Sun to it. */
export function skyAxes(towardStar: Vec3): { east: Vec3; north: Vec3; away: Vec3 } {
  const away = towardStar;
  const ex = NORTH.y * away.z - NORTH.z * away.y;
  const ey = NORTH.z * away.x - NORTH.x * away.z;
  const ez = NORTH.x * away.y - NORTH.y * away.x;
  const n = Math.hypot(ex, ey, ez);
  const east = { x: ex / n, y: ey / n, z: ez / n };
  const north = {
    x: away.y * east.z - away.z * east.y,
    y: away.z * east.x - away.x * east.z,
    z: away.x * east.y - away.y * east.x,
  };
  return { east, north, away };
}

/** The mean anomaly at inferior conjunction, where u = -90 degrees. */
function conjunctionMeanAnomaly(planet: ExoPlanet): number {
  const e = planet.eccentricity;
  const f = -Math.PI / 2 - planet.argPeriastronDeg * DEG;
  const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(f / 2), Math.sqrt(1 + e) * Math.cos(f / 2));
  return E - e * Math.sin(E);
}

/** The mean anomaly at `jd`, radians. */
export function meanAnomalyOf(planet: ExoPlanet, jd: number): number {
  const n = (2 * Math.PI) / planet.periodDays;
  const phase = planet.phase;
  if (phase.kind === 'unknown') {
    return n * (jd - J2000_JD);
  }
  const atConjunction = conjunctionMeanAnomaly(planet);
  const past = phase.kind === 'pastConjunction' ? phase.rad : 0;
  return atConjunction + past + n * (jd - phase.jd);
}

/** Where a planet is about its star on the sky's axes, km: east, north and away from us. */
export function skyOffsetKm(planet: ExoPlanet, jd: number): { east: number; north: number; away: number } {
  const e = planet.eccentricity;
  const E = solveKepler(meanAnomalyOf(planet, jd), e);
  const f = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = planet.semiMajorAxisAu * AU_KM * (1 - e * Math.cos(E));
  const u = f + planet.argPeriastronDeg * DEG;
  const node = (planet.nodeDeg ?? EAST_WEST_NODE_DEG) * DEG;
  const i = (planet.inclinationDeg ?? EDGE_ON_DEG) * DEG;
  return {
    north: r * (Math.cos(u) * Math.cos(node) - Math.sin(u) * Math.sin(node) * Math.cos(i)),
    east: r * (Math.cos(u) * Math.sin(node) + Math.sin(u) * Math.cos(node) * Math.cos(i)),
    away: r * Math.sin(u) * Math.sin(i),
  };
}

/**
 * A planet's state about its star, scene frame, km and km/s. `towardStar` is the unit
 * direction from the Sun to the star, fixed: a nearby star's direction moves arcseconds a
 * year, nothing to an orbit's tilt. Velocity by a central difference over a ten-thousandth
 * of the period, good to a part in 10^7.
 */
export function planetStateAboutStar(planet: ExoPlanet, jd: number, towardStar: Vec3): StateVector {
  const axes = skyAxes(towardStar);
  const at = (t: number): Vec3 => {
    const o = skyOffsetKm(planet, t);
    return {
      x: o.east * axes.east.x + o.north * axes.north.x + o.away * axes.away.x,
      y: o.east * axes.east.y + o.north * axes.north.y + o.away * axes.away.y,
      z: o.east * axes.east.z + o.north * axes.north.z + o.away * axes.away.z,
    };
  };
  const h = planet.periodDays * 1e-4;
  const before = at(jd - h);
  const after = at(jd + h);
  const seconds = 2 * h * DAY_S;
  return {
    position: at(jd),
    velocity: {
      x: (after.x - before.x) / seconds,
      y: (after.y - before.y) / seconds,
      z: (after.z - before.z) / seconds,
    },
  };
}

/** The body a planet becomes: a marker, no sphere -- none of these has a measured radius. */
export function planetBodyDefinition(planet: ExoPlanet, parent: BodyId): BodyDefinition {
  // A nominal radius, the Earth's, said to be one (radiusPublished false): it only sets
  // how close the camera may come; the framing is planetFramingKm's.
  const framingRadiusKm = 6371;
  return {
    id: planet.id,
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
    gmKm3S2: planet.massEarth * GM_EARTH,
    gmBodyOnlyKm3S2: planet.massEarth * GM_EARTH,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    triaxialRadiiKm: null,
    // Grey for what is argued over or unconfirmed, a pale warm white for the confirmed:
    // the colour says which.
    color: planet.status === 'confirmed' ? '#d8c7a8' : '#7c7c7c',
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
 * from where the frame's height, 27 degrees, holds the whole orbit with the star at its
 * centre -- a planet seen without a disc means nothing without the star it goes round.
 */
export function planetFramingKm(planet: ExoPlanet): number {
  return 5 * planet.semiMajorAxisAu * (1 + planet.eccentricity) * AU_KM;
}

/**
 * A view from `tiltDeg` off an orbit's pole, so the orbit reads as the ellipse it is; with
 * up square to it. A direction from the focus to the camera and an up, as the store's
 * framing request takes them.
 */
export function viewOffPole(
  pole: Vec3,
  tiltDeg: number,
): { readonly direction: readonly [number, number, number]; readonly up: readonly [number, number, number] } {
  // Any direction not along the pole, made square to it: the in-plane axis to tilt toward.
  const seed = Math.abs(pole.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  const along = seed.x * pole.x + seed.y * pole.y + seed.z * pole.z;
  const inPlaneRaw = { x: seed.x - along * pole.x, y: seed.y - along * pole.y, z: seed.z - along * pole.z };
  const n = Math.hypot(inPlaneRaw.x, inPlaneRaw.y, inPlaneRaw.z);
  const inPlane = { x: inPlaneRaw.x / n, y: inPlaneRaw.y / n, z: inPlaneRaw.z / n };
  const tilt = tiltDeg * DEG;
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  return {
    direction: [pole.x * c - inPlane.x * s, pole.y * c - inPlane.y * s, pole.z * c - inPlane.z * s],
    up: [inPlane.x * c + pole.x * s, inPlane.y * c + pole.y * s, inPlane.z * c + pole.z * s],
  };
}

/** A planet's orbital pole, scene frame, unit: the way its angular momentum points. */
export function orbitPole(planet: ExoPlanet, towardStar: Vec3, jd: number): Vec3 {
  const { position: r, velocity: v } = planetStateAboutStar(planet, jd, towardStar);
  const h = { x: r.y * v.z - r.z * v.y, y: r.z * v.x - r.x * v.z, z: r.x * v.y - r.y * v.x };
  const n = Math.hypot(h.x, h.y, h.z);
  return { x: h.x / n, y: h.y / n, z: h.z / n };
}
