/**
 * Planck 2018's distances, as web/src/core/cosmology.ts has them, for the quasars.
 *
 * ## Why Planck 2018 here, and not the cosmic web's cosmology
 *
 * The cosmic web (cosmicWeb/distances.ts) keeps Laniakea's H0 74.6 and Omega_m 0.3 to z 0.95,
 * so its galaxies meet G3's cluster for cluster. The quasars are another matter:
 *
 * - **Past z 1 no distance is measured but through the expansion's history**, and the one that
 *   history is measured by is the baryon acoustic scale -- measured, among others, in these very
 *   quasars: eBOSS's DR16 quasar clustering at z 1.48 and its Lyman-alpha forest at z 2.33
 *   (Alam et al. 2021, PRD 103, 083533). In units of the sound horizon they fit Planck's
 *   Lambda-CDM; H0 74.6 with Omega_m 0.3 puts every one of them 9-10% too near -- the Hubble
 *   tension, unresolved, which the local distance ladder does not reach past z 0.15.
 * - **They lie between the record-holders and the last-scattering sphere**, both in Planck 2018
 *   (web/src/core/cosmology.ts): TON 618 and 3C 273, quasars of this catalogue, are marks there,
 *   and in the cosmic web's cosmology the catalogue's TON 618 would be drawn 1.7 billion light
 *   years nearer than its own mark.
 *
 * What it costs: under z 0.95, where the quasars share the BOSS galaxies' volume, a quasar is
 * placed 9-10% farther than a galaxy of its redshift. The About says so.
 *
 * ## The integral
 *
 * Flat, radiation included (the CMB at T0 2.7255 K and Neff 3.046 neutrinos, all massless), as
 * cosmology.ts: E(z) = sqrt(Omega_r (1+z)^4 + Omega_m (1+z)^3 + Omega_Lambda). Tabulated every
 * 1e-4 in z by Simpson on each step and read by linear interpolation, as cosmicWeb/distances.ts's
 * DistanceTable: the chord departs from the curve by under 1e-8 of the distance.
 */

export const PLANCK18 = { name: 'Planck 2018', h0: 67.66, omegaM: 0.3111, t0K: 2.7255, nEff: 3.046 } as const;

const C_KM_S = 299_792.458;
const PARSEC_KM = (149_597_870.7 * 648_000) / Math.PI;
const MPC_KM = 1e6 * PARSEC_KM;

/** The radiation's share today (cosmology.ts omegaRadiation). */
export function omegaRadiation(c: { h0: number; t0K: number; nEff: number } = PLANCK18): number {
  const sigma = 5.670_374_419e-8;
  const cSi = 299_792_458;
  const g = 6.674_30e-11;
  const h0PerS = (c.h0 * 1000) / (MPC_KM * 1000);
  const rhoCritical = (3 * h0PerS * h0PerS) / (8 * Math.PI * g);
  const rhoPhotons = (4 * sigma * c.t0K ** 4) / cSi ** 3;
  return (rhoPhotons / rhoCritical) * (1 + c.nEff * (7 / 8) * (4 / 11) ** (4 / 3));
}

/** Planck 2018's comoving distance, Mpc, tabulated to `zMax` and read both ways. */
export class PlanckDistances {
  private readonly distances: Float64Array;
  private readonly step: number;
  readonly zMax: number;

  constructor(zMax = 8, step = 1e-4) {
    this.step = step;
    this.zMax = zMax;
    const r = omegaRadiation();
    const m = PLANCK18.omegaM;
    const l = 1 - m - r;
    const f = (z: number) => 1 / Math.sqrt(r * (1 + z) ** 4 + m * (1 + z) ** 3 + l);
    const scale = C_KM_S / PLANCK18.h0;
    const n = Math.ceil(zMax / step) + 1;
    this.distances = new Float64Array(n);
    for (let i = 1; i < n; i += 1) {
      const a = (i - 1) * step;
      const b = i * step;
      this.distances[i] = this.distances[i - 1]! + scale * (step / 6) * (f(a) + 4 * f((a + b) / 2) + f(b));
    }
  }

  /** Comoving distance, Mpc. */
  distance(z: number): number {
    if (!(z > 0)) return 0;
    const at = z / this.step;
    const i = Math.floor(at);
    if (i + 1 >= this.distances.length) throw new Error(`Redshift ${z} is past the table's ${this.zMax}.`);
    return this.distances[i]! + (at - i) * (this.distances[i + 1]! - this.distances[i]!);
  }

  /** Luminosity distance, Mpc: (1 + z) times the comoving, the universe being flat. */
  luminosityDistance(z: number): number {
    return (1 + z) * this.distance(z);
  }

  /** The redshift at a comoving distance, Mpc. */
  redshift(distance: number): number {
    if (!(distance > 0)) return 0;
    const d = this.distances;
    if (distance > d[d.length - 1]!) throw new Error(`Distance ${distance} Mpc is past the table's z ${this.zMax}.`);
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

/** To z 8: DR16Q's farthest is 7.02. */
export const PLANCK_DISTANCES = new PlanckDistances(8);

/** The distance modulus, mag, at redshift z in Planck 2018. */
export function distanceModulus(z: number, table: PlanckDistances = PLANCK_DISTANCES): number {
  return 5 * Math.log10(table.luminosityDistance(z) * 1e5);
}

/**
 * The cosmology DR16Q's M_I column is computed in: flat Lambda-CDM, H0 67.6, Omega_m 0.31, no
 * radiation. Found from the catalogue's own numbers (the run of 2026-11-16): with it this run's
 * M_i(z = 2) matches DR16Q's to a median 0.0004 mag at every redshift from 0.1 to 5.5; with
 * Richards et al. 2006's H0 70, Omega_m 0.3 it is 0.058 mag off, 0.065 at z 0.3 and 0.052 at z 4.5.
 */
export const DR16Q_COSMOLOGY = { h0: 67.6, omegaM: 0.31 } as const;

/** The distance modulus in DR16Q_COSMOLOGY, for the check of this run's absolute magnitudes against the catalogue's. */
export function distanceModulusDr16q(z: number): number {
  const { h0, omegaM } = DR16Q_COSMOLOGY;
  const steps = 400;
  const h = z / steps;
  const f = (x: number) => 1 / Math.sqrt(omegaM * (1 + x) ** 3 + 1 - omegaM);
  let sum = f(0) + f(z);
  for (let i = 1; i < steps; i += 1) sum += (i % 2 === 1 ? 4 : 2) * f(i * h);
  const comoving = ((C_KM_S / h0) * (sum * h)) / 3;
  return 5 * Math.log10((1 + z) * comoving * 1e5);
}
