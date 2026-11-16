import { describe, expect, it } from 'vitest';

import { unitVector } from '../laniakea/frames.ts';
import { buildClusters, LANDMARK_MATCH_ARCMIN } from './clusters.ts';
import { QUASAR_ABS_V, QUASAR_BYTES, QUASAR_FLAGS, QUASAR_POSITION_UNIT_PC, SZ_CLUSTER_BYTES } from './format.ts';
import { distanceModulus, distanceModulusDr16q, PLANCK_DISTANCES, PlanckDistances } from './planck.ts';
import {
  assembleQuasars,
  buildQuasars,
  COMPOSITE_BV,
  DELTA_GI_TO_BV,
  encodeQuasars,
  KCorrection,
  MV_FROM_MI_Z2,
  quasarScenePc,
  type BuiltQuasar,
} from './quasars.ts';
import { parseAsuTable, QUASAR_RECORD_HOLDERS, type AsuTable } from './sources.ts';

/** Richards et al.'s table's shape: every 0.01 from 0 to 5.49, 0.596 at z 0 and 0 at z 2 (as the real one). */
function kTable(): KCorrection {
  const z = Float64Array.from({ length: 550 }, (_, i) => i / 100);
  const k = Float64Array.from(z, (x) => 0.596 * (1 - x / 2));
  return new KCorrection(z, k);
}

const ROW_COLUMNS = ['RAJ2000', 'DEJ2000', 'z', 'QSO', 'PBAL', 'gmag', 'imag', 'e_gmag', 'e_imag', 'Extg', 'Exti', 'iMAG', 'zPCA'] as const;
type Row = Partial<Record<(typeof ROW_COLUMNS)[number], number>> & { r_z?: string };

/** An ASU table of `rows`, each a plausible DR16Q quasar unless told otherwise, its M_I DR16Q's own way. */
function table(rows: readonly Row[], k: KCorrection): AsuTable {
  const numbers: Record<string, Float64Array> = {};
  for (const column of ROW_COLUMNS) numbers[column] = new Float64Array(rows.length);
  const r_z: string[] = [];
  rows.forEach((row, i) => {
    const z = row.z ?? 1.5;
    const filled = { RAJ2000: 150, DEJ2000: 20, z, QSO: 1, PBAL: 0, gmag: 20.3, imag: 20, e_gmag: 0.03, e_imag: 0.03, Extg: 0.1, Exti: 0.05, zPCA: z, ...row };
    filled.iMAG ??= filled.imag - filled.Exti - distanceModulusDr16q(filled.zPCA) - k.at(filled.zPCA).k;
    for (const column of ROW_COLUMNS) numbers[column]![i] = filled[column as keyof typeof filled] as number;
    r_z.push(row.r_z ?? 'PIPE');
  });
  return { rows: rows.length, numbers, text: { r_z } };
}

describe('Planck 2018 distances', () => {
  it('integrate the flat universe with radiation, and read both ways', () => {
    // A finer table and a direct integral agree with the app's to a part in 10^7.
    const fine = new PlanckDistances(8, 2e-5);
    for (const z of [0.1, 1, 2.2, 5, 7.02]) {
      expect(PLANCK_DISTANCES.distance(z) / fine.distance(z)).toBeCloseTo(1, 7);
      expect(PLANCK_DISTANCES.redshift(PLANCK_DISTANCES.distance(z))).toBeCloseTo(z, 7);
    }
    // At z 1, 3.4 Gpc; at DR16Q's farthest, 7.02, 8.9 Gpc, 29 billion light years.
    expect(PLANCK_DISTANCES.distance(1)).toBeGreaterThan(3350);
    expect(PLANCK_DISTANCES.distance(1)).toBeLessThan(3450);
    expect(PLANCK_DISTANCES.distance(7.02)).toBeGreaterThan(8800);
    expect(PLANCK_DISTANCES.distance(7.02)).toBeLessThan(9000);
    expect(() => PLANCK_DISTANCES.distance(9)).toThrow();
  });

  it('give the distance modulus of the luminosity distance, and DR16Q’s cosmology’s apart', () => {
    expect(distanceModulus(1)).toBeCloseTo(5 * Math.log10(2 * PLANCK_DISTANCES.distance(1) * 1e5), 9);
    // DR16Q's H0 67.6 against Planck's 67.66: at low z the moduli differ by 5 log10(67.66 / 67.6), next to nothing.
    expect(distanceModulus(0.05) - distanceModulusDr16q(0.05)).toBeCloseTo(5 * Math.log10(67.6 / 67.66), 2);
  });

  it('keep the farthest quasar inside the Int16 positions, steps far under a redshift’s uncertainty', () => {
    expect(32767 * QUASAR_POSITION_UNIT_PC).toBeGreaterThan(PLANCK_DISTANCES.distance(7.1) * 1e6);
    // 300 kpc against a quasar's redshift error of a few hundred km/s: several Mpc at z 2.
    expect(QUASAR_POSITION_UNIT_PC).toBeLessThan(1e6);
  });
});

