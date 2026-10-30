import {
  colorIndexForTemperature,
  julianEpochJd,
  keplerPeriodDays,
  S2_ORBIT,
  SGR_A_DISTANCE_PC,
  SGR_A_MASS_SUN,
  sgrASkyToScene,
  skyOrbitState,
  type SkyOrbit,
} from './blackHoles.ts';
import { EVOLVED_BY_K } from './nuclearClusterPopulation.ts';
import type { Vec3 } from './vec3.ts';

/**
 * The stars of the Galactic Centre that are measured one by one, drawn as measured about
 * Sgr A* (NuclearCluster.tsx), on top of the cluster's model (nuclearCluster.ts).
 *
 * ## The S-stars, on their orbits
 *
 * Gillessen et al. 2017 (ApJ 837, 30; arXiv 1611.09144), Table 3: the forty stars round
 * Sgr A* with orbits, from 25 years of VLT and Keck astrometry and spectroscopy -- a, e,
 * i, Omega, omega and the time of pericentre in the same visual-binary convention as S2's,
 * the K magnitude, and 'e' or 'l' for the early-type (B dwarfs, mostly) and late-type
 * (red giants) stars. Each is put on its Kepler ellipse by the same sky-orbit arithmetic as
 * S2 (blackHoles.ts, skyOrbitState): the semi-major axis's angle at GRAVITY's distance, the
 * period from Kepler's law with GRAVITY's mass. Those periods agree with the ones
 * Gillessen et al. publish, from their own potential, within 1.6% or the published error
 * for every star (galacticCentreStars.test.ts).
 *
 * - **S2** is not drawn here: it is a body of its own, on GRAVITY 2024's orbit.
 * - **S29, S38 and S55** are on GRAVITY 2024's elements instead (A&A 692, A242, Table B.1):
 *   refitted with interferometric astrometry through their pericentres, S29's in 2021 --
 *   e = 0.969 where Gillessen et al., before it, had 0.73.
 * - **S111** is left out: its fit is a hyperbola (e = 1.09 +- 0.06, a = -12 +- 8"), a star
 *   that may not be bound at all.
 *
 * That leaves 38 stars on orbits. The orbits are Keplerian and fixed: the Schwarzschild
 * precession GRAVITY measured, 12' a turn for S2, is not drawn for any.
 *
 * ## The young stars of the central parsec, where they are seen
 *
 * Paumard et al. 2006 (ApJ 643, 1011; arXiv astro-ph/0601268), Table 2: ninety early-type
 * stars -- Wolf-Rayet stars, O and B supergiants and giants, B dwarfs -- with their
 * offsets from Sgr A* on the sky (x east, y north, arcseconds), their K magnitudes and
 * spectral types. Those within 1" (E1 to E16) are left out -- that is the S-stars' own
 * arcsecond, where the orbits are -- and so is any that is one of the orbit stars above,
 * at the same place in 2005 within 0.15" and with the same K within 0.8: four more, among
 * them IRS 16C and IRS 16SW, which are S96 and S97. That leaves 70.
 *
 * - **Along the line of sight** a position is measured for 22 of them: z, from the
 *   clockwise disc they lie in (Beloborodov et al., in Paumard's table). For the others it
 *   is unknown, and is drawn: seeded, from the distribution of depth the young stars' own
 *   density gives -- their surface density falls as R^-2 (Paumard et al.), so as r^-3 in
 *   space, and at projected radius p the depth z then has p(z) proportional to
 *   (p^2 + z^2)^-1.5, drawn as z = p u / sqrt(1 - u^2), u uniform in (-1, 1), held within
 *   13", where the young stars end. A convention, so that the cluster has depth.
 * - **Still.** They are drawn where they were measured, about 2005, and do not move: their
 *   orbits are not known well enough to run.
 *
 * ## IRS 7
 *
 * The brightest star of the central parsec in K, a red supergiant: its SiO maser's offset
 * from Sgr A*, +0.0364" east and +5.5461" north at 1999.55 (Reid et al. 2003, ApJ 587, 208;
 * arXiv astro-ph/0212273), and from Paumard et al. 2014 (A&A 568, A85; arXiv 1406.5320):
 * K = 6.8, A_K = 3.48, 3,600 K. Its depth is unknown: drawn on the plane of the sky through
 * Sgr A*.
 *
 * ## Brightness and colour, from K
 *
 * What is measured is K, through the dust. Each star's absolute K magnitude is
 *
 *     M_K = K - A_K - 5 log10(R0 / 10 pc)
 *
 * with R0 = 8,275.9 pc and A_K = 2.42 toward Sgr A* (Fritz et al. 2011, ApJ 737, 73, within
 * 0.5") for the S-stars, 2.62 over the central 14" x 20" (the same paper) for the young
 * stars, and IRS 7's own. Its visual magnitude is M_V = M_K + (V - K), the intrinsic colour
 * of its kind:
 *
 * - **early-type stars** take the colours of a main-sequence star of their temperature from
 *   Pecaut & Mamajek 2013 (ApJS 208, 9; arXiv 1307.2657, table version 2022.04.16), from
 *   O9 V (33,300 K, V - K = -1.00) to B5 V (15,700 K, -0.38). The S-stars Habibi et al. 2017
 *   fitted take their temperatures; the others the median of those, 25,130 K. Paumard's by
 *   type: O and the Wolf-Rayet and Ofpe/WN9 stars as O9 V, B0 as B0 V, B1 to B3 as their own
 *   class, and any later or unclassified as B5 V or O9 V (late B, untyped). Supergiants
 *   and Wolf-Rayet stars are hot like these and so nearly as blue in V - K, but not quite:
 *   a WC9 star's hot dust brightens its K, and its V is likely drawn too bright. A
 *   convention, and the About says so.
 * - **late-type stars** -- red giants -- take the colours of the cluster model's evolved
 *   stars of the same M_K (nuclearClusterPopulation.ts): the clump giants most of them are.
 * - **unclassified S-stars** (S39, S55) are taken as early-type, as 30 of the 38 typed are.
 * - **IRS 7**: V - K = 5.0 and B - V = 1.76, those of a red supergiant at 3,600 K on an 8
 *   Myr PARSEC isochrone (Paumard et al. 2014 give it 6.5 to 10 Myr).
 *
 * The colour drawn is the blackbody colour of the star's temperature (blackbody.ts), or of
 * its B - V for the giants, as for every star here.
 */

