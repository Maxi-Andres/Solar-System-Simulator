import { describe, expect, it } from 'vitest';

import { comovingDistanceMpc, unitVector, type Vec3 } from '../laniakea/frames.ts';
import { toScene } from '../stars/build3d.ts';
import { COSMIC_WEB_ABS_V, COSMIC_WEB_BV, COSMIC_WEB_FLAGS, COSMIC_WEB_GALAXY_BYTES, COSMIC_WEB_POSITION_UNIT_PC, LANIAKEA_FLAGS } from '../types.ts';
import { asuColumnsUrl, parseAsuColumns, parseNdskl, readFitsColumns, readTempelPoints } from './catalogues.ts';
import {
  buildGalaxies,
  checkTempelFrame,
  encodeFilaments,
  encodeGalaxies,
  Footprint,
  FOOTPRINT_CELL_DEG2,
  FOOTPRINT_DEC_BANDS,
  FOOTPRINT_RA_CELLS,
  footprintCell,
  malavasiFilaments,
  type BossGalaxies,
  type G3Galaxies,
  type TempelGalaxies,
  type WebFilament,
} from './cosmicWeb.ts';
import {
  APP_COSMOLOGY,
  APP_DISTANCES,
  comovingMpc,
  DistanceTable,
  equatorialToMalavasi,
  equatorialToTempel,
  fromScene,
  MALAVASI_COSMOLOGY,
  malavasiToEquatorial,
  scenePc,
  TEMPEL_DISTANCES,
  tempelToEquatorial,
} from './distances.ts';
import { magnitudeAt, medianAndScatter, nanomaggiesToMagnitudes, restFrame } from './photometry.ts';

describe('distances', () => {
  it('matches frames.ts in the app cosmology, and reads both ways', () => {
    for (const z of [0.001, 0.03, 0.1, 0.2, 0.5, 0.8, 1.1]) {
      expect(comovingMpc(z, APP_COSMOLOGY)).toBeCloseTo(comovingDistanceMpc(z), 6);
      expect(APP_DISTANCES.distance(z) / comovingDistanceMpc(z)).toBeCloseTo(1, 8);
      expect(APP_DISTANCES.redshift(APP_DISTANCES.distance(z))).toBeCloseTo(z, 9);
    }
    expect(APP_DISTANCES.distance(0)).toBe(0);
    expect(() => APP_DISTANCES.distance(2)).toThrow();
  });

  it('undoes a catalogue cosmology: h^-1 Mpc at Omega_m 0.27 back to z, z to the app distance', () => {
    // At low z distance is cz / H0 in any cosmology: 100 h^-1 Mpc is z 0.0337 and 100/0.746 Mpc.
    const z = TEMPEL_DISTANCES.redshift(100);
    expect(z).toBeCloseTo((1e4 / 299792.458) * (1 + 0.2025 * 0.03336), 4); // D = (c / H0)(z - (1 + q0) z^2 / 2), q0 = -0.595
    expect(APP_DISTANCES.distance(z)).toBeCloseTo(comovingMpc(z, APP_COSMOLOGY), 5);
    const table = new DistanceTable(MALAVASI_COSMOLOGY, 1);
    expect(table.redshift(comovingMpc(0.5, MALAVASI_COSMOLOGY))).toBeCloseTo(0.5, 7);
  });

  it("Tempel's survey frame goes both ways and puts table3's galaxies on their nearest filament points", () => {
    for (const [ra, dec] of [[0, 0], [185, 32.5], [250.1, 27.7], [120, -5], [359.9, 70]] as const) {
      const back = tempelToEquatorial(equatorialToTempel(ra, dec));
      expect(back.raDeg).toBeCloseTo(ra, 9);
      expect(back.decDeg).toBeCloseTo(dec, 9);
    }
    // The survey's centre (RA 185, Dec 32.5) is lambda 0, eta 0: Tempel's +y.
    const centre = equatorialToTempel(185, 32.5);
    expect(centre[0]).toBeCloseTo(0, 12);
    expect(centre[1]).toBeCloseTo(1, 12);
    expect(centre[2]).toBeCloseTo(0, 12);
    // Galaxies 19 and 95 of table3 (Dfil 0.064 and 0.091 h^-1 Mpc) and the points it names (10253, 188408).
    const fixtures = [
      { ra: 251.35022, dec: 28.482853, d: 388.021, point: [-312.382, 214.769, 82.714] },
      { ra: 164.40942, dec: 55.24205, d: 197.373, point: [39.41, 175.917, 80.18] },
    ];
    for (const f of fixtures) {
      const u = equatorialToTempel(f.ra, f.dec);
      expect(Math.hypot(u[0] * f.d - f.point[0]!, u[1] * f.d - f.point[1]!, u[2] * f.d - f.point[2]!)).toBeLessThan(0.39);
    }
  });

  it("Malavasi's frame is the offsets from the field's centre taken as angles", () => {
    const centre = { raDeg: 184.894, decDeg: 28.153 };
    expect(equatorialToMalavasi(184.894, 28.153, 1000, centre)).toEqual([1000, 0, 0]);
    const p = equatorialToMalavasi(214.894, 38.153, 2000, centre);
    expect(Math.atan2(p[1], p[0]) * (180 / Math.PI)).toBeCloseTo(30, 9);
    const back = malavasiToEquatorial(p, centre);
    expect(back.raDeg).toBeCloseTo(214.894, 9);
    expect(back.decDeg).toBeCloseTo(38.153, 9);
    expect(back.distance).toBeCloseTo(2000, 9);
  });

  it('places a redshift in the scene frame, and fromScene undoes the frame', () => {
    const p = scenePc(30, 40, 0.1);
    expect(Math.hypot(...p) / 1e6).toBeCloseTo(comovingDistanceMpc(0.1), 6);
    const back = fromScene(p);
    const u = unitVector(30, 40);
    const r = Math.hypot(...back);
    back.forEach((v, i) => expect(v / r).toBeCloseTo(u[i]!, 12));
    expect(fromScene(toScene([1, 2, 3]))).toEqual([expect.closeTo(1, 12), expect.closeTo(2, 12), expect.closeTo(3, 12)]);
  });
});

