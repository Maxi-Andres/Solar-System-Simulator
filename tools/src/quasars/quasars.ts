import { Footprint, FOOTPRINT_CELL_DEG2, FOOTPRINT_DEC_BANDS, FOOTPRINT_RA_CELLS } from '../cosmicWeb/cosmicWeb.ts';
import { unitVector, type Vec3 } from '../laniakea/frames.ts';
import { toScene } from '../stars/build3d.ts';
import {
  QUASAR_ABS_V,
  QUASAR_BV,
  QUASAR_BYTES,
  QUASAR_FLAGS,
  QUASAR_POSITION_UNIT_PC,
  type QuasarsInfo,
  type RecordHolderCheck,
  type SzClustersInfo,
} from './format.ts';
import { distanceModulus, distanceModulusDr16q, omegaRadiation, PLANCK18, PLANCK_DISTANCES } from './planck.ts';
import type { AsuTable } from './sources.ts';

/**
 * The quasars of SDSS DR16Q, each where its redshift puts it, as bright as it is.
 *
 * ## Where
 *
 * At the comoving distance of its redshift in Planck 2018 (planck.ts says why not the cosmic
 * web's cosmology), along its direction: where it is now, on the Hubble flow, in the one
 * instant the scene is, as the record-holders are. The redshift is DR16Q's best (Z: a person's
 * look at the spectrum where there was one, else the pipelines'), heliocentric, as published --
 * the record-holders' are too; the Sun's 370 km/s against the CMB moves a quasar at z 2 by a
 * part in a thousand.
 *
 * ## How bright
 *
 * A quasar's light reaches us stretched: each photon's energy and the rate they arrive at both
 * fall by 1 + z, and the band we see it in is a bluer band of its own -- the i band, 7,472 A,
 * is its ultraviolet at 2,500 A at z 2. So its luminosity is not its magnitude and the distance
 * alone. The K-correction of Richards et al. 2006 (their Table 4: the SDSS composite quasar's
 * continuum and emission lines through the i band, every 0.01 in z) takes the band back, and
 * the luminosity distance, (1 + z) times the comoving, the stretching:
 *
 *   M_i(z = 2) = i - A_i - 5 log10(d_L / 10 pc) - K(z)
 *
 * -- DR16Q's own definition of its M_i (Lyke et al. 2020, after Richards et al. 2006), here in
 * Planck 2018. Then rest-frame V for the app, which draws everything by absolute V: M_i(z = 0)
 * = M_i(z = 2) + 0.596 (Richards et al.'s eq. 4, the alpha_nu = -0.5 continuum from z 2 to 0),
 * V from i along the same continuum (+0.171), and AB to Vega (-0.02): M_V = M_i(z = 2) + 0.747.
 * Checked on every run against the catalogue's own M_i, moved to its cosmology (checks).
 *
 * ## What colour
 *
 * Rest-frame B - V is past the SDSS's bands for nearly every quasar, so each is the composite
 * quasar's, the alpha_nu = -0.5 power law: B - V = 0.234 (Vega) -- 3C 273's measured is 0.21 --
 * moved by how much redder or bluer than the quasars of its redshift it is: its g - i less the
 * catalogue's median g - i in its redshift bin, Delta(g - i) (Richards et al. 2003, AJ 126,
 * 1131: the measure of a quasar's reddening by dust). As a change of the power law's slope, a
 * Delta(g - i) is 0.485 of itself in B - V. Only below z 2.2, where g is still red of
 * Lyman-alpha; past it, and where g or i is noisier than 0.2 mag, the composite's alone
 * (COLOUR_COMPOSITE).
 */

const DEG = Math.PI / 180;
const ARCSEC = DEG / 3600;

/** M_V (Vega, rest frame) from DR16Q's M_i(z = 2) (see the header). */
export const MI_Z2_TO_Z0 = 0.596;
export const I_TO_V_CONTINUUM = 1.25 * Math.log10(7472 / 5456);
export const V_AB_MINUS_VEGA = 0.02;
export const MV_FROM_MI_Z2 = MI_Z2_TO_Z0 + I_TO_V_CONTINUUM - V_AB_MINUS_VEGA;
/** The composite's B - V, Vega: alpha_nu = -0.5 between B (4344 A) and V (5456 A), and AB to Vega (+0.11). */
export const COMPOSITE_BV = 1.25 * Math.log10(5456 / 4344) + 0.09 + 0.02;
/** How much of a Delta(g - i) is B - V's, for a change in the power law's slope. */
export const DELTA_GI_TO_BV = Math.log10(5456 / 4344) / Math.log10(7472 / 4670);
/** Below this z, g is red of Lyman-alpha and g - i measures the continuum. */
export const COLOUR_Z_MAX = 2.2;
export const COLOUR_BIN_DZ = 0.05;
export const COLOUR_MAG_ERROR_MAX = 0.2;
/** A BAL quasar: DR16Q's BAL_PROB at least this. */
export const BAL_PROBABILITY = 0.75;
/** The record-holders are matched within this. */
export const RECORD_HOLDER_MATCH_ARCSEC = 5;
/** Quasars a chunk: 1.2 MB. */
export const CHUNK_QUASARS = 131_072;
/** Shells counted in, pc. */
export const SHELL_PC = 500e6;