const AU_KM = 149_597_870.7;
const DAYS_PER_YEAR = 365.25;

/** The distance modulus to Sgr A*, at GRAVITY's distance. */
export const DISTANCE_MODULUS = 5 * Math.log10(SGR_A_DISTANCE_PC / 10);

/** K-band extinction, Fritz et al. 2011: toward Sgr A* (r < 0.5"), and over the central 14" x 20". */
export const A_K_SGR_A = 2.42;
export const A_K_CENTRAL = 2.62;

export type SpectralClass = 'early' | 'late' | null;

/** One row of Gillessen et al. 2017, Table 3: a in arcsec, angles in degrees, times in years. */
export interface GillessenOrbit {
  readonly name: string;
  readonly a: number;
  readonly e: number;
  readonly i: number;
  readonly node: number;
  readonly omega: number;
  readonly tp: number;
  /** Their period, years, and its error; null for the hyperbolic S111. */
  readonly T: number | null;
  readonly Terr: number | null;
  readonly type: SpectralClass;
  readonly mK: number;
}

/** Gillessen et al. 2017, Table 3, as published: all forty rows. */
export const GILLESSEN_2017_ORBITS: readonly GillessenOrbit[] = [
  { name: 'S1', a: 0.595, e: 0.556, i: 119.14, node: 342.04, omega: 122.3, tp: 2001.80, T: 166.0, Terr: 5.8, type: 'early', mK: 14.7 },
  { name: 'S2', a: 0.1255, e: 0.8839, i: 134.18, node: 226.94, omega: 65.51, tp: 2002.33, T: 16.00, Terr: 0.02, type: 'early', mK: 13.95 },
  { name: 'S4', a: 0.3570, e: 0.3905, i: 80.33, node: 258.84, omega: 290.8, tp: 1957.4, T: 77.0, Terr: 1.0, type: 'early', mK: 14.4 },
  { name: 'S6', a: 0.6574, e: 0.8400, i: 87.24, node: 85.07, omega: 116.23, tp: 2108.61, T: 192.0, Terr: 0.17, type: 'early', mK: 15.4 },
  { name: 'S8', a: 0.4047, e: 0.8031, i: 74.37, node: 315.43, omega: 346.70, tp: 1983.64, T: 92.9, Terr: 0.41, type: 'early', mK: 14.5 },
  { name: 'S9', a: 0.2724, e: 0.644, i: 82.41, node: 156.60, omega: 150.6, tp: 1976.71, T: 51.3, Terr: 0.70, type: 'early', mK: 15.1 },
  { name: 'S12', a: 0.2987, e: 0.8883, i: 33.56, node: 230.1, omega: 317.9, tp: 1995.59, T: 58.9, Terr: 0.22, type: 'early', mK: 15.5 },
  { name: 'S13', a: 0.2641, e: 0.4250, i: 24.70, node: 74.5, omega: 245.2, tp: 2004.86, T: 49.00, Terr: 0.14, type: 'early', mK: 15.8 },
  { name: 'S14', a: 0.2863, e: 0.9761, i: 100.59, node: 226.38, omega: 334.59, tp: 2000.12, T: 55.3, Terr: 0.48, type: 'early', mK: 15.7 },
  { name: 'S17', a: 0.3559, e: 0.397, i: 96.83, node: 191.62, omega: 326.0, tp: 1991.19, T: 76.6, Terr: 1.0, type: 'late', mK: 15.3 },
  { name: 'S18', a: 0.2379, e: 0.471, i: 110.67, node: 49.11, omega: 349.46, tp: 1993.86, T: 41.9, Terr: 0.18, type: 'early', mK: 16.7 },
  { name: 'S19', a: 0.520, e: 0.750, i: 71.96, node: 344.60, omega: 155.2, tp: 2005.39, T: 135, Terr: 14, type: 'early', mK: 16 },
  { name: 'S21', a: 0.2190, e: 0.764, i: 58.8, node: 259.64, omega: 166.4, tp: 2027.40, T: 37.00, Terr: 0.28, type: 'late', mK: 16.9 },
  { name: 'S22', a: 1.31, e: 0.449, i: 105.76, node: 291.7, omega: 95, tp: 1996.9, T: 540, Terr: 63, type: 'early', mK: 16.6 },
  { name: 'S23', a: 0.253, e: 0.56, i: 48.0, node: 249, omega: 39.0, tp: 2024.7, T: 45.8, Terr: 1.6, type: 'early', mK: 17.8 },
  { name: 'S24', a: 0.944, e: 0.8970, i: 103.67, node: 7.93, omega: 290, tp: 2024.50, T: 331, Terr: 16, type: 'late', mK: 15.6 },
  { name: 'S29', a: 0.428, e: 0.728, i: 105.8, node: 161.96, omega: 346.5, tp: 2025.96, T: 101.0, Terr: 2.0, type: 'early', mK: 16.7 },
  { name: 'S31', a: 0.449, e: 0.5497, i: 109.03, node: 137.16, omega: 308.0, tp: 2018.07, T: 108, Terr: 1.2, type: 'early', mK: 15.7 },
  { name: 'S33', a: 0.657, e: 0.608, i: 60.5, node: 100.1, omega: 303.7, tp: 1928, T: 192.0, Terr: 5.2, type: 'early', mK: 16 },
  { name: 'S38', a: 0.1416, e: 0.8201, i: 171.1, node: 101.06, omega: 17.99, tp: 2003.19, T: 19.2, Terr: 0.02, type: 'late', mK: 17 },
  { name: 'S39', a: 0.370, e: 0.9236, i: 89.36, node: 159.03, omega: 23.3, tp: 2000.06, T: 81.1, Terr: 1.5, type: null, mK: 16.8 },
  { name: 'S42', a: 0.95, e: 0.567, i: 67.16, node: 196.14, omega: 35.8, tp: 2008.24, T: 335, Terr: 58, type: 'early', mK: 17.5 },
  { name: 'S54', a: 1.20, e: 0.893, i: 62.2, node: 288.35, omega: 140.8, tp: 2004.46, T: 477, Terr: 199, type: 'early', mK: 17.5 },
  { name: 'S55', a: 0.1078, e: 0.7209, i: 150.1, node: 325.5, omega: 331.5, tp: 2009.34, T: 12.80, Terr: 0.11, type: null, mK: 17.5 },
  { name: 'S60', a: 0.3877, e: 0.7179, i: 126.87, node: 170.54, omega: 29.37, tp: 2023.89, T: 87.1, Terr: 1.4, type: 'early', mK: 16.3 },
  { name: 'S66', a: 1.502, e: 0.128, i: 128.5, node: 92.3, omega: 134, tp: 1771, T: 664, Terr: 37, type: 'early', mK: 14.8 },
  { name: 'S67', a: 1.126, e: 0.293, i: 136.0, node: 96.5, omega: 213.5, tp: 1705, T: 431, Terr: 10, type: 'early', mK: 12.1 },
  { name: 'S71', a: 0.973, e: 0.899, i: 74.0, node: 35.16, omega: 337.8, tp: 1695, T: 346, Terr: 11, type: 'early', mK: 16.1 },
  { name: 'S83', a: 1.49, e: 0.365, i: 127.2, node: 87.7, omega: 203.6, tp: 2046.8, T: 656, Terr: 69, type: 'early', mK: 13.6 },
  { name: 'S85', a: 4.6, e: 0.78, i: 84.78, node: 107.36, omega: 156.3, tp: 1930.2, T: 3580, Terr: 2550, type: 'late', mK: 15.6 },
  { name: 'S87', a: 2.74, e: 0.224, i: 119.54, node: 106.32, omega: 336.1, tp: 611, T: 1640, Terr: 105, type: 'early', mK: 13.6 },
  { name: 'S89', a: 1.081, e: 0.639, i: 87.61, node: 238.99, omega: 126.4, tp: 1783, T: 406, Terr: 27, type: 'late', mK: 15.3 },
  { name: 'S91', a: 1.917, e: 0.303, i: 114.49, node: 105.35, omega: 356.4, tp: 1108, T: 958, Terr: 50, type: 'early', mK: 12.2 },
  { name: 'S96', a: 1.499, e: 0.174, i: 126.36, node: 115.66, omega: 233.6, tp: 1646, T: 662, Terr: 29, type: 'early', mK: 10 },
  { name: 'S97', a: 2.32, e: 0.35, i: 113.0, node: 113.2, omega: 28, tp: 2132, T: 1270, Terr: 309, type: 'early', mK: 10.3 },
  { name: 'S111', a: -12.3, e: 1.092, i: 102.68, node: 52.34, omega: 132.4, tp: 1947.7, T: null, Terr: null, type: 'late', mK: 13.8 },
  { name: 'S145', a: 1.12, e: 0.50, i: 83.7, node: 263.92, omega: 185, tp: 1808, T: 426, Terr: 71, type: 'late', mK: 17.5 },
  { name: 'S175', a: 0.414, e: 0.9867, i: 88.53, node: 326.83, omega: 68.52, tp: 2009.51, T: 96.2, Terr: 5.0, type: 'early', mK: 17.5 },
  { name: 'R34', a: 1.81, e: 0.641, i: 136.0, node: 330, omega: 57.0, tp: 1522, T: 877, Terr: 83, type: 'early', mK: 14 },
  { name: 'R44', a: 3.9, e: 0.27, i: 131.0, node: 80.5, omega: 217, tp: 1963, T: 2730, Terr: 1350, type: 'early', mK: 14 },
];

