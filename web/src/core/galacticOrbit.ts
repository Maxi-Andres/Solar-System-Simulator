import { SGR_A_DISTANCE_PC } from './blackHoles.ts';
import { galacticUnit } from './localInterstellar.ts';
import { SUN_ABOVE_PLANE_PC } from './milkyWay.ts';

/**
 * The Sun's orbit about the Galactic Centre and the dark halo's reach (scene/GalacticOrbit.tsx;
 * the Sun's Galactic Orbit layer, off by default: one is a computation, the other a model).
 *
 * ## The orbit: measured start, modelled pull
 *
 * Where the Sun is and how it moves are measured; what pulls it is a model. The orbit is the
 * path that model gives from the measured start, integrated forward one turn about the centre:
 *
 * - **The centre**: Sgr A*, at GRAVITY's 8,275.9 pc (blackHoles.ts), toward l = 359.944°,
 *   b = -0.046° (Reid & Brunthaler 2004, ApJ 616, 872).
 * - **The Sun's height**: 25 pc above the plane (Bland-Hawthorn & Gerhard 2016, as milkyWay.ts):
 *   the integration's plane is the one through Sgr A* and 25 pc below the Sun.
 * - **Its motion**: along the rotation, Sgr A*'s proper motion along the plane, -6.411 mas/yr,
 *   which is the Sun's own motion reflected (Reid & Brunthaler 2020, ApJ 892, 39): times 4.74
 *   and R0, 251.5 km/s, the circular speed and the Sun's own lead on it together; toward the
 *   centre and out of the plane, the Sun's motion against its neighbours, U = 11.1 and
 *   W = 7.25 km/s (Schönrich, Binney & Dehnen 2010, MNRAS 403, 1829).
 * - **The pull**: gala's MilkyWayPotential (Price-Whelan 2017, JOSS 2, 388; its disc Bovy
 *   2015's, ApJS 216, 29), fitted to the Galaxy's measured mass from 10 pc to 150 kpc: a
 *   Hernquist nucleus and bulge, a Miyamoto-Nagai disc and an NFW halo, all smooth -- no bar,
 *   no arms, no passing clouds, each of which bends the real orbit and none of which a smooth
 *   model holds. Its circular speed at the Sun is 231 km/s, so the measured 251.5 puts the Sun
 *   near the inner end of an eccentric orbit: 8.2 to 10.1 kpc from the centre, 120 pc at most
 *   from the plane. The Sun's lead on its neighbours, V = 12 km/s (Schönrich et al.), would make
 *   the circular speed 239 and the orbit rounder; the 8 km/s between the model and that is what
 *   widens it, and is the model's.
 *
 * Integrated by leapfrog in steps of 0.05 Myr, until the Sun has gone once round the centre: a
 * turn, 238 million years, which, with the radial and vertical swings the orbit has, does not
 * close on itself -- the "230 million years" the Sun's year is usually given.
 *
 * ## The halo's reach
 *
 * The radius within which the Galaxy's mean density is 200 times the critical density: R200,
 * Cautun et al. 2020 (MNRAS 494, 4291), from Gaia's rotation curve and the satellites' motions,
 * 218 +12/-18 kpc for their M200 = 1.08 × 10^12 solar masses (their Table 2, the contracted
 * halo they prefer). Nothing marks it in the sky; it is where models
 * put the halo's edge, drawn as a faint sphere about Sgr A*.
 *
 * All positions here are heliocentric Galactic Cartesian parsecs: x toward l = 0, y toward
 * l = 90, z toward the north Galactic pole (scene/galactic.ts GALACTIC_BASIS).
 */

/** G in kpc (km/s)^2 per solar mass. */
const G = 4.300917e-6;
/** One kpc/(km/s), the integration's unit of time, in Myr. */
const TIME_UNIT_MYR = 977.792;
/** 4.74047: km/s per (mas/yr × kpc). */
const KM_S_PER_MAS_YR_KPC = 4.740470463533348;