// ---------------------------------------------------------------------------------------
// The K-correction

/** Richards et al. 2006's Table 4: K at z, every 0.01, read linearly; past its end carried on along the continuum. */
export class KCorrection {
  readonly zMax: number;
  private readonly z: Float64Array;
  private readonly k: Float64Array;

  constructor(z: Float64Array, k: Float64Array) {
    const order = Array.from(z, (_, i) => i).filter((i) => Number.isFinite(z[i]) && Number.isFinite(k[i])).sort((a, b) => z[a]! - z[b]!);
    this.z = Float64Array.from(order, (i) => z[i]!);
    this.k = Float64Array.from(order, (i) => k[i]!);
    if (this.z.length < 500 || this.z[0] !== 0) throw new Error(`Richards et al.'s K-corrections: ${this.z.length} rows from z ${this.z[0]}, where the table has 550 from 0.`);
    this.zMax = this.z[this.z.length - 1]!;
  }

  /** K at z, and whether it was carried past the table's end. */
  at(z: number): { k: number; extrapolated: boolean } {
    if (z >= this.zMax) {
      // The continuum's K, -2.5 (1 + alpha) log10(1 + z) + const, alpha -0.5, from the last row.
      return { k: this.k[this.k.length - 1]! - 1.25 * Math.log10((1 + z) / (1 + this.zMax)), extrapolated: z > this.zMax };
    }
    let lo = 0;
    let hi = this.z.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.z[mid]! <= z) lo = mid;
      else hi = mid;
    }
    const t = (z - this.z[lo]!) / (this.z[hi]! - this.z[lo]!);
    return { k: this.k[lo]! + t * (this.k[hi]! - this.k[lo]!), extrapolated: false };
  }
}

// ---------------------------------------------------------------------------------------
// The quasars, built

export interface BuiltQuasar {
  readonly position: Vec3;
  readonly z: number;
  /** Absolute V, Vega, rest frame; NaN unknown. */
  readonly absV: number;
  readonly bv: number;
  readonly flags: number;
}

export interface QuasarBuild {
  readonly quasars: BuiltQuasar[];
  readonly counts: Record<string, number>;
  readonly footprint: Footprint;
  readonly recordHolders: RecordHolderCheck[];
  readonly checks: QuasarsInfo['checks'];
}

/** The median of the finite values, or NaN. */
export function median(values: ArrayLike<number>): number {
  const finite = Array.from(values).filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length === 0) return Number.NaN;
  const n = finite.length;
  return n % 2 === 1 ? finite[n >> 1]! : (finite[n / 2 - 1]! + finite[n / 2]!) / 2;
}

/** The scene-frame point, pc, of a direction and a redshift: its comoving distance in Planck 2018. */
export function quasarScenePc(raDeg: number, decDeg: number, z: number): Vec3 {
  const d = PLANCK_DISTANCES.distance(z) * 1e6;
  const u = unitVector(raDeg, decDeg);
  return toScene([u[0] * d, u[1] * d, u[2] * d]);
}

/**
 * The catalogue's quasars, placed, their luminosity and colour; `records` the quasar
 * record-holders, looked for in it.
 */