describe('the K-correction and the conversions', () => {
  it('reads Richards et al.’s table linearly, and carries it on past z 5.49 along the continuum', () => {
    const k = kTable();
    expect(k.at(2).k).toBeCloseTo(0, 9);
    expect(k.at(0.005).k).toBeCloseTo(0.596 * (1 - 0.0025), 9);
    expect(k.at(5.49).extrapolated).toBe(false);
    const past = k.at(7);
    expect(past.extrapolated).toBe(true);
    expect(past.k).toBeCloseTo(k.at(5.49).k - 1.25 * Math.log10(8 / 6.49), 9);
    expect(() => new KCorrection(new Float64Array([0, 0.01]), new Float64Array([0.5, 0.5]))).toThrow();
  });

  it('turns M_i(z = 2) into rest-frame V, and gives the composite quasar’s B − V', () => {
    expect(MV_FROM_MI_Z2).toBeCloseTo(0.747, 3);
    // 3C 273's measured B - V is 0.21; the composite's is 0.234.
    expect(COMPOSITE_BV).toBeCloseTo(0.234, 3);
    expect(DELTA_GI_TO_BV).toBeCloseTo(0.485, 3);
  });
});

describe('VizieR’s answers', () => {
  const text = [
    '#INFO comment',
    'RAJ2000\tz\tr_z',
    'deg\t \t ',
    '------\t-----\t----',
    '10.5\t 1.25\tVI   ',
    '11.0\t\tPIPE',
    '',
  ].join('\n');

  it('are read with text columns kept and blanks as NaN', () => {
    const t = parseAsuTable(text, ['RAJ2000', 'z', 'r_z'], new Set(['r_z']));
    expect(t.rows).toBe(2);
    expect(Array.from(t.numbers.z!)).toEqual([1.25, Number.NaN]);
    expect(t.text.r_z).toEqual(['VI', 'PIPE']);
  });

  it('refuse an error, a missing column and a word where a number is', () => {
    expect(() => parseAsuTable('#INFO Error=no such table\n', ['z'])).toThrow(/no such table/);
    expect(() => parseAsuTable(text, ['zPCA'])).toThrow(/no column/);
    expect(() => parseAsuTable(text, ['r_z'])).toThrow(/not a number/);
  });
});

