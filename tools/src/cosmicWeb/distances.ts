import { toScene } from '../stars/build3d.ts';
import { C_KM_S, czCmb, H0, OMEGA_M, unitVector, type Vec3 } from '../laniakea/frames.ts';

/**
 * Where the cosmic web's catalogues put things, and where the app puts them.
 *
 * ## One cosmology for the whole layer: Laniakea's
 *
 * Every galaxy and filament here is placed at its comoving distance in flat Lambda-CDM with
 * H0 74.6 km/s/Mpc and Omega_m 0.3 -- laniakea/frames.ts's, the cosmology G3's 86,899 galaxies
 * are placed in. The SDSS galaxies below share G3's volume out to 700 Mpc, cluster for
 * cluster: in any other cosmology Coma would be drawn twice, 10% apart. Past G3's edge the
 * BOSS galaxies (to z 0.8) keep it too, so the map has no seam; there Planck 2018 (H0 67.66,
 * Omega_m 0.3111, web/src/core/cosmology.ts) would put them 9-10% farther, the ratio of the
 * two Hubble constants -- the Hubble tension, unresolved. Distance is monotonic in redshift,
 * so the web can move any point to another cosmology exactly: its distance here gives back
 * its redshift (DistanceTable.redshift), and that the other's distance.
 *
 * ## The catalogues' own cosmologies, undone
 *
 * Each catalogue gives a distance in its own cosmology; each is turned back into the redshift
 * it stands for, and that into the app's distance:
 *
 * - **Tempel et al. 2014** (the SDSS filaments and galaxies): comoving distances in h^-1 Mpc
 *   for Omega_m 0.27, Omega_Lambda 0.73 (WMAP), so H0 = 100 in its units (TEMPEL_COSMOLOGY);
 *   the redshifts in the CMB frame. A galaxy's distance there is its "finger-of-god
 *   suppressed" one, its group's redshift spread on the sky's scale: the redshift it stands
 *   for is an effective one, the galaxy's place in the group made round.
 * - **Malavasi et al. 2020** (the BOSS filaments): comoving Mpc in Planck 2015's cosmology as
 *   the paper gives it, H0 67.74, Omega_m 0.3075 (MALAVASI_COSMOLOGY), from heliocentric
 *   redshifts (tested in cosmicWeb.ts: the skeleton lies on the galaxies only so).
 * - **BOSS DR12** galaxies: heliocentric redshifts, moved to the CMB frame by frames.ts's
 *   dipole.
 *
 * Radiation is left out of all three: under z 1 it shifts a distance by under 0.05%.
 */

export interface FlatCosmology {
  /** km/s/Mpc: 100 for distances in h^-1 Mpc. */
  readonly h0: number;
  readonly omegaM: number;
}

/** Laniakea's (frames.ts): CF4's H0 and the CF4 reconstructions' Omega_m. */
export const APP_COSMOLOGY: FlatCosmology = { h0: H0, omegaM: OMEGA_M };
/** Tempel et al. 2014, Sect. 2: WMAP's Omega_m 0.27, Omega_Lambda 0.73, distances in h^-1 Mpc. */
export const TEMPEL_COSMOLOGY: FlatCosmology = { h0: 100, omegaM: 0.27 };
/** Malavasi et al. 2020, Sect. 2: "Planck 2016b", H0 67.74, Omega_m 0.3075, Omega_Lambda 0.6925. */
export const MALAVASI_COSMOLOGY: FlatCosmology = { h0: 67.74, omegaM: 0.3075 };

/** Comoving distance, Mpc (or h^-1 Mpc for h0 100), at redshift z: Simpson's rule, 400 steps. */
export function comovingMpc(z: number, cosmology: FlatCosmology): number {
  if (z <= 0) {
    return 0;
  }
  const steps = 400;
  const h = z / steps;
  const om = cosmology.omegaM;
  const f = (x: number) => 1 / Math.sqrt(om * (1 + x) ** 3 + 1 - om);
  let sum = f(0) + f(z);
  for (let i = 1; i < steps; i += 1) {
    sum += (i % 2 === 1 ? 4 : 2) * f(i * h);
  }
  return ((C_KM_S / cosmology.h0) * (sum * h)) / 3;
}

/**
 * A cosmology's comoving distance tabulated every `step` in z out to `zMax`, read both ways by
 * linear interpolation: over a step of 1e-4 the curve departs from its chord by a few parsecs at
 * most, 2e-8 of the distance. Two million galaxies a run make the table worth it.
 */