export function buildQuasars(
  table: AsuTable,
  k: KCorrection,
  records: readonly { key: string; name: string; raDeg: number; decDeg: number; z: number }[],
): QuasarBuild {
  const n = table.rows;
  const v = table.numbers;
  const ra = v.RAJ2000!;
  const dec = v.DEJ2000!;
  const zs = v.z!;
  const source = table.text.r_z!;
  const counts: Record<string, number> = { read: n, questionable: 0, noRedshift: 0, kept: 0, colourMeasured: 0, kExtrapolated: 0, noMagnitude: 0, bal: 0 };

  // The catalogue's median g - i in redshift bins, for Delta(g - i).
  const gi = new Float64Array(n).fill(Number.NaN);
  const bins = new Map<number, number[]>();
  for (let q = 0; q < n; q += 1) {
    if (!(zs[q]! > 0) || zs[q]! >= COLOUR_Z_MAX) continue;
    if (!(v.e_gmag![q]! < COLOUR_MAG_ERROR_MAX) || !(v.e_imag![q]! < COLOUR_MAG_ERROR_MAX)) continue;
    const value = v.gmag![q]! - v.Extg![q]! - (v.imag![q]! - v.Exti![q]!);
    if (!Number.isFinite(value)) continue;
    gi[q] = value;
    const bin = Math.floor(zs[q]! / COLOUR_BIN_DZ);
    let list = bins.get(bin);
    if (list === undefined) bins.set(bin, (list = []));
    list.push(value);
  }
  const binMedian = new Map<number, number>();
  for (const [bin, list] of bins) if (list.length >= 50) binMedian.set(bin, median(list));

  const quasars: BuiltQuasar[] = [];
  const footprint = new Footprint();
  // For the check of M_i against DR16Q's own.
  const miDifferences: number[] = [];
  const kept: number[] = [];
  for (let q = 0; q < n; q += 1) {
    if (v.QSO![q] !== 1) {
      counts.questionable! += 1;
      continue;
    }
    const z = zs[q]!;
    if (!(z > 0)) {
      counts.noRedshift! += 1;
      continue;
    }
    const position = quasarScenePc(ra[q]!, dec[q]!, z);
    let flags = 0;
    if (/^VI/i.test(source[q] ?? '')) flags |= QUASAR_FLAGS.REDSHIFT_VISUAL;
    if (v.PBAL![q]! >= BAL_PROBABILITY) {
      flags |= QUASAR_FLAGS.BAL;
      counts.bal! += 1;
    }
    const iCorrected = v.imag![q]! - v.Exti![q]!;
    let absV = Number.NaN;
    if (Number.isFinite(iCorrected) && v.imag![q]! > 0 && v.imag![q]! < 30) {
      const kz = k.at(z);
      if (kz.extrapolated) {
        flags |= QUASAR_FLAGS.K_EXTRAPOLATED;
        counts.kExtrapolated! += 1;
      }
      absV = iCorrected - distanceModulus(z) - kz.k + MV_FROM_MI_Z2;
      // The check: this run's M_i in DR16Q's cosmology and redshift (Z_PCA), against its M_I.
      const zPca = v.zPCA![q]!;
      const theirs = v.iMAG![q]!;
      if (zPca > 0.1 && zPca < k.zMax && Number.isFinite(theirs) && theirs < 0) {
        miDifferences.push(iCorrected - distanceModulusDr16q(zPca) - k.at(zPca).k - theirs);
      }
    } else {
      counts.noMagnitude! += 1;
    }
    const bin = binMedian.get(Math.floor(z / COLOUR_BIN_DZ));
    let bv = COMPOSITE_BV;
    if (Number.isFinite(gi[q]!) && bin !== undefined) {
      bv = COMPOSITE_BV + DELTA_GI_TO_BV * (gi[q]! - bin);
      counts.colourMeasured! += 1;
    } else {
      flags |= QUASAR_FLAGS.COLOUR_COMPOSITE;
    }
    footprint.add(ra[q]!, dec[q]!, z);
    kept.push(q);
    quasars.push({ position, z, absV, bv, flags });
  }
  counts.kept = quasars.length;

  // The record-holders: in the catalogue, or not.
  const recordHolders: RecordHolderCheck[] = records.map((record) => {
    let best: { item: number; separation: number } | null = null;
    const u = unitVector(record.raDeg, record.decDeg);
    const least = Math.cos(RECORD_HOLDER_MATCH_ARCSEC * ARCSEC);
    for (let item = 0; item < kept.length; item += 1) {
      const q = kept[item]!;
      const w = unitVector(ra[q]!, dec[q]!);
      const cos = u[0] * w[0] + u[1] * w[1] + u[2] * w[2];
      if (cos < least) continue;
      const separation = Math.acos(Math.min(1, cos)) / ARCSEC;
      if (best === null || separation < best.separation) best = { item, separation };
    }
    if (best === null) {
      return { key: record.key, name: record.name, z: record.z, matched: null, note: record.z > 7.1 ? 'Past DR16Q\'s farthest (z 7.02).' : record.decDeg < -20 ? 'South of the SDSS\'s sky.' : 'Not in DR16Q: drawn as its mark alone.' };
    }
    const found = quasars[best.item]!;
    quasars[best.item] = { ...found, flags: found.flags | QUASAR_FLAGS.RECORD_HOLDER };
    const offsetMpc = PLANCK_DISTANCES.distance(found.z) - PLANCK_DISTANCES.distance(record.z);
    return {
      key: record.key,
      name: record.name,
      z: record.z,
      matched: { separationArcsec: Number(best.separation.toFixed(2)), z: Number(found.z.toFixed(4)), offsetMpc: Number(offsetMpc.toFixed(1)) },
      note: 'In DR16Q: drawn as its mark, its dot left undrawn (RECORD_HOLDER); the two at one place, both in Planck 2018.',
    };
  });

  const mi = median(miDifferences);
  const checks: QuasarsInfo['checks'] = {
    absoluteMagnitude: {
      passed: Math.abs(mi) < 0.02,
      value: Number(mi.toFixed(3)),
      note: `Median of this run's M_i(z = 2), made as DR16Q makes its own (Z_PCA, H0 67.6, Omega_m 0.31: planck.ts DR16Q_COSMOLOGY), less DR16Q's M_I, over ${miDifferences.length} quasars: under 0.02 mag required.`,
    },
  };
  if (!checks.absoluteMagnitude!.passed) {
    throw new Error(`This run's M_i differs from DR16Q's own by a median ${mi.toFixed(3)} mag: the K-correction or the extinction is not read as the catalogue's.`);
  }
  for (const r of recordHolders) {
    if (r.matched !== null && Math.abs(r.matched.offsetMpc) > 50) {
      throw new Error(`${r.name} is in DR16Q at z ${r.matched.z}, ${r.matched.offsetMpc} Mpc from its record-holder's mark at z ${r.z}: the two would not line up.`);
    }
  }
  return { quasars, counts, footprint, recordHolders, checks };
}

