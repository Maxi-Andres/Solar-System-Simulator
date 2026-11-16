/**
 * A galaxy's brightness and colour as G3 draws them -- absolute V and B-V, Vega -- from the
 * SDSS's five bands, at redshifts where the bands no longer see what they were made for.
 *
 * ## Rest-frame B and V, read off the observed bands
 *
 * Light emitted at wavelength lambda arrives at lambda (1 + z): at z 0.5 a galaxy's rest-frame
 * V (5456 A) is seen in the SDSS i band, and its observed g - r is its rest-frame ultraviolet,
 * a magnitude redder than its true colour. So each galaxy's AB magnitudes, extinction-
 * corrected, are put at the bands' effective wavelengths (Blanton & Roweis 2007, AJ 133, 734,
 * Table 1: u 3546, g 4670, r 6156, i 7472, z 8917 A) and read, linearly in log wavelength,
 * at the rest-frame B and V (Bessell's, 4344 and 5456 A, the same table) moved to lambda (1 +
 * z). The redder of the two leaves the z band past z 0.63 (V) and 1.05 (B): there the
 * i - z slope is carried on, at most 0.04 dex in wavelength at z 0.8, and the galaxy is flagged
 * (COLOUR_EXTRAPOLATED). An interpolated K-correction, the simplest there is; it takes no
 * account of the bands' widths, and the calibration below takes its mean error out where G3
 * and this layer meet.
 *
 * - **AB**: SDSS magnitudes are AB but for u, 0.04 mag too faint, and z, by about 0.02 mag the
 *   other way (u_AB = u - 0.04, z_AB = z + 0.02: SDSS's flux calibration notes).
 * - **Vega**: B_Vega = B_AB + 0.09, V_Vega = V_AB - 0.02 (Blanton & Roweis 2007, Table 1), so
 *   B-V is 0.11 redder in Vega's system than in AB.
 * - **Absolute**: for a band moved by exactly 1 + z the K-correction is -2.5 log10(1 + z)
 *   (Hogg et al. 2002, arXiv:astro-ph/0210394): M = m(lambda (1 + z)) - 5 log10(d_L /
 *   10 pc) + 2.5 log10(1 + z), d_L = (1 + z) times the comoving distance the galaxy is placed
 *   at. G3 applies no K-correction (its galaxies are within z 0.1): the two differ by under
 *   0.1 mag where they meet, which the calibration takes out.
 *
 * ## Calibrated on G3 where the two meet
 *
 * The SDSS's Petrosian magnitudes miss a de Vaucouleurs galaxy's outer light (a fifth of it:
 * Blanton et al. 2001), BOSS's model magnitudes less so, and G3's V is HyperLEDA's total. So
 * the V and B-V found here are moved, each by one median offset, onto G3's: over the galaxies
 * both G3 and the SDSS main sample hold whose V and B-V G3 measured; and BOSS's onto the main
 * sample's so calibrated, over the galaxies both hold (cosmicWeb.ts calibrate). The offsets
 * and their scatter are in cosmic-web.json.
 */

/** The SDSS bands' effective wavelengths, A (Blanton & Roweis 2007, Table 1). */
export const SDSS_BANDS_A = [3546, 4670, 6156, 7472, 8917] as const;
/** Bessell's B and V, A (the same table). */
export const B_A = 4344;
export const V_A = 5456;
/** SDSS to AB, magnitudes, u g r i z: u_AB = u - 0.04, z_AB = z + 0.02. */
export const SDSS_TO_AB = [-0.04, 0, 0, 0, 0.02] as const;
/** m_AB - m_Vega for B and V (Blanton & Roweis 2007, Table 1). */
export const B_AB_MINUS_VEGA = -0.09;
export const V_AB_MINUS_VEGA = 0.02;

const LOG_BANDS = SDSS_BANDS_A.map(Math.log10);

/**
 * The AB magnitude at `wavelengthA`, read linearly in log wavelength between the observed
 * bands (`ab`: u g r i z, AB, NaN where not measured); carried on from the last two measured
 * bands past either end. `extrapolated` says it was.
 */
export function magnitudeAt(ab: readonly number[], wavelengthA: number): { mag: number; extrapolated: boolean } {
  const x = Math.log10(wavelengthA);
  const known = [0, 1, 2, 3, 4].filter((i) => Number.isFinite(ab[i]));
  if (known.length < 2) {
    return { mag: Number.NaN, extrapolated: false };
  }
  let lo = known[0]!;
  let hi = known[1]!;
  let extrapolated = x < LOG_BANDS[lo]!;
  for (let k = 0; k + 1 < known.length; k += 1) {
    lo = known[k]!;
    hi = known[k + 1]!;
    if (x <= LOG_BANDS[hi]!) break;
  }
  if (x > LOG_BANDS[known[known.length - 1]!]!) extrapolated = true;
  const t = (x - LOG_BANDS[lo]!) / (LOG_BANDS[hi]! - LOG_BANDS[lo]!);
  return { mag: ab[lo]! + t * (ab[hi]! - ab[lo]!), extrapolated };
}

export interface RestFrame {
  /** Apparent V and B-V, Vega, as the rest frame has them (before the calibration). */
  readonly v: number;
  readonly bv: number;
  /** Absolute V, Vega: -5 log10(d_L / 10 pc) and the band-shift K-correction applied. */
  readonly absV: number;
  readonly extrapolated: boolean;
}

/**
 * Rest-frame V and B-V of a galaxy of SDSS magnitudes `sdss` (u g r i z, extinction-
 * corrected; NaN where not measured) at CMB-frame redshift `z`, placed at comoving distance
 * `comovingPc`.
 */
export function restFrame(sdss: readonly number[], z: number, comovingPc: number): RestFrame {
  const ab = sdss.map((m, i) => m + SDSS_TO_AB[i]!);
  const b = magnitudeAt(ab, B_A * (1 + z));
  const v = magnitudeAt(ab, V_A * (1 + z));
  const vVega = v.mag - V_AB_MINUS_VEGA;
  const bVega = b.mag - B_AB_MINUS_VEGA;
  const luminosityPc = (1 + z) * comovingPc;
  return {
    v: vVega,
    bv: bVega - vVega,
    absV: vVega - 5 * Math.log10(luminosityPc / 10) + 2.5 * Math.log10(1 + z),
    extrapolated: b.extrapolated || v.extrapolated,
  };
}

/** SDSS magnitudes from fluxes in nanomaggies (m = 22.5 - 2.5 log10 f), less the extinction; NaN for a flux not above 0. */
export function nanomaggiesToMagnitudes(flux: readonly number[], extinction: readonly number[]): number[] {
  return flux.map((f, i) => (f > 0 ? 22.5 - 2.5 * Math.log10(f) - extinction[i]! : Number.NaN));
}

/** The median of `values` (finite ones) and the median absolute deviation about it, scaled to a Gaussian's sigma. */
export function medianAndScatter(values: readonly number[]): { median: number; scatter: number; count: number } {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length === 0) return { median: Number.NaN, scatter: Number.NaN, count: 0 };
  const median = (list: number[]) => (list.length % 2 === 1 ? list[list.length >> 1]! : (list[list.length / 2 - 1]! + list[list.length / 2]!) / 2);
  const m = median(finite);
  const deviations = finite.map((v) => Math.abs(v - m)).sort((a, b) => a - b);
  return { median: m, scatter: 1.4826 * median(deviations), count: finite.length };
}