describe('catalogues', () => {
  const tsv = [
    '#RESOURCE=yCat_74383465',
    '#Column\tID\t(I5)',
    'ID\tIDpt\tx\tvmap',
    ' \t \tMpc\t ',
    '-----\t------\t--------\t-------',
    '    2\t     3\t  1.500\t 0.5000',
    '    1\t     2\t -2.000\t',
    '    1\t     1\t  0.250\t 0.0500',
    '',
  ].join('\n');

  it('reads ASU-TSV into columns, blanks as NaN', () => {
    const { rows, values } = parseAsuColumns(tsv, ['ID', 'IDpt', 'x', 'vmap']);
    expect(rows).toBe(3);
    expect(Array.from(values.x!)).toEqual([1.5, -2, 0.25]);
    expect(Number.isNaN(values.vmap![1]!)).toBe(true);
    expect(() => parseAsuColumns(tsv, ['nope'])).toThrow(/no column "nope"/);
    expect(() => parseAsuColumns('#INFO\tError=Table not found\n', ['ID'])).toThrow(/Table not found/);
    expect(asuColumnsUrl('https://m/asu-tsv', 'J/MNRAS/438/3465/table2', ['ID', 'Ng.5'])).toBe('https://m/asu-tsv?-source=J/MNRAS/438/3465/table2&-out.max=unlimited&-out=ID,Ng.5');
  });

  it("sorts Tempel's points by filament and along it", () => {
    const values = {
      ID: Float64Array.from([2, 1, 1]),
      IDpt: Float64Array.from([3, 2, 1]),
      x: Float64Array.from([1, 2, 3]),
      y: Float64Array.from([0, 0, 0]),
      z: Float64Array.from([0, 0, 0]),
      D: Float64Array.from([1, 2, 3]),
      vmap: Float64Array.from([0.5, 0.6, 0.7]),
    };
    const points = readTempelPoints(values, 3);
    expect(Array.from(points.point)).toEqual([1, 2, 3]);
    expect(Array.from(points.x)).toEqual([3, 2, 1]);
  });

  const skeletonText = [
    'ANDSKEL',
    '3',
    '#No comments',
    'BBOX [0,0,0] [10,10,10]',
    '[CRITICAL POINTS]',
    '3',
    '3 1 0 0 0.5 1 0',
    ' 1',
    ' 1 0',
    '2 2 0 0 0.2 0 0',
    ' 2',
    ' 0 0',
    ' 2 1',
    '1 9 9 9 0.1 2 1',
    ' 1',
    ' 1 1',
    '[FILAMENTS]',
    '2',
    '0 1 2',
    ' 1 0 0',
    ' 2 0 0',
    '1 2 3',
    ' 2 0 0',
    ' 5 5 5',
    ' 9 9 9',
    '[CRITICAL POINTS DATA]',
    '1',
    'field_value',
    '0.5',
    '0.2',
    '0.1',
    '[FILAMENTS DATA]',
    '2',
    'field_value',
    'log_field_value',
    '1 0',
    '0.1 -1',
    '0.1 -1',
    '0.01 -2',
    '0.001 -3',
  ].join('\n');

  it("parses DisPerSE's ASCII skeleton", () => {
    const s = parseNdskl(skeletonText);
    expect(s.criticalPoints.count).toBe(3);
    expect(Array.from(s.criticalPoints.boundary)).toEqual([0, 0, 1]);
    expect(s.filaments.count).toBe(2);
    expect(Array.from(s.filaments.first)).toEqual([0, 2, 5]);
    expect(Array.from(s.points.slice(9, 12))).toEqual([5, 5, 5]);
    expect(Array.from(s.pointFields.log_field_value!)).toEqual([0, -1, -1, -2, -3]);
    expect(() => parseNdskl('NOPE')).toThrow(/ANDSKEL/);
  });

  it('cuts a skeleton to the footprint and drops filaments at boundary critical points', () => {
    const s = parseNdskl(skeletonText.replace(' 1 0 0\n 2 0 0\n1 2 3', ' 1500 0 0\n 1510 0 0\n1 2 3'));
    const footprint = new Footprint();
    footprint.add(184.894, 28.153, 0.3);
    const { filaments, dropped } = malavasiFilaments(s, { raDeg: 184.894, decDeg: 28.153 }, footprint);
    // The second filament ends at a boundary critical point; the first, 1500-1510 Mpc along the centre's line of sight, z ~ 0.4, is kept.
    expect(dropped.boundaryFilaments).toBe(1);
    expect(filaments).toHaveLength(1);
    expect(filaments[0]!.vertices).toHaveLength(2);
    expect(filaments[0]!.zMin).toBeGreaterThan(0.35);
    expect(filaments[0]!.values).toEqual([0, -1]);
  });

  it('reads FITS binary table columns, vectors included', () => {
    const card = (text: string) => text.padEnd(80, ' ');
    const header = (cards: string[]) => {
      const text = [...cards, 'END'].map(card).join('');
      return new TextEncoder().encode(text.padEnd(Math.ceil(text.length / 2880) * 2880, ' '));
    };
    const primary = header(['SIMPLE  =                    T', 'BITPIX  =                    8', 'NAXIS   =                    0']);
    const table = header([
      "XTENSION= 'BINTABLE'",
      'BITPIX  =                    8',
      'NAXIS   =                    2',
      'NAXIS1  =                   24',
      'NAXIS2  =                    2',
      'PCOUNT  =                    0',
      'TFIELDS =                    3',
      "TTYPE1  = 'Z       '",
      "TFORM1  = 'E       '",
      "TTYPE2  = 'IMATCH  '",
      "TFORM2  = 'J       '",
      "TTYPE3  = 'FLUX    '",
      "TFORM3  = '2D      '",
    ]);
    const data = new Uint8Array(2880);
    const view = new DataView(data.buffer);
    [[0.5, 1, 10, 20], [0.25, 2, -1, 3.5]].forEach(([z, imatch, f1, f2], r) => {
      view.setFloat32(r * 24, z!, false);
      view.setInt32(r * 24 + 4, imatch!, false);
      view.setFloat64(r * 24 + 8, f1!, false);
      view.setFloat64(r * 24 + 16, f2!, false);
    });
    const bytes = new Uint8Array(primary.length + table.length + data.length);
    bytes.set(primary, 0);
    bytes.set(table, primary.length);
    bytes.set(data, primary.length + table.length);
    const { rows, columns } = readFitsColumns(bytes, ['Z', 'IMATCH', 'FLUX']);
    expect(rows).toBe(2);
    expect(Array.from(columns.Z!.values)).toEqual([0.5, 0.25]);
    expect(Array.from(columns.IMATCH!.values)).toEqual([1, 2]);
    expect(columns.FLUX!.repeat).toBe(2);
    expect(Array.from(columns.FLUX!.values)).toEqual([10, 20, -1, 3.5]);
    expect(() => readFitsColumns(bytes, ['RA'])).toThrow(/no column RA/);
  });
});