// ---------------------------------------------------------------------------------------
// Encoding

const quantise = (value: number, min: number, step: number, unknown: number) => {
  if (!Number.isFinite(value)) return unknown;
  const code = Math.round((value - min) / step);
  return code < 0 || code > unknown - 1 ? unknown : code;
};

const toUnit = (pc: number): number => {
  const unit = Math.round(pc / QUASAR_POSITION_UNIT_PC);
  if (unit < -32767 || unit > 32767) throw new Error(`A quasar at ${(pc / 1e6).toFixed(0)} Mpc is past the Int16 positions' reach.`);
  return unit;
};

/** The quasars, most luminous first, in chunks of `chunkSize` (QUASAR_BYTES each). */
export function encodeQuasars(quasars: readonly BuiltQuasar[], chunkSize = CHUNK_QUASARS): { bytes: Uint8Array; count: number; absVBrightest: number; absVFaintest: number }[] {
  const known = (v: number) => (quantise(v, QUASAR_ABS_V.min, QUASAR_ABS_V.step, QUASAR_ABS_V.unknown) === QUASAR_ABS_V.unknown ? Number.NaN : v);
  const absV = quasars.map((q) => known(q.absV));
  const order = quasars.map((_, i) => i).sort((a, b) => {
    const va = absV[a]!;
    const vb = absV[b]!;
    if (!Number.isFinite(va)) return Number.isFinite(vb) ? 1 : 0;
    if (!Number.isFinite(vb)) return -1;
    return va - vb;
  });
  const chunks = [];
  for (let start = 0; start < order.length; start += chunkSize) {
    const slice = order.slice(start, start + chunkSize);
    const count = slice.length;
    const bytes = new Uint8Array(count * QUASAR_BYTES);
    const view = new DataView(bytes.buffer);
    slice.forEach((q, j) => {
      const quasar = quasars[q]!;
      for (let axis = 0; axis < 3; axis += 1) view.setInt16((j * 3 + axis) * 2, toUnit(quasar.position[axis]!), true);
      bytes[count * 6 + j] = quantise(quasar.absV, QUASAR_ABS_V.min, QUASAR_ABS_V.step, QUASAR_ABS_V.unknown);
      bytes[count * 7 + j] = quantise(quasar.bv, QUASAR_BV.min, QUASAR_BV.step, QUASAR_BV.unknown);
      bytes[count * 8 + j] = quasar.flags;
    });
    const finite = slice.map((q) => absV[q]!).filter(Number.isFinite);
    chunks.push({ bytes, count, absVBrightest: finite.length > 0 ? finite[0]! : Number.NaN, absVFaintest: finite.length > 0 ? finite[finite.length - 1]! : Number.NaN });
  }
  return chunks;
}