/** gala MilkyWayPotential (v1) defaults: masses in solar masses, lengths in kpc. */
export const MILKY_WAY_POTENTIAL = {
  nucleus: { m: 1.71e9, c: 0.07 },
  bulge: { m: 5e9, c: 1.0 },
  disc: { m: 6.8e10, a: 3.0, b: 0.28 },
  halo: { m: 5.4e11, rs: 15.62 },
} as const;

/** Sgr A* on the Galactic sphere, degrees (Reid & Brunthaler 2004). */
export const SGR_A_GALACTIC_DEG = { l: 359.9443, b: -0.0462 } as const;

/** Sgr A*'s proper motion along the Galactic plane, mas/yr (Reid & Brunthaler 2020). */
export const SGR_A_PM_L_MAS_YR = -6.411;
/** The Sun's motion toward the centre and toward the north pole, km/s (Schönrich et al. 2010). */
export const SUN_U_KM_S = 11.1;
export const SUN_W_KM_S = 7.25;

/** The halo's R200 and M200 (Cautun et al. 2020): kpc and solar masses. */
export const HALO_R200_KPC = 218;
export const HALO_M200_SUN = 1.08e12;

type V3 = [number, number, number];

/** The model's acceleration at a Galactocentric point (kpc, axes of the plane), (km/s)^2/kpc. */
export function acceleration(x: number, y: number, z: number): V3 {
  const { nucleus, bulge, disc, halo } = MILKY_WAY_POTENTIAL;
  const r = Math.max(Math.hypot(x, y, z), 1e-6);
  // Hernquist: Phi = -Gm/(r + c), so g = -Gm / (r (r + c)^2) r_vec.
  const hernquist = (m: number, c: number) => (G * m) / (r * (r + c) ** 2);
  // NFW in gala's form: Phi = -Gm ln(1 + r/rs) / r.
  const nfw = ((G * halo.m) / (r * r)) * (Math.log(1 + r / halo.rs) / r - 1 / (r + halo.rs));
  const radial = hernquist(nucleus.m, nucleus.c) + hernquist(bulge.m, bulge.c) + nfw;
  // Miyamoto-Nagai: Phi = -Gm / sqrt(R^2 + (a + sqrt(z^2 + b^2))^2).
  const B = Math.sqrt(z * z + disc.b * disc.b);
  const D3 = (x * x + y * y + (disc.a + B) ** 2) ** 1.5;
  const inPlane = (G * disc.m) / D3;
  const vertical = (G * disc.m * (disc.a + B)) / (B * D3);
  return [-(radial + inPlane) * x, -(radial + inPlane) * y, -(radial + vertical) * z];
}

/** The model's circular speed in the plane at R kpc, km/s. */
export function circularSpeed(radiusKpc: number): number {
  const [ax] = acceleration(radiusKpc, 0, 0);
  return Math.sqrt(-ax * radiusKpc);
}

/** The plane's axes in heliocentric Galactic axes, and Sgr A*'s place, pc: see the header. */
export function orbitFrame(): {
  readonly centre: V3;
  readonly x: V3;
  readonly y: V3;
  readonly z: V3;
} {
  const u = galacticUnit(SGR_A_GALACTIC_DEG.l, SGR_A_GALACTIC_DEG.b);
  const centre: V3 = [u[0] * SGR_A_DISTANCE_PC, u[1] * SGR_A_DISTANCE_PC, u[2] * SGR_A_DISTANCE_PC];
  // The plane holds Sgr A* and the point 25 pc below the Sun, and the direction l = 90.
  const d: V3 = [centre[0], centre[1], centre[2] + SUN_ABOVE_PLANE_PC];
  const zRaw: V3 = [-d[2], 0, d[0]];
  const zn = Math.hypot(...zRaw);
  const z: V3 = [zRaw[0] / zn, zRaw[1] / zn, zRaw[2] / zn];
  const dz = d[0] * z[0] + d[1] * z[1] + d[2] * z[2];
  const xRaw: V3 = [d[0] - dz * z[0], d[1] - dz * z[1], d[2] - dz * z[2]];
  const xn = Math.hypot(...xRaw);
  const x: V3 = [xRaw[0] / xn, xRaw[1] / xn, xRaw[2] / xn];
  const y: V3 = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return { centre, x, y, z };
}