describe('the quasars, built', () => {
  const k = kTable();

  it('keeps DR16Q’s quasars, places each at its redshift and reads its luminosity as DR16Q does', () => {
    const ton = QUASAR_RECORD_HOLDERS.find((r) => r.key === 'ton-618')!;
    const rows: Row[] = [
      { z: 1.5, r_z: 'VI' },
      { z: 1.5, QSO: 2 },
      { z: -1 },
      { RAJ2000: ton.raDeg + 1 / 3600, DEJ2000: ton.decDeg, z: 2.2193, imag: 15.6, gmag: 15.9, PBAL: 0.9 },
      { z: 6.5, imag: 20.5 },
      { z: 2, imag: -9999 },
    ];
    const build = buildQuasars(table(rows, k), k, QUASAR_RECORD_HOLDERS);
    expect(build.counts).toMatchObject({ read: 6, questionable: 1, noRedshift: 1, kept: 4, noMagnitude: 1, bal: 1, kExtrapolated: 1 });
    expect(build.checks.absoluteMagnitude!.passed).toBe(true);
    expect(build.checks.absoluteMagnitude!.value).toBeCloseTo(0, 3);

    const [first, tonQ, far, noMag] = build.quasars as [BuiltQuasar, BuiltQuasar, BuiltQuasar, BuiltQuasar];
    expect(first.flags & QUASAR_FLAGS.REDSHIFT_VISUAL).toBeTruthy();
    expect(Math.hypot(...first.position) / 1e6).toBeCloseTo(PLANCK_DISTANCES.distance(1.5), 6);
    // M_V = i - A_i - DM - K + 0.747.
    expect(first.absV).toBeCloseTo(20 - 0.05 - distanceModulus(1.5) - k.at(1.5).k + MV_FROM_MI_Z2, 9);
    // Too few quasars in its redshift bin for a median: the composite's colour.
    expect(first.bv).toBe(COMPOSITE_BV);
    expect(first.flags & QUASAR_FLAGS.COLOUR_COMPOSITE).toBeTruthy();

    expect(tonQ.flags & QUASAR_FLAGS.RECORD_HOLDER).toBeTruthy();
    expect(tonQ.flags & QUASAR_FLAGS.BAL).toBeTruthy();
    expect(far.flags & QUASAR_FLAGS.K_EXTRAPOLATED).toBeTruthy();
    expect(Number.isNaN(noMag.absV)).toBe(true);

    const tonCheck = build.recordHolders.find((r) => r.key === 'ton-618')!;
    expect(tonCheck.matched!.separationArcsec).toBeCloseTo(Math.cos((ton.decDeg * Math.PI) / 180), 1);
    expect(Math.abs(tonCheck.matched!.offsetMpc)).toBeLessThan(1);
    // UHZ1 is at z 10, past the catalogue; 3C 273 not in this table.
    expect(build.recordHolders.find((r) => r.key === 'uhz1')!.matched).toBeNull();
    expect(build.recordHolders.find((r) => r.key === '3c-273')!.matched).toBeNull();
    expect(build.footprint.cellCount()).toBeGreaterThan(0);
  });

  it('colours a quasar by how much redder than its redshift’s median it is, below z 2.2 only', () => {
    // 60 quasars at z 1.0, g - i of 0.3 but one of 0.5: that one 0.2 redder, so B - V up by 0.485 x 0.2.
    const rows: Row[] = Array.from({ length: 60 }, (_, i) => ({ z: 1.0 + i * 1e-4, gmag: 20.3 + 0.05, Extg: 0.1, imag: 20, Exti: 0.05 }));
    rows.push({ z: 1.001, gmag: 20.55, Extg: 0.1, imag: 20, Exti: 0.05 });
    rows.push({ z: 3, gmag: 23, imag: 20 });
    rows.push({ z: 1.002, gmag: 20.35, e_gmag: 0.4 });
    const build = buildQuasars(table(rows, k), k, []);
    expect(build.quasars[0]!.bv).toBeCloseTo(COMPOSITE_BV, 9);
    expect(build.quasars[60]!.bv).toBeCloseTo(COMPOSITE_BV + DELTA_GI_TO_BV * 0.2, 6);
    expect(build.quasars[61]!.flags & QUASAR_FLAGS.COLOUR_COMPOSITE).toBeTruthy();
    expect(build.quasars[62]!.flags & QUASAR_FLAGS.COLOUR_COMPOSITE).toBeTruthy();
    expect(build.counts.colourMeasured).toBe(61);
  });

  it('refuses a run whose magnitudes are not the catalogue’s', () => {
    expect(() => buildQuasars(table([{ z: 1.5, iMAG: -20 }], k), k, [])).toThrow(/M_i differs/);
  });
});

