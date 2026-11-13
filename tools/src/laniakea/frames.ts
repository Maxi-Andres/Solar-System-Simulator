import { toScene } from '../stars/build3d.ts';

/**
 * The frames and the cosmology G3 places things with: galactic and supergalactic directions,
 * the CMB rest frame, and the distance a redshift stands for.
 *
 * ## Directions
 *
 * - **Galactic**: the IAU frame as its ICRS realisation fixes it, the north galactic pole at
 *   RA 192.85948, Dec +27.12825 and the centre at RA 266.40500, Dec -28.93617 -- the numbers
 *   web/src/scene/galactic.ts holds, orthonormalised the same way, about the pole.
 * - **Supergalactic** (de Vaucouleurs et al. 1991, RC3; Lahav et al. 2000, MNRAS 312, 166):
 *   its north pole at galactic l 47.37, b +6.32, and its longitude 0 at l 137.37, b 0 -- the
 *   pole web/src/scene/supergalactic.ts uses. SGX points at SGL 0, SGZ at the pole. The
 *   Cosmicflows grids (watersheds.ts) are in this frame; checked against Cosmicflows-4's own
 *   SGL, SGB columns.
 * - **The scene frame**: ICRS rotated about its x axis by the IAU 1976 obliquity
 *   (stars/build3d.ts toScene), heliocentric, parsecs -- what the Local Group's and the Local
 *   Volume's positions are in.
 *
 * ## The CMB rest frame
 *
 * A heliocentric redshift is moved to the frame of the cosmic microwave background by the
 * Sun's motion against it, the dipole Planck measured: 369.82 km/s toward galactic l 264.021,
 * b +48.253 (Planck Collaboration 2020, A&A 641, A1, Table 3): 1 + z_CMB = (1 + z_helio)
 * (1 + v cos(theta) / c), theta the angle between the galaxy and the apex. Cosmicflows-4's
 * Vcmb is the same quantity.
 *
 * ## Distances
 *
 * Flat Lambda-CDM with the Hubble constant Cosmicflows-4's distances are on, H0 = 74.6 km/s/Mpc
 * (Tully et al. 2023, ApJ 944, 94), and Omega_m = 0.3, the matter density the CF4
 * reconstructions assume (Courtois et al. 2023; Dupuy & Courtois 2023): the comoving
 * distance (c / H0) int_0^z dz' / E(z'), E = sqrt(Omega_m (1 + z)^3 + 1 - Omega_m), and the
 * luminosity distance (1 + z) times that. A measured distance modulus is a luminosity
 * distance; the scene places a galaxy at its comoving distance, where it is now -- the two
 * differ by 1 + z, 3% at z 0.03, 10% at z 0.1.
 */

const DEG = Math.PI / 180;

export type Vec3 = [number, number, number];

/** Unit vector of an ICRS (or any) longitude and latitude, degrees. */
export function unitVector(lonDeg: number, latDeg: number): Vec3 {
  const lon = lonDeg * DEG;
  const lat = latDeg * DEG;
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalise = (a: Vec3): Vec3 => {
  const n = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / n, a[1] / n, a[2] / n];
};

/** An orthonormal basis (x, y, z axes) in ICRS, from its pole and its longitude-0 direction. */
interface Basis {
  readonly x: Vec3;
  readonly y: Vec3;
  readonly z: Vec3;
}

function basisFrom(pole: Vec3, origin: Vec3): Basis {
  const z = normalise(pole);
  const along = dot(origin, z);
  const x = normalise([origin[0] - along * z[0], origin[1] - along * z[1], origin[2] - along * z[2]]);
  return { x, y: cross(z, x), z };
}

/** The galactic axes in ICRS. */
export const GALACTIC: Basis = basisFrom(unitVector(192.85948, 27.12825), unitVector(266.405, -28.93617));

/** A galactic direction in ICRS. */
export function galacticToIcrs(lDeg: number, bDeg: number): Vec3 {
  const g = unitVector(lDeg, bDeg);
  const { x, y, z } = GALACTIC;
  return [x[0] * g[0] + y[0] * g[1] + z[0] * g[2], x[1] * g[0] + y[1] * g[1] + z[1] * g[2], x[2] * g[0] + y[2] * g[1] + z[2] * g[2]];
}

/** The supergalactic axes in ICRS: SGZ at the pole (l 47.37, b 6.32), SGX at (l 137.37, b 0). */
export const SUPERGALACTIC: Basis = basisFrom(galacticToIcrs(47.37, 6.32), galacticToIcrs(137.37, 0));