/** The Sun's velocity about the centre, km/s, heliocentric Galactic axes: U, Theta0 + V_sun, W. */
export function sunVelocityKmS(): V3 {
  const along = Math.abs(SGR_A_PM_L_MAS_YR) * KM_S_PER_MAS_YR_KPC * (SGR_A_DISTANCE_PC / 1000);
  return [SUN_U_KM_S, along, SUN_W_KM_S];
}

export interface SunOrbit {
  /** The path, heliocentric Galactic pc, from the Sun now, one turn forward. */
  readonly points: readonly V3[];
  /** How long the turn takes, Myr. */
  readonly periodMyr: number;
  /** Nearest and farthest from the centre over it, and highest above or below the plane, pc. */
  readonly pericentrePc: number;
  readonly apocentrePc: number;
  readonly maxHeightPc: number;
}

const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The Sun's orbit: one turn about the centre in the model, from the measured start. */
export function sunOrbit(stepMyr = 0.05, sampleEveryMyr = 0.5): SunOrbit {
  const frame = orbitFrame();
  const fromCentre: V3 = [-frame.centre[0] / 1000, -frame.centre[1] / 1000, -frame.centre[2] / 1000];
  const v0 = sunVelocityKmS();
  let p: V3 = [dot(fromCentre, frame.x), dot(fromCentre, frame.y), dot(fromCentre, frame.z)];
  let v: V3 = [dot(v0, frame.x), dot(v0, frame.y), dot(v0, frame.z)];
  const dt = stepMyr / TIME_UNIT_MYR;
  const every = Math.max(1, Math.round(sampleEveryMyr / stepMyr));
  const toHelio = (q: V3): V3 => {
    const k = 1000;
    return [
      frame.centre[0] + k * (q[0] * frame.x[0] + q[1] * frame.y[0] + q[2] * frame.z[0]),
      frame.centre[1] + k * (q[0] * frame.x[1] + q[1] * frame.y[1] + q[2] * frame.z[1]),
      frame.centre[2] + k * (q[0] * frame.x[2] + q[1] * frame.y[2] + q[2] * frame.z[2]),
    ];
  };
  const points: V3[] = [toHelio(p)];
  let angle = Math.atan2(p[1], p[0]);
  let turned = 0;
  let peri = Infinity;
  let apo = 0;
  let height = Math.abs(p[2]);
  let a = acceleration(...p);
  let steps = 0;
  // A turn, or at most a billion years should the model hold the Sun some other way.
  while (Math.abs(turned) < 2 * Math.PI && steps * stepMyr < 1000) {
    v = [v[0] + 0.5 * dt * a[0], v[1] + 0.5 * dt * a[1], v[2] + 0.5 * dt * a[2]];
    p = [p[0] + dt * v[0], p[1] + dt * v[1], p[2] + dt * v[2]];
    a = acceleration(...p);
    v = [v[0] + 0.5 * dt * a[0], v[1] + 0.5 * dt * a[1], v[2] + 0.5 * dt * a[2]];
    steps += 1;
    const next = Math.atan2(p[1], p[0]);
    let change = next - angle;
    if (change > Math.PI) change -= 2 * Math.PI;
    if (change < -Math.PI) change += 2 * Math.PI;
    turned += change;
    angle = next;
    const radius = Math.hypot(p[0], p[1]);
    peri = Math.min(peri, radius);
    apo = Math.max(apo, radius);
    height = Math.max(height, Math.abs(p[2]));
    if (steps % every === 0) points.push(toHelio(p));
  }
  points.push(toHelio(p));
  return {
    points,
    periodMyr: steps * stepMyr,
    pericentrePc: peri * 1000,
    apocentrePc: apo * 1000,
    maxHeightPc: height * 1000,
  };
}