describe('photometry', () => {
  it('reads magnitudes linearly in log wavelength, carrying the slope on past the bands', () => {
    const ab = [20, 19, 18, 17.5, 17];
    expect(magnitudeAt(ab, 4670)).toEqual({ mag: 19, extrapolated: false });
    const mid = Math.sqrt(4670 * 6156);
    expect(magnitudeAt(ab, mid).mag).toBeCloseTo(18.5, 9);
    const far = magnitudeAt(ab, 8917 * Math.sqrt(8917 / 7472));
    expect(far.extrapolated).toBe(true);
    expect(far.mag).toBeCloseTo(16.75, 9);
    // A band not measured is stepped over.
    expect(magnitudeAt([20, Number.NaN, 18, 17.5, 17], 4670).mag).toBeCloseTo(20 - (2 * Math.log10(4670 / 3546)) / Math.log10(6156 / 3546), 9);
  });

  it('gives a flat spectrum (in f_nu) B-V 0.11 in Vega, and V less the distance modulus and the band shift', () => {
    const flat = [20.04, 20, 20, 20, 19.98]; // SDSS u and z off AB by 0.04 and -0.02
    const z = 0.1;
    const rest = restFrame(flat, z, 400e6);
    expect(rest.bv).toBeCloseTo(0.11, 9);
    expect(rest.v).toBeCloseTo(19.98, 9);
    expect(rest.absV).toBeCloseTo(19.98 - 5 * Math.log10((1.1 * 400e6) / 10) + 2.5 * Math.log10(1.1), 9);
    expect(rest.extrapolated).toBe(false);
    expect(restFrame(flat, 0.7, 2500e6).extrapolated).toBe(true);
  });

  it('turns nanomaggies into magnitudes, none for a flux not above 0', () => {
    const m = nanomaggiesToMagnitudes([1, 10, 0, -2, 100], [0.1, 0, 0, 0, 0.05]);
    expect(m[0]).toBeCloseTo(22.4, 9);
    expect(m[1]).toBeCloseTo(20, 9);
    expect(Number.isNaN(m[2]!) && Number.isNaN(m[3]!)).toBe(true);
    expect(m[4]).toBeCloseTo(17.45, 9);
  });

  it('takes a median and a robust scatter', () => {
    expect(medianAndScatter([1, 2, 3, Number.NaN, 100])).toEqual({ median: 2.5, scatter: expect.closeTo(1.4826 * 1, 9), count: 4 });
  });
});