/** Longitude and latitude, degrees, of an ICRS vector in a basis. */
function inBasis(v: Vec3, basis: Basis): { lonDeg: number; latDeg: number } {
  const n = normalise(v);
  const lon = Math.atan2(dot(n, basis.y), dot(n, basis.x)) / DEG;
  return { lonDeg: (lon + 360) % 360, latDeg: Math.asin(Math.max(-1, Math.min(1, dot(n, basis.z)))) / DEG };
}

export function icrsToGalactic(raDeg: number, decDeg: number): { lDeg: number; bDeg: number } {
  const { lonDeg, latDeg } = inBasis(unitVector(raDeg, decDeg), GALACTIC);
  return { lDeg: lonDeg, bDeg: latDeg };
}

export function icrsToSupergalactic(raDeg: number, decDeg: number): { sglDeg: number; sgbDeg: number } {
  const { lonDeg, latDeg } = inBasis(unitVector(raDeg, decDeg), SUPERGALACTIC);
  return { sglDeg: lonDeg, sgbDeg: latDeg };
}

/** RA and Dec, degrees, of an ICRS vector. */
export function icrsToRaDec(v: Vec3): { raDeg: number; decDeg: number } {
  const n = normalise(v);
  return { raDeg: ((Math.atan2(n[1], n[0]) / DEG) + 360) % 360, decDeg: Math.asin(Math.max(-1, Math.min(1, n[2]))) / DEG };
}

/** A supergalactic Cartesian vector (SGX, SGY, SGZ) in ICRS, same units. */
export function supergalacticToIcrs(sg: Vec3): Vec3 {
  const { x, y, z } = SUPERGALACTIC;
  return [
    x[0] * sg[0] + y[0] * sg[1] + z[0] * sg[2],
    x[1] * sg[0] + y[1] * sg[1] + z[1] * sg[2],
    x[2] * sg[0] + y[2] * sg[1] + z[2] * sg[2],
  ];
}

/** A supergalactic Cartesian vector in the scene frame, same units. */
export function supergalacticToScene(sg: Vec3): Vec3 {
  return toScene(supergalacticToIcrs(sg));
}

/** A point at a direction and distance, scene frame, in the distance's units. */
export function sceneAt(raDeg: number, decDeg: number, distance: number): Vec3 {
  const u = unitVector(raDeg, decDeg);
  return toScene([u[0] * distance, u[1] * distance, u[2] * distance]);
}

// ---------------------------------------------------------------------------------------
// The CMB frame

export const C_KM_S = 299792.458;
/** The Sun's velocity against the CMB, km/s, and its apex (Planck Collaboration 2020, A&A 641, A1). */
export const CMB_DIPOLE = { speedKmS: 369.82, lDeg: 264.021, bDeg: 48.253 } as const;
const CMB_APEX = galacticToIcrs(CMB_DIPOLE.lDeg, CMB_DIPOLE.bDeg);

/** A heliocentric redshift (as cz, km/s) in the CMB frame (as cz, km/s). */
export function czCmb(raDeg: number, decDeg: number, czHelio: number): number {
  const cosTheta = dot(unitVector(raDeg, decDeg), CMB_APEX);
  const z = (1 + czHelio / C_KM_S) * (1 + (CMB_DIPOLE.speedKmS * cosTheta) / C_KM_S) - 1;
  return z * C_KM_S;
}

// ---------------------------------------------------------------------------------------
// Distances

/** The Hubble constant CF4's distances are on (Tully et al. 2023), km/s/Mpc; h = H0 / 100. */
export const H0 = 74.6;
export const LITTLE_H = H0 / 100;
/** The matter density the CF4 reconstructions assume; flat, so Omega_Lambda = 0.7. */
export const OMEGA_M = 0.3;

/** Comoving distance, Mpc, at redshift z (Simpson's rule, 400 steps: far finer than any redshift's error). */
export function comovingDistanceMpc(z: number): number {
  if (z <= 0) {
    return 0;
  }
  const steps = 400;
  const h = z / steps;
  const f = (x: number) => 1 / Math.sqrt(OMEGA_M * (1 + x) ** 3 + 1 - OMEGA_M);
  let sum = f(0) + f(z);
  for (let i = 1; i < steps; i += 1) {
    sum += (i % 2 === 1 ? 4 : 2) * f(i * h);
  }
  return ((C_KM_S / H0) * (sum * h)) / 3;
}

export function luminosityDistanceMpc(z: number): number {
  return (1 + z) * comovingDistanceMpc(z);
}

/** Luminosity distance, pc, of a distance modulus. */
export function modulusToPc(modulus: number): number {
  return 10 ** (1 + modulus / 5);
}

/** A modulus error, magnitudes, as a fraction of the distance. */
export const MODULUS_TO_FRACTION = Math.LN10 / 5;
