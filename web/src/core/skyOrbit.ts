import { solveKepler } from './kepler.ts';
import { DAYS_PER_JULIAN_YEAR, J2000_JD } from './time.ts';

/**
 * Orbits as they lie on the sky: the visual-binary elements read through the Thiele-Innes
 * constants, for the binaries placed from their papers -- the black holes' stars
 * (blackHoles.ts) and Sirius (sirius.ts). Taken out of blackHoles.ts so a module both import
 * needs neither.
 */

const DEG = Math.PI / 180;
const DAY_S = 86_400;

/** Julian day of a Julian-year epoch: 2015.0 is JD 2,457,023.75. */
export function julianEpochJd(year: number): number {
  return J2000_JD + (year - 2000) * DAYS_PER_JULIAN_YEAR;
}

/** An orbit as it lies on the sky: the visual-binary elements, and its size in km. */
export interface SkyOrbit {
  /** The relative orbit's semi-major axis, km. */
  readonly semiMajorAxisKm: number;
  readonly eccentricity: number;
  readonly inclinationDeg: number;
  /** Position angle of the ascending node, degrees east of north. */
  readonly nodeDeg: number;
  /** The orbiting star's argument of periastron, degrees. */
  readonly argPeriastronDeg: number;
  readonly periastronJd: number;
  readonly periodDays: number;
}

/** A state on the sky's axes at the system: east, north, and away from us; km and km/s. */
export interface SkyState {
  readonly position: { readonly east: number; readonly north: number; readonly away: number };
  readonly velocity: { readonly east: number; readonly north: number; readonly away: number };
}

/**
 * The Thiele-Innes constants of an orbit, in its own length unit: north = A X + F Y,
 * east = B X + G Y, away = C X + H Y, with X = cos E - e and Y = sqrt(1 - e^2) sin E. As
 * Gaia DR3 publishes A, B, F and G (Halbwachs et al. 2023), for the photocentre's orbit.
 */
export function thieleInnes(
  semiMajorAxis: number,
  inclinationDeg: number,
  nodeDeg: number,
  argPeriastronDeg: number,
): { A: number; B: number; F: number; G: number; C: number; H: number } {
  const i = inclinationDeg * DEG;
  const node = nodeDeg * DEG;
  const omega = argPeriastronDeg * DEG;
  const a = semiMajorAxis;
  return {
    A: a * (Math.cos(omega) * Math.cos(node) - Math.sin(omega) * Math.sin(node) * Math.cos(i)),
    B: a * (Math.cos(omega) * Math.sin(node) + Math.sin(omega) * Math.cos(node) * Math.cos(i)),
    F: a * (-Math.sin(omega) * Math.cos(node) - Math.cos(omega) * Math.sin(node) * Math.cos(i)),
    G: a * (-Math.sin(omega) * Math.sin(node) + Math.cos(omega) * Math.cos(node) * Math.cos(i)),
    C: a * Math.sin(omega) * Math.sin(i),
    H: a * Math.cos(omega) * Math.sin(i),
  };
}

/** Where the orbiting star is about its primary at `jd`, on the sky's axes; exact velocity. */
export function skyOrbitState(orbit: SkyOrbit, jd: number): SkyState {
  const e = orbit.eccentricity;
  const n = (2 * Math.PI) / (orbit.periodDays * DAY_S);
  const E = solveKepler(n * (jd - orbit.periastronJd) * DAY_S, e);
  const root = Math.sqrt(1 - e * e);
  const X = Math.cos(E) - e;
  const Y = root * Math.sin(E);
  const dE = n / (1 - e * Math.cos(E));
  const dX = -Math.sin(E) * dE;
  const dY = root * Math.cos(E) * dE;
  const { A, B, F, G, C, H } = thieleInnes(
    orbit.semiMajorAxisKm,
    orbit.inclinationDeg,
    orbit.nodeDeg,
    orbit.argPeriastronDeg,
  );
  return {
    position: { north: A * X + F * Y, east: B * X + G * Y, away: C * X + H * Y },
    velocity: { north: A * dX + F * dY, east: B * dX + G * dY, away: C * dX + H * dY },
  };
}

