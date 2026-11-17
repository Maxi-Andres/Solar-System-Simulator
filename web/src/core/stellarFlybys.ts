import { astrometricState, type Astrometry } from './alphaCentauri.ts';
import { NOTABLE_STARS, notableStarState } from './notableStars.ts';
import { J2000_JD } from './time.ts';
import type { StateVector, Vec3 } from './vec3.ts';

/**
 * Stars that pass through the Oort cloud: Scholz's Star, which did 80,000 years ago, and
 * Gliese 710, which will in 1.3 million years. Both are far outside what the clock reaches
 * -- it runs from the year 1 on, at a year a second at most -- so neither passage can be
 * watched. What is shown instead is each star's **path, computed**: the straight line its
 * measured position and velocity give, drawn about the Sun across the passage, in the
 * Notable Stars layer (scene/StellarFlybys.tsx); and in its panel, the published closest
 * approach beside this line's.
 *
 * ## A straight line
 *
 * Every star here moves on one (stars3d.ts): r(t) = r + v (t - J2000). Over these spans
 * the Galaxy's pull bends it little -- over 100,000 years a straight line is within 2.5% of
 * an integration in the Galactic potential (Mamajek et al. 2015) -- and the published
 * values below that do integrate it differ from the line's by less than their own spread
 * from one data release to the next. The line passes through the Sun's place, not the
 * Solar System's barycentre, which is at most 0.01 AU from it.
 *
 * ## Scholz's Star (WISE J072003.20-084651.2)
 *
 * An M9.5 star and a T dwarf, 99 and 66 Jupiter masses. Mamajek et al. 2015 (ApJL 800,
 * L17) found it passed 52 (+23/-14) thousand AU from the Sun 70 (+15/-10) thousand years
 * ago, the closest flyby then known. Dupuy et al. 2019 (AJ 158, 174) measured its parallax
 * and proper motion ten times better and, along a straight line, put it at 68.7 +- 2.0
 * thousand AU (0.333 +- 0.010 pc), 80.5 +- 0.7 thousand years ago: through the outer Oort
 * cloud, not the inner. Gaia has no parallax for it. Its motion is the Notable Stars mark's
 * (notableStars.ts), Dupuy et al.'s.
 *
 * ## Gliese 710
 *
 * A K7 dwarf of 0.6 solar masses, 19 pc away and coming almost straight at us: its proper
 * motion is 0.43 mas a year, its radial velocity -14.4 km/s. Gaia DR1 first showed how
 * close (Berski & Dybczyński 2016, A&A 595, L10: 13,365 AU in 1.35 Myr); with Gaia DR3's
 * astrometry and radial velocity and the Galaxy's potential, de la Fuente Marcos & de la
 * Fuente Marcos 2022 (RNAAS 6, 136) find 0.052 +- 0.002 pc (10,700 AU) in 1.29 +- 0.02
 * Myr -- the value shown. Fernandez-Puig et al. 2026 (A&A 710, A252), with radial
 * velocities corrected for gravitational redshift and convective blueshift, find 0.0621 pc
 * in about 1.3 Myr: the panel gives both. Its line here is from Gaia DR3 (2016.0, taken as
 * J2000: 16 years are 50 AU of a 19-pc path), the 3D star's own numbers.
 */

export interface PublishedApproach {
  /** Closest distance from the Sun, pc, and its 1-sigma spread (the larger side). */
  readonly closestPc: number;
  readonly closestErrorPc: number | null;
  /** When, years from now: negative for the past. */
  readonly years: number;
  readonly yearsError: number | null;
  readonly reference: string;
  /** What it rests on, a few words. */
  readonly basis: string;
}

export interface StellarFlyby {
  readonly key: string;
  readonly name: string;
  /** How its star is found: a Notable Stars mark's key, or a 3D star's Gaia DR3 id. */
  readonly notableKey: string | null;
  readonly gaiaDr3: string | null;
  /** Its place and motion about the Sun at J2000, km and km/s, scene frame. */
  readonly state: StateVector;
  /** The value shown first, then the others. */
  readonly published: PublishedApproach;
  readonly others: readonly PublishedApproach[];
}

const YEAR_S = 365.25 * 86_400;
const PARSEC_KM = (149_597_870.7 * 648_000) / Math.PI;