describe('footprints', () => {
  it('cuts the sky into equal-area cells', () => {
    expect(FOOTPRINT_CELL_DEG2 * FOOTPRINT_DEC_BANDS * FOOTPRINT_RA_CELLS).toBeCloseTo((4 * Math.PI * (180 / Math.PI) ** 2), 6);
    expect(footprintCell(0, -90)).toBe(0);
    expect(footprintCell(359.99, 90)).toBe(FOOTPRINT_DEC_BANDS * FOOTPRINT_RA_CELLS - 1);
    expect(footprintCell(-1, 0)).toBe(footprintCell(359, 0));
    const f = new Footprint();
    f.add(10, 10, 0.1);
    f.add(10.5, 10.2, 0.2);
    f.add(200, -30, 0.05);
    expect(f.has(10.2, 10.1)).toBe(true);
    expect(f.has(100, 0)).toBe(false);
    const d = f.describe('test', 'galaxies', '');
    expect(d.cellCount).toBe(2);
    expect(d.zMin).toBe(0.05);
    expect(Buffer.from(d.cells, 'base64')).toHaveLength(Math.ceil((FOOTPRINT_DEC_BANDS * FOOTPRINT_RA_CELLS) / 8));
  });
});

describe('encoding', () => {
  it('writes galaxies most luminous first, quantised, in chunks', () => {
    const galaxies = [
      { position: [1e8, -2e8, 3.04e7] as Vec3, absV: -20, bv: 0.75, flags: COSMIC_WEB_FLAGS.BOSS },
      { position: [0, 0, 0] as Vec3, absV: Number.NaN, bv: Number.NaN, flags: 0 },
      { position: [5e5, 0, 0] as Vec3, absV: -23.3, bv: 0.9, flags: COSMIC_WEB_FLAGS.SDSS_MAIN | COSMIC_WEB_FLAGS.IN_FILAMENT },
    ];
    const chunks = encodeGalaxies(galaxies, 2);
    expect(chunks.map((c) => c.count)).toEqual([2, 1]);
    const c = chunks[0]!;
    expect(c.bytes.length).toBe(2 * COSMIC_WEB_GALAXY_BYTES);
    const view = new DataView(c.bytes.buffer);
    // First: the -23.3 one at 0.5 Mpc, 5 units; then the -20 one.
    expect(view.getInt16(0, true)).toBe(5);
    expect([view.getInt16(6, true), view.getInt16(8, true), view.getInt16(10, true)]).toEqual([1000, -2000, 304]);
    expect(COSMIC_WEB_ABS_V.min + c.bytes[12]! * COSMIC_WEB_ABS_V.step).toBeCloseTo(-23.3, 6);
    expect(COSMIC_WEB_BV.min + c.bytes[15]! * COSMIC_WEB_BV.step).toBeCloseTo(0.75, 6);
    expect(c.bytes[16]).toBe(COSMIC_WEB_FLAGS.SDSS_MAIN | COSMIC_WEB_FLAGS.IN_FILAMENT);
    expect(chunks[1]!.bytes[6]).toBe(COSMIC_WEB_ABS_V.unknown);
    expect(c.absVBrightest).toBe(-23.3);
    expect(() => encodeGalaxies([{ position: [4e9, 0, 0], absV: -20, bv: 0.5, flags: 0 }])).toThrow(/reach/);
    // Past a byte's range is bad photometry: not known, not clamped.
    const odd = encodeGalaxies([{ position: [0, 0, 0], absV: -5, bv: -0.6, flags: 0 }])[0]!.bytes;
    expect([odd[6], odd[7]]).toEqual([COSMIC_WEB_ABS_V.unknown, COSMIC_WEB_BV.unknown]);
  });

  it('writes filaments as offsets, positions, lengths, counts, values and catalogues', () => {
    const filaments: WebFilament[] = [
      { catalogue: 'tempel2014', vertices: [[0, 0, 0], [3e6, 4e6, 0]], values: [0, 1], galaxies: 12, zMin: 0, zMax: 0 },
      { catalogue: 'malavasi2020', vertices: [[1e9, 0, 0], [1e9, 1e7, 0], [1e9, 2e7, 0]], values: [-3, -2.5, Number.NaN], galaxies: -1, zMin: 0, zMax: 0 },
    ];
    const { bytes, vertices, lengthsMpc } = encodeFilaments(filaments);
    expect(vertices).toBe(5);
    expect(lengthsMpc).toEqual([5, 20]);
    const view = new DataView(bytes.buffer);
    expect([0, 1, 2].map((i) => view.getUint32(i * 4, true))).toEqual([0, 2, 5]);
    const positionsAt = 12;
    expect(view.getInt16(positionsAt + 3 * 2, true)).toBe(30);
    expect(view.getInt16(positionsAt + 6 * 2, true)).toBe(1e9 / COSMIC_WEB_POSITION_UNIT_PC);
    const lengthsAt = positionsAt + 30;
    expect([view.getUint16(lengthsAt, true), view.getUint16(lengthsAt + 2, true)]).toEqual([50, 200]);
    expect([view.getUint16(lengthsAt + 4, true), view.getUint16(lengthsAt + 6, true)]).toEqual([12, 65535]);
    const valuesAt = lengthsAt + 8;
    expect(Array.from(bytes.subarray(valuesAt, valuesAt + 5))).toEqual([0, 254, 96, 106, 255]);
    expect(Array.from(bytes.subarray(valuesAt + 5))).toEqual([0, 1]);
  });
});