/** GRAVITY Collaboration 2024 (A&A 692, A242), Table B.1: the three stars refitted with S2. */
export const GRAVITY_2024_ORBITS: Readonly<Record<string, Pick<GillessenOrbit, 'a' | 'e' | 'i' | 'node' | 'omega' | 'tp'>>> = {
  S29: { a: 0.39025, e: 0.9688, i: 144.24, node: 4.9259, omega: 203.68, tp: 2021.4102 },
  S38: { a: 0.14249, e: 0.81807, i: 168.69, node: 122.43, omega: 40.065, tp: 2022.6843 },
  S55: { a: 0.10424, e: 0.7298, i: 159.59, node: 319.43, omega: 327.77, tp: 2009.4738 },
};

/**
 * The S-stars' temperatures Habibi et al. 2017 (ApJ 847, 120; arXiv 1708.06353) fitted to
 * their spectra, Table 2, K. (S2's is the body's; S7 has no orbit.)
 */
export const HABIBI_2017_TEMPERATURES: Readonly<Record<string, number>> = {
  S1: 27_450,
  S2: 28_513,
  S4: 27_288,
  S6: 22_932,
  S7: 22_972,
  S8: 28_274,
  S9: 22_202,
  S12: 20_882,
};

/** The median of Habibi et al.'s eight: for an early-type S-star with no fit of its own. */
export const EARLY_S_STAR_TEMPERATURE = 25_130;