/** Gliese 710 in Gaia DR3 (Gaia Collaboration, Vallenari et al. 2023), source 4270814637616488064. */
export const GLIESE_710_GAIA_DR3: Astrometry = {
  raDeg: 274.96183629691126,
  decDeg: -1.938612759804832,
  parallaxMas: 52.396292205290564,
  pmRaMasPerYear: -0.4140637404226508,
  pmDecMasPerYear: -0.10847507667730025,
  radialVelocityKmS: -14.419985,
};

const scholz = NOTABLE_STARS.find((star) => star.key === 'scholz');

export const STELLAR_FLYBYS: readonly StellarFlyby[] = [
  ...(scholz === undefined
    ? []
    : [
        {
          key: 'scholz',
          name: 'Scholz’s Star',
          notableKey: 'scholz',
          gaiaDr3: null,
          state: notableStarState(scholz)(J2000_JD),
          published: {
            closestPc: 0.333,
            closestErrorPc: 0.01,
            years: -80_500,
            yearsError: 700,
            reference: 'Dupuy et al. 2019, AJ 158, 174',
            basis: 'its parallax and motion, a straight line',
          },
          others: [
            {
              closestPc: 0.25,
              closestErrorPc: 0.11,
              years: -70_000,
              yearsError: 15_000,
              reference: 'Mamajek et al. 2015, ApJL 800, L17',
              basis: 'the first estimate',
            },
          ],
        },
      ]),
  {
    key: 'gliese-710',
    name: 'Gliese 710',
    notableKey: null,
    gaiaDr3: '4270814637616488064',
    state: astrometricState(GLIESE_710_GAIA_DR3),
    published: {
      closestPc: 0.052,
      closestErrorPc: 0.002,
      years: 1_290_000,
      yearsError: 20_000,
      reference: 'de la Fuente Marcos & de la Fuente Marcos 2022, RNAAS 6, 136',
      basis: 'Gaia DR3, in the Galaxy’s potential',
    },
    others: [
      {
        closestPc: 0.0621,
        closestErrorPc: null,
        years: 1_300_000,
        yearsError: null,
        reference: 'Fernandez-Puig et al. 2026, A&A 710, A252',
        basis: 'velocities corrected for gravitational redshift and convective blueshift',
      },
      {
        closestPc: 13_365 / 206_264.806,
        closestErrorPc: null,
        years: 1_350_000,
        yearsError: null,
        reference: 'Berski & Dybczyński 2016, A&A 595, L10',
        basis: 'Gaia DR1, the first to find it this close',
      },
    ],
  },
];

/** The flyby of a Notable Stars mark, by its key, or null. */
export function flybyOfNotable(key: string): StellarFlyby | null {
  return STELLAR_FLYBYS.find((flyby) => flyby.notableKey === key) ?? null;
}

/** The flyby of a 3D star, by its Gaia DR3 id, or null. */
export function flybyOfGaia(gaiaDr3: string | null | undefined): StellarFlyby | null {
  return gaiaDr3 == null ? null : (STELLAR_FLYBYS.find((flyby) => flyby.gaiaDr3 === gaiaDr3) ?? null);
}

/** Where the line has the star at `years` from J2000, km about the Sun. */
export function flybyPositionKm(flyby: StellarFlyby, years: number): Vec3 {
  const { position: p, velocity: v } = flyby.state;
  const s = years * YEAR_S;
  return { x: p.x + v.x * s, y: p.y + v.y * s, z: p.z + v.z * s };
}

/** The straight line's own closest approach: when, years from J2000, and how close, pc. */
export function lineClosestApproach(flyby: StellarFlyby): { readonly years: number; readonly distancePc: number } {
  const { position: p, velocity: v } = flyby.state;
  const seconds = -(p.x * v.x + p.y * v.y + p.z * v.z) / (v.x * v.x + v.y * v.y + v.z * v.z);
  const at = flybyPositionKm(flyby, seconds / YEAR_S);
  return { years: seconds / YEAR_S, distancePc: Math.hypot(at.x, at.y, at.z) / PARSEC_KM };
}

/**
 * The stretch of the line drawn, years from J2000: as long again on the far side of the
 * closest approach as from now to it, so the passage reads as one, and a little past now,
 * so the star -- moving along the same line -- stays on it for centuries either way.
 */
export function flybySpanYears(flyby: StellarFlyby): readonly [number, number] {
  const closest = lineClosestApproach(flyby).years;
  const margin = Math.abs(closest) * 0.02;
  return closest < 0 ? [2 * closest, margin] : [-margin, 2 * closest];
}