describe('the chunks', () => {
  const at = (z: number, absV: number, flags = 0): BuiltQuasar => ({ position: quasarScenePc(30, 10, z), z, absV, bv: 0.25, flags });

  it('order the quasars most luminous first, the unknown last, and hold each to its unit', () => {
    const quasars = [at(1, -24), at(2, Number.NaN), at(3, -28.5, QUASAR_FLAGS.BAL), at(0.5, -26), at(7, -40)];
    const chunks = encodeQuasars(quasars, 2);
    expect(chunks.map((c) => c.count)).toEqual([2, 2, 1]);
    expect(chunks.every((c) => c.bytes.length === c.count * QUASAR_BYTES)).toBe(true);
    // -40 is past the byte's range: unknown, so last with the other unknown.
    expect(chunks[0]!.absVBrightest).toBeCloseTo(-28.5, 9);
    const first = chunks[0]!;
    const view = new DataView(first.bytes.buffer);
    const x = view.getInt16(0, true) * QUASAR_POSITION_UNIT_PC;
    expect(Math.abs(x - quasars[2]!.position[0])).toBeLessThanOrEqual(QUASAR_POSITION_UNIT_PC / 2);
    expect(QUASAR_ABS_V.min + first.bytes[2 * 6]! * QUASAR_ABS_V.step).toBeCloseTo(-28.5, 6);
    expect(first.bytes[2 * 8]).toBe(QUASAR_FLAGS.BAL);
    expect(chunks[1]!.bytes[2 * 6 + 1]).toBe(QUASAR_ABS_V.unknown);
    expect(chunks[2]!.bytes[6]).toBe(QUASAR_ABS_V.unknown);
  });

  it('are described in quasars.json, with the footprint and the record-holders', () => {
    const k = kTable();
    const build = buildQuasars(table([{ z: 1 }, { z: 2 }, { z: 3 }], k), k, QUASAR_RECORD_HOLDERS);
    const { info, files } = assembleQuasars({ build, sources: {}, clusters: null });
    expect(info.quasars.count).toBe(3);
    expect(info.quasars.chunks).toHaveLength(1);
    expect(files[info.quasars.chunks[0]!.file]!.length).toBe(3 * QUASAR_BYTES);
    expect(info.quasars.zRange).toEqual({ min: 1, median: 2, max: 3 });
    expect(info.quasars.halfCountPc).toBe(info.quasars.distanceRangePc.median);
    expect(info.footprint.survey.cellCount).toBe(1);
    expect(info.recordHolders).toHaveLength(QUASAR_RECORD_HOLDERS.length);
    expect(info.clusters).toBeNull();
  });
});

describe('the Planck SZ clusters', () => {
  const psz2 = (rows: { name: string; ra: number; dec: number; z: number; msz: number; zID?: string }[]): AsuTable => ({
    rows: rows.length,
    numbers: {
      RAJ2000: Float64Array.from(rows, (r) => r.ra),
      DEJ2000: Float64Array.from(rows, (r) => r.dec),
      z: Float64Array.from(rows, (r) => r.z),
      MSZ: Float64Array.from(rows, (r) => r.msz),
    },
    text: { Name: rows.map((r) => r.name), zID: rows.map((r) => r.zID ?? ''), MCXC: rows.map(() => ''), ACT: rows.map(() => ''), SPT: rows.map(() => '') },
  });

  it('keep those with a redshift, leave out what the app draws by name, and name the famous', () => {
    const drawn = [{ name: 'Coma', raDeg: 194.95, decDeg: 27.98, z: 0.0231 }];
    const t = psz2([
      { name: 'PSZ2 G057.80+88.00', ra: 194.95 + 5 / 60, dec: 27.98, z: 0.0231, msz: 7.2 },
      { name: 'PSZ2 G000.04+45.13', ra: 229.19, dec: -1.02, z: 0.1198, msz: 3.96, zID: 'ABELL 2029' },
      { name: 'PSZ2 G002.04-22.15', ra: 291.36, dec: -36.52, z: -1, msz: Number.NaN },
      // In Coma's direction but far behind it: a cluster of its own.
      { name: 'PSZ2 behind', ra: 194.95, dec: 27.98, z: 0.4, msz: Number.NaN },
    ]);
    const { info, bytes } = buildClusters(t, 'sz-clusters.bin', drawn);
    expect(info.counts).toEqual({ read: 4, noRedshift: 1, alreadyDrawn: 1, kept: 2 });
    expect(info.leftOut[0]!.as).toBe('Coma');
    expect(info.leftOut[0]!.separationArcmin).toBeLessThan(LANDMARK_MATCH_ARCMIN);
    expect(info.named.map((n) => n.name)).toEqual(['Abell 2029']);
    expect(bytes.length).toBe(2 * SZ_CLUSTER_BYTES);
    const view = new DataView(bytes.buffer);
    expect(view.getFloat32(2 * 12, true)).toBeCloseTo(0.1198, 6);
    expect(view.getFloat32(2 * 16, true)).toBeCloseTo(3.96, 5);
    expect(Number.isNaN(view.getFloat32(2 * 16 + 4, true))).toBe(true);
    // Placed along its direction.
    const p = [view.getFloat32(0, true), view.getFloat32(4, true), view.getFloat32(8, true)];
    const u = unitVector(229.19, -1.02);
    const r = Math.hypot(p[0]!, p[1]!, p[2]!);
    // Scene frame: the x axis is shared with the equatorial one.
    expect(p[0]! / r).toBeCloseTo(u[0], 4);
  });
});