/**
 * Pecaut & Mamajek 2013 (table version 2022.04.16): Teff, B-V and V-Ks of the main
 * sequence from O9 to B5, hottest first.
 */
export const HOT_DWARFS: readonly (readonly [type: string, teff: number, bv: number, vk: number])[] = [
  ['O9V', 33_300, -0.312, -1.0],
  ['B0V', 31_400, -0.301, -0.958],
  ['B0.5V', 29_000, -0.289, -0.913],
  ['B1V', 26_000, -0.278, -0.874],
  ['B1.5V', 24_500, -0.252, -0.752],
  ['B2V', 20_600, -0.215, -0.602],
  ['B3V', 17_000, -0.178, -0.492],
  ['B5V', 15_700, -0.156, -0.38],
];

/** V - K of a hot star of a temperature, interpolated in the table above, held to its ends. */
export function hotStarVMinusK(teff: number): number {
  const rows = HOT_DWARFS;
  if (teff >= rows[0]![1]) return rows[0]![3];
  for (let k = 1; k < rows.length; k += 1) {
    const hot = rows[k - 1]!;
    const cool = rows[k]!;
    if (teff >= cool[1]) {
      const f = (teff - cool[1]) / (hot[1] - cool[1]);
      return cool[3] + (hot[3] - cool[3]) * f;
    }
  }
  return rows[rows.length - 1]![3];
}