describe('galaxies', () => {
  // 150 SDSS galaxies at z 0.02 that G3 holds (so calibrate), 50 it does not; 150 BOSS galaxies the SDSS holds, 20 of its own.
  const n = 200;
  const ra = Array.from({ length: n }, (_, i) => 150 + i * 0.05);
  const dec = Array.from({ length: n }, () => 20);
  const flat = (m: number) => [m + 0.04, m, m, m, m - 0.02];
  const tempel: TempelGalaxies = {
    count: n,
    values: {
      IDgal: Float64Array.from({ length: n }, (_, i) => i + 1),
      Ngal: Float64Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 3 : 1)),
      z: Float64Array.from({ length: n }, () => 0.02),
      RAJ2000: Float64Array.from(ra),
      DEJ2000: Float64Array.from(dec),
      Dcor: Float64Array.from({ length: n }, () => TEMPEL_DISTANCES.distance(0.02)),
      umag: Float64Array.from({ length: n }, () => flat(16)[0]!),
      gmag: Float64Array.from({ length: n }, () => 16),
      rmag: Float64Array.from({ length: n }, () => 16),
      imag: Float64Array.from({ length: n }, () => 16),
      zmag: Float64Array.from({ length: n }, () => flat(16)[4]!),
      Dfil: Float64Array.from({ length: n }, (_, i) => (i < 10 ? 0.2 : 3)),
      IDpt: Float64Array.from({ length: n }, () => 1),
    },
  };
  const g3Count = 150;
  const g3: G3Galaxies = {
    count: g3Count,
    directions: ra.slice(0, g3Count).map((r, i) => unitVector(r + 5 / 3600, dec[i]!)),
    zCmb: Float32Array.from({ length: g3Count }, () => 0.0201),
    // G3's V 0.3 brighter than the flat spectrum's 15.98, B-V 0.8 against its 0.11.
    vMag: Float32Array.from({ length: g3Count }, () => 15.68),
    bv: Float32Array.from({ length: g3Count }, () => 0.81),
    flags: Uint32Array.from({ length: g3Count }, () => LANIAKEA_FLAGS.V_MEASURED),
  };
  const bossCount = 170;
  const boss: BossGalaxies = {
    cap: 'north',
    count: bossCount,
    ra: Float64Array.from({ length: bossCount }, (_, i) => (i < 150 ? ra[50 + (i % 150)]! : 200 + i * 0.1)),
    dec: Float64Array.from({ length: bossCount }, () => 20),
    // Heliocentric; the CMB frame differs by under 0.0013 here.
    z: Float64Array.from({ length: bossCount }, (_, i) => (i < 150 ? 0.0195 : 0.5)),
    imatch: Float64Array.from({ length: bossCount }, (_, i) => (i === 169 ? 4 : 1)),
    // Model fluxes 0.1 mag brighter than the SDSS's: nanomaggies at 15.9.
    modelFlux: Float64Array.from({ length: bossCount * 5 }, () => 10 ** ((22.5 - 15.9) / 2.5)),
    extinction: new Float64Array(bossCount * 5),
  };

  it('leaves out what G3 draws, keeps the SDSS over BOSS, and calibrates onto G3', () => {
    const tooFew = { ...tempel, values: { ...tempel.values } };
    expect(() => buildGalaxies({ tempel: tooFew, boss: [boss], g3: { ...g3, flags: new Uint32Array(g3Count) }, localVolume: { directions: [], zCmb: [] } })).toThrow(/calibrate/);

    const build = buildGalaxies({ tempel, boss: [boss], g3, localVolume: { directions: [unitVector(ra[199]!, 20)], zCmb: [Number.NaN] } });
    expect(build.counts.sdssMainInG3).toBe(150);
    expect(build.counts.sdssMainInLocalVolume).toBe(1);
    expect(build.counts.sdssMain).toBe(49);
    // BOSS 0-49 duplicate SDSS galaxies G3 holds and 50-149 SDSS ones it does not: all are the SDSS's.
    expect(build.counts.bossInSdssMain).toBe(150);
    expect(build.counts.bossNotGalaxyRedshift).toBe(1);
    expect(build.counts.boss).toBe(19);
    const [v, bv, bossV, bossBv] = build.calibration;
    expect(v!.offset).toBeCloseTo(15.68 - 15.98, 3);
    expect(bv!.offset).toBeCloseTo(0.81 - 0.11, 3);
    // BOSS's V, 15.9 less V's AB-Vega 0.02, onto the calibrated SDSS's 15.68.
    expect(bossV!.offset).toBeCloseTo(15.68 - (15.9 - 0.02), 2);
    // Its B-V: B read between u (15.86 AB) and g (15.9) at 4344 x 1.0195 A, plus Vega's 0.11.
    const t = Math.log10((4344 * 1.0195) / 3546) / Math.log10(4670 / 3546);
    expect(bossBv!.offset).toBeCloseTo(0.81 - (15.86 + 0.04 * t + 0.09 - 15.88), 3);
    const sdss = build.galaxies.filter((g) => (g.flags & COSMIC_WEB_FLAGS.SDSS_MAIN) !== 0);
    expect(sdss.every((g) => Math.abs(g.bv - 0.81) < 1e-6)).toBe(true);
    expect(sdss.filter((g) => (g.flags & COSMIC_WEB_FLAGS.GROUP_COMPRESSED) !== 0).length).toBeGreaterThan(0);
    expect(sdss.some((g) => (g.flags & COSMIC_WEB_FLAGS.IN_FILAMENT) !== 0)).toBe(false);
    expect(build.footprints.sdssMain.cellCount()).toBeGreaterThan(0);
  });

  it("checks Tempel's frame against the points galaxies are nearest", () => {
    const points = readTempelPoints(
      {
        ID: Float64Array.from([218, 7383]),
        IDpt: Float64Array.from([10253, 188408]),
        x: Float64Array.from([-312.382, 39.41]),
        y: Float64Array.from([214.769, 175.917]),
        z: Float64Array.from([82.714, 80.18]),
        D: Float64Array.from([388.008, 197.303]),
        vmap: Float64Array.from([0.8575, 0.3025]),
      },
      2,
    );
    const galaxies: TempelGalaxies = {
      count: 2,
      values: {
        RAJ2000: Float64Array.from([251.35022, 164.40942]),
        DEJ2000: Float64Array.from([28.482853, 55.24205]),
        Dcor: Float64Array.from([388.021, 197.373]),
        Dfil: Float64Array.from([0.064, 0.091]),
        IDpt: Float64Array.from([10253, 188408]),
      },
    };
    expect(checkTempelFrame(galaxies, points).median).toBeLessThan(0.35);
    const wrong: TempelGalaxies = { count: 2, values: { ...galaxies.values, RAJ2000: Float64Array.from([231.35022, 144.40942]) } };
    expect(() => checkTempelFrame(wrong, points)).toThrow(/not theirs/);
  });
});
