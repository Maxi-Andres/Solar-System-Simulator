/**
 * Gaia's G and BP-RP to Johnson V and B-V, for the stars only Gaia measured.
 *
 * The app's stars are drawn from V and B-V: V sets the brightness, B-V the colour
 * through Ballesteros's temperature (web/src/scene/blackbody.ts). Hipparcos and Tycho-2
 * give those; Gaia gives G and BP-RP, through its own much wider passbands. So a GCNS
 * star the sky does not already hold has to be carried across, and this is the one
 * place the 3D stars' photometry is transformed rather than measured -- flagged per star
 * (STAR3D_FLAGS.GAIA_PHOTOMETRY), as the sky flags its Tycho-2 third.
 *
 * **One table for both, along the main sequence.** Mamajek's "A Modern Mean Dwarf
 * Stellar Color and Effective Temperature Sequence" (version 2022.04.16, the update of
 * Pecaut & Mamajek 2013, ApJS 208, 9) tabulates B-V, G-V and Bp-Rp side by side for
 * each dwarf spectral type, so V and B-V come out of the same row, consistently with
 * each other. It covers B9V to M8.5V in Bp-Rp, -0.12 to 5.10, where Bp-Rp rises
 * monotonically and can be interpolated in. The GCNS is overwhelmingly dwarfs -- M
 * dwarfs above all, which the polynomial fits (Riello et al. 2021) leave by Bp-Rp 5 and
 * which this table follows to M8.5 -- so the sequence fits the sample it is used for.
 *
 * What it is not: a giant's or a white dwarf's colour-colour relation. A white dwarf of
 * a given Bp-Rp is given the B-V of the dwarf with that Bp-Rp, which is close -- both
 * are nearly blackbodies -- but not equal. Outside the table's range a star takes the
 * nearest end's values, and the count of those is published (`clamped`). Both are
 * colour for a dot, not photometry for science, and the flag says which stars carry it.
 *
 * The table's G and Bp-Rp are Gaia DR2's; DR3's passbands differ from them by
 * hundredths of a magnitude (Riello et al. 2021, Sect. 6), below what a dot can show.
 */

/** [Bp-Rp, B-V, G-V] per spectral type, B9V to M8.5V, copied from the table. */
export const DWARF_SEQUENCE: readonly (readonly [number, number, number])[] = [
  [-0.12, -0.07, 0.018], // B9V
  [-0.087, -0.05, 0.017], // B9.5V
  [-0.037, 0.0, 0.015], // A0V
  [0.005, 0.035, 0.01], // A1V
  [0.068, 0.07, 0.0], // A2V
  [0.11, 0.1, -0.005], // A3V
  [0.166, 0.14, -0.01], // A4V
  [0.194, 0.16, -0.015], // A5V
  [0.222, 0.185, -0.02], // A6V
  [0.263, 0.21, -0.03], // A7V
  [0.32, 0.25, -0.04], // A8V
  [0.327, 0.27, -0.05], // A9V
  [0.377, 0.295, -0.06], // F0V
  [0.434, 0.33, -0.07], // F1V
  [0.49, 0.37, -0.08], // F2V
  [0.518, 0.39, -0.09], // F3V
  [0.546, 0.41, -0.1], // F4V
  [0.587, 0.44, -0.11], // F5V
  [0.64, 0.486, -0.13], // F6V
  [0.67, 0.5, -0.14], // F7V
  [0.694, 0.53, -0.15], // F8V
  [0.719, 0.56, -0.145], // F9V
  [0.767, 0.58, -0.155], // F9.5V
  [0.784, 0.595, -0.155], // G0V
  [0.803, 0.622, -0.158], // G1V
  [0.823, 0.65, -0.165], // G2V
  [0.832, 0.66, -0.167], // G3V
  [0.841, 0.67, -0.173], // G4V
  [0.85, 0.68, -0.179], // G5V
  [0.869, 0.7, -0.186], // G6V
  [0.88, 0.71, -0.194], // G7V
  [0.9, 0.73, -0.202], // G8V
  [0.95, 0.775, -0.21], // G9V
  [0.983, 0.816, -0.227], // K0V
  [1.01, 0.857, -0.25], // K1V
  [1.1, 0.884, -0.27], // K2V
  [1.21, 0.99, -0.32], // K3V
  [1.34, 1.09, -0.42], // K4V
  [1.43, 1.15, -0.44], // K5V
  [1.53, 1.24, -0.51], // K6V
  [1.7, 1.34, -0.58], // K7V
  [1.73, 1.363, -0.625], // K8V
  [1.79, 1.4, -0.66], // K9V
  [1.84, 1.42, -0.7], // M0V
  [1.97, 1.445, -0.76], // M0.5V
  [2.09, 1.485, -0.82], // M1V
  [2.13, 1.495, -0.87], // M1.5V
  [2.23, 1.505, -0.925], // M2V
  [2.39, 1.522, -1.02], // M2.5V
  [2.5, 1.53, -1.1], // M3V
  [2.78, 1.6, -1.28], // M3.5V
  [2.94, 1.65, -1.4], // M4V
  [3.16, 1.69, -1.54], // M4.5V
  [3.35, 1.83, -1.7], // M5V
  [3.71, 1.94, -1.95], // M5.5V
  [4.16, 2.01, -2.37], // M6V
  [4.5, 2.07, -2.7], // M6.5V
  [4.65, 2.12, -2.98], // M7V
  [4.72, 2.14, -3.15], // M7.5V
  [4.86, 2.15, -3.11], // M8V
  [5.1, 2.16, -3.09], // M8.5V
];

export interface JohnsonFromGaia {
  readonly v: number;
  readonly bv: number;
  /** True when BP-RP lay outside the table and the nearest end was used. */
  readonly clamped: boolean;
}

/** V and B-V from G and BP-RP, by linear interpolation along the dwarf sequence. */
export function johnsonFromGaia(g: number, bpRp: number): JohnsonFromGaia {
  const first = DWARF_SEQUENCE[0]!;
  const last = DWARF_SEQUENCE[DWARF_SEQUENCE.length - 1]!;
  if (bpRp <= first[0] || bpRp >= last[0]) {
    const end = bpRp <= first[0] ? first : last;
    return { v: g - end[2], bv: end[1], clamped: bpRp !== end[0] };
  }
  let high = 1;
  while (DWARF_SEQUENCE[high]![0] < bpRp) {
    high += 1;
  }
  const below = DWARF_SEQUENCE[high - 1]!;
  const above = DWARF_SEQUENCE[high]!;
  const t = (bpRp - below[0]) / (above[0] - below[0]);
  const bv = below[1] + t * (above[1] - below[1]);
  const gMinusV = below[2] + t * (above[2] - below[2]);
  return { v: g - gMinusV, bv, clamped: false };
}