/**
 * The colours of the model's evolved stars at an absolute K (nuclearClusterPopulation.ts,
 * EVOLVED_BY_K): the row the magnitude falls in, or the nearest there is.
 */
export function giantColours(absoluteK: number): { readonly vk: number; readonly bv: number } {
  let nearest = EVOLVED_BY_K[0]!;
  for (const row of EVOLVED_BY_K) {
    if (Math.abs(row[0] + 0.05 - absoluteK) < Math.abs(nearest[0] + 0.05 - absoluteK)) {
      nearest = row;
    }
  }
  return { vk: nearest[3], bv: nearest[2] };
}

/** A measured star as drawn: absolute V and B-V (the colour), whatever it was measured as. */
export interface MeasuredLook {
  readonly absoluteV: number;
  readonly colorIndex: number;
}

/** An early-type star's look from its K, extinction and temperature. */
function hotLook(mK: number, aK: number, teff: number): MeasuredLook {
  const absoluteK = mK - aK - DISTANCE_MODULUS;
  return { absoluteV: absoluteK + hotStarVMinusK(teff), colorIndex: colorIndexForTemperature(teff) };
}

/** A late-type star's look from its K. */
function coolLook(mK: number, aK: number): MeasuredLook {
  const absoluteK = mK - aK - DISTANCE_MODULUS;
  const { vk, bv } = giantColours(absoluteK);
  return { absoluteV: absoluteK + vk, colorIndex: bv };
}

// ---------------------------------------------------------------------------------------
// The S-stars

export interface SStar {
  readonly name: string;
  readonly orbit: SkyOrbit;
  readonly look: MeasuredLook;
  readonly type: SpectralClass;
  readonly mK: number;
  /** Which table the elements are from. */
  readonly source: 'gillessen2017' | 'gravity2024';
}

/** The sky orbit of elements in arcseconds and years, at GRAVITY's distance and mass. */
export function arcsecOrbit(elements: Pick<GillessenOrbit, 'a' | 'e' | 'i' | 'node' | 'omega' | 'tp'>): SkyOrbit {
  const semiMajorAxisKm = elements.a * SGR_A_DISTANCE_PC * AU_KM;
  return {
    semiMajorAxisKm,
    eccentricity: elements.e,
    inclinationDeg: elements.i,
    nodeDeg: elements.node,
    argPeriastronDeg: elements.omega,
    periastronJd: julianEpochJd(elements.tp),
    periodDays: keplerPeriodDays(semiMajorAxisKm, SGR_A_MASS_SUN),
  };
}

/** The 38 S-stars drawn on orbits: Table 3 less S2 and S111, three on GRAVITY's elements. */
export const S_STARS: readonly SStar[] = GILLESSEN_2017_ORBITS.filter(
  (row) => row.name !== 'S2' && row.a > 0,
).map((row) => {
  const gravity = GRAVITY_2024_ORBITS[row.name];
  const teff = HABIBI_2017_TEMPERATURES[row.name] ?? EARLY_S_STAR_TEMPERATURE;
  return {
    name: row.name,
    orbit: arcsecOrbit(gravity ?? row),
    look: row.type === 'late' ? coolLook(row.mK, A_K_SGR_A) : hotLook(row.mK, A_K_SGR_A, teff),
    type: row.type,
    mK: row.mK,
    source: gravity === undefined ? 'gillessen2017' : 'gravity2024',
  };
});

/** An S-star's place about Sgr A*, scene frame, km. */
export function sStarPosition(star: SStar, jd: number): Vec3 {
  return sgrASkyToScene(skyOrbitState(star.orbit, jd)).position;
}

/** Its period, years. */
export function periodYears(orbit: SkyOrbit): number {
  return orbit.periodDays / DAYS_PER_YEAR;
}

// ---------------------------------------------------------------------------------------
// The young stars and IRS 7