// ---------------------------------------------------------------------------------------
// Assembly

export const QUASAR_FILES = { chunk: (k: number) => `quasars-${k}.bin`, clusters: 'sz-clusters.bin' } as const;

export interface QuasarsOutput {
  readonly info: QuasarsInfo;
  readonly files: Readonly<Record<string, Uint8Array>>;
}

const quantile = (sorted: ArrayLike<number>, p: number) => (sorted.length === 0 ? Number.NaN : sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!);

export function assembleQuasars(input: {
  build: QuasarBuild;
  sources: QuasarsInfo['sources'];
  clusters: { info: SzClustersInfo; bytes: Uint8Array } | null;
}): QuasarsOutput {
  const { build } = input;
  const files: Record<string, Uint8Array> = {};
  const chunks = encodeQuasars(build.quasars).map((c, k) => {
    files[QUASAR_FILES.chunk(k)] = c.bytes;
    return { file: QUASAR_FILES.chunk(k), bytes: c.bytes.length, count: c.count, absVBrightest: Number(c.absVBrightest.toFixed(2)), absVFaintest: Number(c.absVFaintest.toFixed(2)) };
  });
  if (input.clusters !== null) files[QUASAR_FILES.clusters] = input.clusters.bytes;

  const zs = Float64Array.from(build.quasars, (q) => q.z).sort();
  const distances = Float64Array.from(build.quasars, (q) => Math.hypot(q.position[0], q.position[1], q.position[2])).sort();
  const absV = Float64Array.from(build.quasars.map((q) => q.absV).filter(Number.isFinite)).sort();
  const shells: number[] = [];
  for (const d of distances) {
    const s = Math.floor(d / SHELL_PC);
    while (shells.length <= s) shells.push(0);
    shells[s]! += 1;
  }
  const fp = build.footprint;
  const round = (x: number, d = 4) => Number(x.toFixed(d));
  const info: QuasarsInfo = {
    generatedAt: new Date().toISOString(),
    sources: input.sources,
    frame: 'Heliocentric, ICRS rotated about its x axis by the IAU 1976 obliquity (the scene frame, as cosmic-web/), parsecs; positions Int16 of positionUnitPc.',
    positionUnitPc: QUASAR_POSITION_UNIT_PC,
    cosmology: {
      name: PLANCK18.name,
      h0KmSMpc: PLANCK18.h0,
      omegaM: PLANCK18.omegaM,
      t0K: PLANCK18.t0K,
      nEff: PLANCK18.nEff,
      note: `Planck 2018 (A&A 641, A6, Table 2, TT,TE,EE+lowE+lensing+BAO), flat, radiation included (Omega_r ${omegaRadiation().toExponential(3)}): web/src/core/cosmology.ts's, the record-holders' and the last-scattering sphere's. Not the cosmic web's (Laniakea's H0 74.6, Omega_m 0.3): past z 1 the distance scale is the baryon acoustic one, measured in these quasars too (eBOSS DR16), and it fits Planck's. Under z 0.95, where they share BOSS's volume, a quasar is 9-10% farther than a galaxy of its redshift.`,
    },
    quasars: {
      count: build.quasars.length,
      bytesPerQuasar: QUASAR_BYTES,
      chunks,
      absV: QUASAR_ABS_V,
      bv: QUASAR_BV,
      flags: QUASAR_FLAGS,
      counts: build.counts,
      zRange: { min: round(zs[0] ?? 0), median: round(quantile(zs, 0.5)), max: round(zs[zs.length - 1] ?? 0) },
      distanceRangePc: { min: Math.round(distances[0] ?? 0), median: Math.round(quantile(distances, 0.5)), max: Math.round(distances[distances.length - 1] ?? 0) },
      absVPercentiles: { p5: round(quantile(absV, 0.05), 2), p50: round(quantile(absV, 0.5), 2), p95: round(quantile(absV, 0.95), 2) },
      halfCountPc: Math.round(quantile(distances, 0.5)),
      photometryNote: `M_i(z = 2) = i - A_i - 5 log10(d_L / 10 pc) - K(z), DR16Q's PSF i and Schlafly & Finkbeiner's A_i, d_L = (1 + z) x comoving in Planck 2018, K Richards et al. 2006's Table 4 (to z 5.49; past it the continuum's, K_EXTRAPOLATED); M_V = M_i(z = 2) + ${MV_FROM_MI_Z2.toFixed(3)} (to z 0 by their eq. 4, i to V along alpha_nu = -0.5, AB to Vega). B - V the composite's ${COMPOSITE_BV.toFixed(3)} (alpha_nu = -0.5, Vega), plus ${DELTA_GI_TO_BV.toFixed(3)} x Delta(g - i), its g - i less the median at its redshift (bins of ${COLOUR_BIN_DZ}), below z ${COLOUR_Z_MAX} where g and i are better than ${COLOUR_MAG_ERROR_MAX} mag; else the composite's (COLOUR_COMPOSITE).`,
      placementNote: 'At the comoving distance of DR16Q\'s best redshift (Z), heliocentric, in Planck 2018. The catalogue\'s IS_QSO_FINAL = 2, the questionable, are left out.',
    },
    footprint: {
      grid: { decBands: FOOTPRINT_DEC_BANDS, raCells: FOOTPRINT_RA_CELLS, cellDeg2: Number(FOOTPRINT_CELL_DEG2.toFixed(4)) },
      survey: {
        name: 'SDSS DR16Q (SDSS-I to IV: Legacy, BOSS, eBOSS)',
        cells: Buffer.from(fp.bits).toString('base64'),
        cellCount: fp.cellCount(),
        areaDeg2: Math.round(fp.cellCount() * FOOTPRINT_CELL_DEG2),
        zMin: round(fp.zMin),
        zMax: round(fp.zMax),
        note: 'The SDSS imaging\'s two caps: a third of the sky about the north galactic pole and a strip about the equator in the south; BOSS and eBOSS target the quasars inside it.',
      },
    },
    shells: { widthPc: SHELL_PC, counts: shells },
    checks: build.checks,
    recordHolders: build.recordHolders,
    clusters: input.clusters?.info ?? null,
    coverage: [
      'Every quasar here is in the SDSS\'s footprint: the map is wedges, a third of the sky about the north galactic pole and a strip in the south, and the dark between them is unobserved, not empty. Toward the Milky Way\'s plane, nothing.',
      'DR16Q is a flux-limited catalogue chosen by colour: far out it holds only the most luminous quasars, and its quasars thin past z 3 and end at z 7.02.',
      'The eBOSS survey (z 0.8-2.2) and BOSS\'s (past z 2.15) chose quasars by colour to map the universe\'s structure; where a target class thins out, so does the map.',
    ],
  };
  return { info, files };
}