export class DistanceTable {
  private readonly distances: Float64Array;
  private readonly step: number;
  readonly zMax: number;

  constructor(cosmology: FlatCosmology, zMax = 1.2, step = 1e-4) {
    this.step = step;
    this.zMax = zMax;
    const n = Math.ceil(zMax / step) + 1;
    this.distances = new Float64Array(n);
    // Integrated step by step (Simpson on each), so the table costs one pass.
    const om = cosmology.omegaM;
    const f = (x: number) => 1 / Math.sqrt(om * (1 + x) ** 3 + 1 - om);
    const scale = C_KM_S / cosmology.h0;
    for (let i = 1; i < n; i += 1) {
      const a = (i - 1) * step;
      const b = i * step;
      this.distances[i] = this.distances[i - 1]! + (scale * (step / 6)) * (f(a) + 4 * f((a + b) / 2) + f(b));
    }
  }

  distance(z: number): number {
    if (!(z > 0)) {
      return 0;
    }
    const at = z / this.step;
    const i = Math.floor(at);
    if (i + 1 >= this.distances.length) {
      throw new Error(`Redshift ${z} is past the table's ${this.zMax}.`);
    }
    return this.distances[i]! + (at - i) * (this.distances[i + 1]! - this.distances[i]!);
  }

  /** The redshift at a comoving distance, the inverse of distance(). */
  redshift(distance: number): number {
    if (!(distance > 0)) {
      return 0;
    }
    const d = this.distances;
    if (distance > d[d.length - 1]!) {
      throw new Error(`Distance ${distance} is past the table's z ${this.zMax}.`);
    }
    let lo = 0;
    let hi = d.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (d[mid]! <= distance) lo = mid;
      else hi = mid;
    }
    return (lo + (distance - d[lo]!) / (d[hi]! - d[lo]!)) * this.step;
  }
}

export const APP_DISTANCES = new DistanceTable(APP_COSMOLOGY);
export const TEMPEL_DISTANCES = new DistanceTable(TEMPEL_COSMOLOGY, 0.4);
export const MALAVASI_DISTANCES = new DistanceTable(MALAVASI_COSMOLOGY, 1.6);

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------------------
// Tempel et al. 2014's Cartesian frame: the SDSS survey coordinates

/**
 * The SDSS survey coordinates (lambda, eta: Stoughton et al. 2002, AJ 123, 485): their pole
 * at RA 95 deg, Dec 0, and eta measured from the survey's central meridian, 32.5 deg from the
 * equator. Tempel et al. 2014 (eq. 1; Tempel et al. 2012, A&A 540, A106) put a galaxy at
 *
 *   x = -d sin(lambda),  y = d cos(lambda) cos(eta),  z = d cos(lambda) sin(eta)
 *
 * which is the equatorial frame turned to RA 95 deg about the pole and 32.5 deg about its x
 * axis. Checked on the catalogue itself (cosmicWeb.ts checkTempelFrame): a galaxy put there
 * by its RA, Dec and distance lies within the 0.5 h^-1 Mpc filament radius of the filament
 * point table3 names as its nearest; without the 32.5 deg, a hundred Mpc from it.
 */
export const SDSS_SURVEY_NODE_DEG = 95;
export const SDSS_SURVEY_ETA_POLE_DEG = 32.5;

/** An equatorial direction in Tempel's frame (a unit vector). */
export function equatorialToTempel(raDeg: number, decDeg: number): Vec3 {
  const a = (raDeg - SDSS_SURVEY_NODE_DEG) * DEG;
  const d = decDeg * DEG;
  const xe = Math.cos(d) * Math.cos(a);
  const ye = Math.cos(d) * Math.sin(a);
  const ze = Math.sin(d);
  const c = Math.cos(SDSS_SURVEY_ETA_POLE_DEG * DEG);
  const s = Math.sin(SDSS_SURVEY_ETA_POLE_DEG * DEG);
  // x = -sin(lambda) = xe; (y, z) is (ye, ze) turned back by eta's 32.5 deg.
  return [xe, ye * c + ze * s, -ye * s + ze * c];
}