/** Paumard et al. 2006, Table 2: E number, other names, x and y (east, north, "), z or null, K, type. */
export const PAUMARD_2006: readonly (readonly [
  id: string,
  names: string,
  x: number,
  y: number,
  z: number | null,
  mK: number,
  type: string,
])[] = [
  ['E1', 'S2,S02', 0.04, 0.12, null, 14.0, 'B0-2 V'],
  ['E2', 'S14,S016', 0.12, 0.07, null, 15.7, 'B4-9 V'],
  ['E3', 'S13,S020', -0.16, 0.00, null, 15.8, 'B4-9 V'],
  ['E4', 'S1,S01', -0.04, -0.20, null, 14.5, 'B0-2 V'],
  ['E5', 'S12,S019', -0.06, 0.26, null, 15.5, 'B4-9 V'],
  ['E6', 'S4,S03', 0.26, 0.11, null, 14.4, 'B0-2 V'],
  ['E7', 'S08', -0.30, 0.27, null, 15.8, 'B4-9 V'],
  ['E8', 'S5', 0.36, 0.17, null, 15.0, 'B4-9 V'],
  ['E9', 'S9,S05', 0.18, -0.36, null, 15.1, 'B0-2 V'],
  ['E10', 'S8,S04', 0.37, -0.26, null, 14.5, 'B0-2 V'],
  ['E11', 'S6,S07', 0.47, 0.09, null, 15.4, 'B V'],
  ['E12', 'S7,S011', 0.53, -0.05, null, 15.2, 'B V'],
  ['E13', '', 0.53, 0.43, null, 15.1, 'B V'],
  ['E14', 'S014', -0.78, -0.28, null, 13.7, 'O9.5-B2 V'],
  ['E15', 'S1-3', 0.43, 0.86, 1.57, 12.2, '?'],
  ['E16', 'S015', -0.94, 0.26, 0.22, 13.6, 'O9-9.5 V'],
  ['E17', '', -0.04, -1.01, -1.70, 14.7, '?'],
  ['E18', '', -0.66, -0.87, -1.96, 14.1, 'OB'],
  ['E19', 'IRS16NW', 0.03, 1.21, null, 10.0, 'Ofpe/WN9'],
  ['E20', 'IRS16C', 1.13, 0.48, 1.22, 9.7, 'Ofpe/WN9'],
  ['E21', '', -0.85, -1.00, -1.91, 13.8, 'OB I?'],
  ['E22', '', -1.36, -0.31, -0.90, 12.8, 'O8-9.5 III/I'],
  ['E23', 'IRS16SW', 1.05, -0.98, -1.46, 9.9, 'Ofpe/WN9'],
  ['E24', '', -1.67, 0.14, -0.21, 13.1, 'O9-9.5 III?'],
  ['E25', '', -1.64, -0.50, -1.15, 12.7, 'O8.5-9.5 I?'],
  ['E26', 'IRS16SSW', 0.72, -1.60, null, 11.5, 'O8-9.5 I'],
  ['E27', 'IRS16CC', 2.01, 0.54, 1.35, 10.4, 'O9.5-B0.5 I'],
  ['E28', 'IRS16SSE2', 1.45, -1.49, -2.13, 12.4, 'B0-0.5 I'],
  ['E29', '', 0.99, 1.83, 3.21, 13.7, 'O9-B0'],
  ['E30', 'IRS16SSE1', 1.59, -1.36, -1.85, 12.2, 'O8.5-9.5 I'],
  ['E31', 'IRS29N', -1.60, 1.41, null, 10.0, 'WC9'],
  ['E32', 'MPE+1.6-6.8(16SE1)', 1.85, -1.15, -1.52, 10.9, 'WC8/9'],
  ['E33', 'IRS33N', -0.06, -2.19, null, 11.1, 'B0.5-1 I'],
  ['E34', 'MPE+1.0-7.4(16S)', 1.27, -1.88, -2.70, 10.7, 'B0.5-1 I'],
  ['E35', 'IRS29NE1', -0.99, 2.06, 2.99, 11.7, 'WC8/9'],
  ['E36', '', 0.45, 2.29, 3.52, 12.5, 'O9-B0 I?'],
  ['E37', '', -1.47, 2.17, null, 14.8, 'O8-9 I?'],
  ['E38', '', 0.19, 2.76, 3.47, 13.1, 'O8-9 III/I'],
  ['E39', 'IRS16NE', 2.87, 1.03, null, 8.9, 'Ofpe/WN9'],
  ['E40', 'IRS16SE2', 2.94, -1.19, -1.20, 12.0, 'WN5/6'],
  ['E41', 'IRS33E', 0.65, -3.12, -3.57, 10.1, 'Ofpe/WN9'],
  ['E42', '', -3.13, -0.66, null, 14.6, 'B V/III'],
  ['E43', '', -1.60, -2.79, -3.57, 12.2, 'O8.5-9.5 I'],
  ['E44', '', 1.45, 2.95, 3.63, 13.8, 'O9-B0 II/I?'],
  ['E45', '', -2.61, -2.08, null, 12.5, 'O9-B0 I'],
  ['E46', 'IRS13E1', -2.94, -1.64, null, 10.7, 'B0-1 I'],
  ['E47', '', 1.67, -2.97, null, 12.5, 'B0-3 I'],
  ['E48', 'IRS13E4', -3.19, -1.42, null, 11.7, 'WC9'],
  ['E49', 'IRS13E3', -3.19, -1.51, null, 13.0, '?'],
  ['E50', 'IRS16SE3', 3.35, -1.16, -0.93, 11.9, 'O8.5-9.5 I'],
  ['E51', 'IRS13E2', -3.14, -1.74, null, 10.8, 'WN 8'],
  ['E52', '', -1.26, 3.62, null, 13.3, 'O8-9 III'],
  ['E53', '', -2.76, -2.83, null, 12.4, 'B0-1 I'],
  ['E54', 'IRS34E', -3.67, 1.80, 2.12, 12.6, 'O9-9.5 I'],
  ['E55', '', 0.77, -4.06, null, 12.5, 'B0-1 I?'],
  ['E56', 'IRS34W', -4.05, 1.59, 1.55, 11.4, 'Ofpe/WN9'],
  ['E57', '', 4.42, 0.25, 1.48, 13.5, 'O7-9 III?'],
  ['E58', 'IRS3E', -2.26, 3.80, null, 15.0, 'WC5/6'],
  ['E59', '[PMM2001] B9', 2.94, 3.46, null, 13.0, 'WC9'],
  ['E60', '', -4.36, -1.65, null, 12.4, 'WN7?'],
  ['E61', 'IRS34NW', -3.73, 2.85, 3.08, 12.8, 'WN7'],
  ['E62', '', 2.18, 4.48, null, 11.5, 'B0-3 I'],
  ['E63', 'IRS1W', 5.27, 0.57, null, 9.6, 'Be?'],
  ['E64', '', 5.81, 0.05, null, 12.4, 'O9.5-B2II'],
  ['E65', 'IRS9W', 2.85, -5.62, null, 12.1, 'WN8'],
  ['E66', 'IRS7SW', -3.95, 4.93, null, 12.0, 'WN8'],
  ['E67', 'IRS1E', 6.37, 0.23, null, 11.2, 'B1-3 I'],
  ['E68', 'IRS7W', -2.45, 5.99, null, 13.1, 'WC9'],
  ['E69', '', 1.81, -6.32, null, 11.1, '?'],
  ['E70', 'IRS7E2(ESE)', 4.41, 4.97, null, 12.9, 'Ofpe/WN9'],
  ['E71', '', 1.59, 6.49, null, 14.1, 'WC8/9 ?'],
  ['E72', '', 6.71, -0.50, null, 13.6, 'WC9?'],
  ['E73', '', -1.08, 7.65, null, 11.5, 'O9-B I'],
  ['E74', 'AFNW', -7.63, -3.57, null, 11.7, 'WN8'],
  ['E75', '', -0.02, 8.53, null, 11.0, 'O9-B I'],
  ['E76', 'IRS9SW', 4.28, -8.03, null, 13.1, 'WC9'],
  ['E77', '', -1.23, 9.15, null, 13.6, 'O9-B0 V'],
  ['E78', '[PMM2001] B1', 9.46, 0.31, null, 13.0, 'WC9'],
  ['E79', 'AF', -6.54, -6.91, null, 10.8, 'Ofpe/WN9'],
  ['E80', 'IRS9SE', 5.65, -8.17, null, 11.7, 'WC9'],
  ['E81', 'AFNWNW', -9.63, -2.58, null, 12.6, 'WN7'],
  ['E82', 'Blum', -8.63, -5.33, null, 13.0, 'WC8/9'],
  ['E83', 'IRS15SW', -1.58, 10.02, null, 12.0, 'WN8/WC9'],
  ['E84', '', 0.08, 10.24, null, 11.3, 'O9-B I'],
  ['E85', '', 9.68, 4.39, null, 12.8, 'OB'],
  ['E86', '', -0.53, 10.72, null, 15.0, 'OB V ?'],
  ['E87', '', 2.58, 10.94, null, 13.7, 'B V/III'],
  ['E88', 'IRS15NE', 1.38, 11.68, null, 11.8, 'WN8/9'],
  ['E89', '', 0.00, 12.27, null, 14.5, 'B1-3  V'],
  ['E90', '', 11.87, 5.86, null, 12.1, 'O9-B1 I?'],
];