/** Lines for the log. */
export function describeQuasars(output: QuasarsOutput): string[] {
  const { info } = output;
  const mb = (bytes: number) => `${(bytes / 1e6).toFixed(2)} MB`;
  const q = info.quasars;
  return [
    `[quasars] ${q.count} quasars in ${q.chunks.length} chunks (${mb(q.chunks.reduce((n, c) => n + c.bytes, 0))}): ${Object.entries(q.counts).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    `[quasars] z ${q.zRange.min}-${q.zRange.max}, median ${q.zRange.median}; distances ${(q.distanceRangePc.min / 1e6).toFixed(0)}-${(q.distanceRangePc.max / 1e6).toFixed(0)} Mpc, median ${(q.distanceRangePc.median / 1e6).toFixed(0)}.`,
    `[quasars] absolute V 5% ${q.absVPercentiles.p5}, median ${q.absVPercentiles.p50}, 95% ${q.absVPercentiles.p95}.`,
    `[quasars] footprint ${info.footprint.survey.areaDeg2} deg^2.`,
    ...Object.entries(info.checks).map(([k, c]) => `[quasars] check ${k}: ${c.passed ? 'passed' : 'FAILED'} (${c.value}) ${c.note}`),
    ...info.recordHolders.map((r) => `[quasars] record-holder ${r.name}: ${r.matched === null ? r.note : `matched ${r.matched.separationArcsec}" away at z ${r.matched.z}, ${r.matched.offsetMpc} Mpc from its mark`}`),
    ...(info.clusters === null ? ['[quasars] no SZ clusters this run.'] : [`[quasars] ${info.clusters.count} Planck SZ clusters: ${Object.entries(info.clusters.counts).map(([k, v]) => `${k} ${v}`).join(', ')}; left out ${info.clusters.leftOut.map((l) => `${l.psz2} (${l.as})`).join(', ') || 'none'}.`]),
    `[quasars] ${mb(Object.values(output.files).reduce((n, b) => n + b.length, 0))} in all.`,
  ];
}