/** RA and Dec, degrees, of a point in Tempel's frame. */
export function tempelToEquatorial(p: Vec3): { raDeg: number; decDeg: number } {
  const r = Math.hypot(p[0], p[1], p[2]);
  const c = Math.cos(SDSS_SURVEY_ETA_POLE_DEG * DEG);
  const s = Math.sin(SDSS_SURVEY_ETA_POLE_DEG * DEG);
  const xe = p[0] / r;
  const ye = (p[1] * c - p[2] * s) / r;
  const ze = (p[1] * s + p[2] * c) / r;
  const ra = (Math.atan2(ye, xe) / DEG + SDSS_SURVEY_NODE_DEG + 360) % 360;
  return { raDeg: ra, decDeg: Math.asin(Math.max(-1, Math.min(1, ze))) / DEG };
}

// ---------------------------------------------------------------------------------------
// Malavasi et al. 2020's Cartesian frame

/**
 * Malavasi et al. 2020 (Sect. 2) "converted to Cartesian coordinates, with the frame rotated
 * so that the x-axis points in the line-of-sight direction towards the centre of the field",
 * the field's centre for BOSS LOWZ+CMASS at RA 184.894, Dec 28.153 (their Table 1). Neither
 * the paper nor the catalogue's page says more. What the skeletons fit is the offsets taken
 * as angles, not a rotation of the sphere:
 *
 *   x = d cos(dDec) cos(dRA),  y = d cos(dDec) sin(dRA),  z = d sin(dDec)
 *   dRA = RA - RA_centre,  dDec = Dec - Dec_centre
 *
 * at the comoving distance of the heliocentric redshift in MALAVASI_COSMOLOGY: so placed,
 * three quarters of their SDSS Legacy skeleton's points fall in a 4 Mpc cell holding one of
 * Tempel's galaxies (Tempel's own filaments: 82%), against 17% for a true rotation to the
 * centre, 64% for CMB-frame redshifts and 7% for the axes mirrored; and a shift of the centre
 * by half a degree, or of the distances by 1%, loses a fifth of them. This run checks it
 * again on the BOSS galaxies (cosmicWeb.ts checkMalavasiFrame).
 */
export const MALAVASI_LOWZ_CMASS_CENTRE = { raDeg: 184.894, decDeg: 28.153 } as const;

/** RA, Dec (degrees) and distance of a point of Malavasi's frame about `centre`. */
export function malavasiToEquatorial(p: Vec3, centre: { readonly raDeg: number; readonly decDeg: number }): { raDeg: number; decDeg: number; distance: number } {
  const distance = Math.hypot(p[0], p[1], p[2]);
  const dDec = Math.asin(Math.max(-1, Math.min(1, p[2] / distance))) / DEG;
  const dRa = Math.atan2(p[1], p[0]) / DEG;
  return { raDeg: (centre.raDeg + dRa + 360) % 360, decDeg: centre.decDeg + dDec, distance };
}

/** The inverse: an equatorial direction and distance in Malavasi's frame. */
export function equatorialToMalavasi(raDeg: number, decDeg: number, distance: number, centre: { readonly raDeg: number; readonly decDeg: number }): Vec3 {
  const a = (raDeg - centre.raDeg) * DEG;
  const d = (decDeg - centre.decDeg) * DEG;
  return [distance * Math.cos(d) * Math.cos(a), distance * Math.cos(d) * Math.sin(a), distance * Math.sin(d)];
}

// ---------------------------------------------------------------------------------------
// Into the app's frame

/** A heliocentric redshift in the CMB frame (frames.ts's dipole). */
export function zCmbOf(raDeg: number, decDeg: number, zHelio: number): number {
  return czCmb(raDeg, decDeg, zHelio * C_KM_S) / C_KM_S;
}

/** The scene-frame point, pc, of a direction and a CMB-frame redshift: the app's comoving distance. */
export function scenePc(raDeg: number, decDeg: number, zCmb: number): Vec3 {
  const d = APP_DISTANCES.distance(zCmb) * 1e6;
  const u = unitVector(raDeg, decDeg);
  return toScene([u[0] * d, u[1] * d, u[2] * d]);
}

/** The inverse of toScene (a rotation about x by the obliquity): scene to ICRS. */
export function fromScene(v: Vec3): Vec3 {
  // toScene is orthogonal: its transpose is its inverse. Read it off three unit vectors.
  const ex = toScene([1, 0, 0]);
  const ey = toScene([0, 1, 0]);
  const ez = toScene([0, 0, 1]);
  return [
    ex[0] * v[0] + ex[1] * v[1] + ex[2] * v[2],
    ey[0] * v[0] + ey[1] * v[1] + ey[2] * v[2],
    ez[0] * v[0] + ez[1] * v[1] + ez[2] * v[2],
  ];
}