/** The temperature a Paumard type is drawn at (see the header). */
export function paumardTemperature(type: string): number {
  const match = /^B(\d)/.exec(type);
  if (match !== null) {
    const subclass = Number(match[1]);
    if (subclass === 0) return 31_400;
    if (subclass === 1) return 26_000;
    if (subclass === 2) return 20_600;
    if (subclass === 3) return 17_000;
    return 15_700;
  }
  if (/^B ?V|^B V/.test(type)) return 15_700;
  return 33_300;
}

/** A star placed by offset from Sgr A*, not on an orbit: its place about the hole in km, and its look. */
export interface PlacedStar {
  readonly name: string;
  readonly position: Vec3;
  readonly look: MeasuredLook;
  /** Whether its depth along the line of sight is measured, not drawn. */
  readonly depthMeasured: boolean;
}

/** The epoch the young stars' places are matched to the orbits at. */
export const PAUMARD_EPOCH_JD = julianEpochJd(2005);

const ARCSEC_KM = SGR_A_DISTANCE_PC * AU_KM;

/** mulberry32, for the depths drawn. */
function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Where the young stars end, arcseconds: no OB stars past 13" (Paumard et al.). */
const YOUNG_EDGE_ARCSEC = 13;

/** An S-star with an orbit at the same place and brightness as a Paumard star in 2005, or null. */
export function orbitTwin(x: number, y: number, mK: number): string | null {
  const orbits = [
    ...S_STARS.map((star) => ({ name: star.name, orbit: star.orbit, mK: star.mK })),
    { name: 'S2', orbit: arcsecOrbit(S2_ORBIT_ARCSEC), mK: 13.95 },
  ];
  for (const { name, orbit, mK: k } of orbits) {
    const at = skyOrbitState(orbit, PAUMARD_EPOCH_JD).position;
    const dx = at.east / ARCSEC_KM - x;
    const dy = at.north / ARCSEC_KM - y;
    if (Math.hypot(dx, dy) <= 0.15 && Math.abs(k - mK) <= 0.8) {
      return name;
    }
  }
  return null;
}

const S2_ORBIT_ARCSEC = {
  a: S2_ORBIT.semiMajorAxisArcsec,
  e: S2_ORBIT.eccentricity,
  i: S2_ORBIT.inclinationDeg,
  node: S2_ORBIT.nodeDeg,
  omega: S2_ORBIT.argPeriastronDeg,
  tp: S2_ORBIT.periastronYear,
};

/** The young stars drawn: Paumard's table less the central arcsecond and the orbit stars. */
export const YOUNG_STARS: readonly PlacedStar[] = (() => {
  const random = generator(20060601);
  const out: PlacedStar[] = [];
  for (const [id, names, x, y, z, mK, type] of PAUMARD_2006) {
    // A depth is drawn for every star, used or not, so each keeps its own whatever is left out.
    const u = 2 * random() - 1;
    const p = Math.hypot(x, y);
    if (p < 1 || orbitTwin(x, y, mK) !== null) {
      continue;
    }
    const drawn = Math.max(-YOUNG_EDGE_ARCSEC, Math.min(YOUNG_EDGE_ARCSEC, (p * u) / Math.sqrt(1 - u * u)));
    const sky = { east: x * ARCSEC_KM, north: y * ARCSEC_KM, away: (z ?? drawn) * ARCSEC_KM };
    const position = sgrASkyToScene({ position: sky, velocity: { east: 0, north: 0, away: 0 } }).position;
    out.push({
      name: names === '' ? id : names.split(',')[0]!,
      position,
      look: hotLook(mK, A_K_CENTRAL, paumardTemperature(type)),
      depthMeasured: z !== null,
    });
  }
  return out;
})();

/** IRS 7: Reid et al. 2003's maser offset, Paumard et al. 2014's photometry. */
export const IRS7 = {
  eastArcsec: 0.0364,
  northArcsec: 5.5461,
  mK: 6.8,
  aK: 3.48,
  temperatureK: 3600,
  vMinusK: 5.0,
  colorIndex: 1.76,
} as const;

export const IRS7_STAR: PlacedStar = {
  name: 'IRS 7',
  position: sgrASkyToScene({
    position: { east: IRS7.eastArcsec * ARCSEC_KM, north: IRS7.northArcsec * ARCSEC_KM, away: 0 },
    velocity: { east: 0, north: 0, away: 0 },
  }).position,
  look: { absoluteV: IRS7.mK - IRS7.aK - DISTANCE_MODULUS + IRS7.vMinusK, colorIndex: IRS7.colorIndex },
  depthMeasured: false,
};

/** Every placed star: the young ones and IRS 7. */
export const PLACED_STARS: readonly PlacedStar[] = [...YOUNG_STARS, IRS7_STAR];
