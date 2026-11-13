import { deflateRawSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { asuUrl, parseAsuTsv } from '../localVolume/asu.ts';
import { LANIAKEA_FLAGS, LANIAKEA_METHODS, LANIAKEA_RECORD_FLOATS } from '../types.ts';
import {
  comovingDistanceMpc,
  czCmb,
  CMB_DIPOLE,
  galacticToIcrs,
  icrsToGalactic,
  icrsToRaDec,
  icrsToSupergalactic,
  luminosityDistanceMpc,
  sceneAt,
  supergalacticToScene,
} from './frames.ts';
import {
  buildLaniakeaGalaxies,
  calibrateHalfLight,
  calibrateVMinusK,
  fromLocalCatalogues,
  halfLightRatioFor,
  inZoneOfAvoidance,
  isQuasar,
  ledaDisplayName,
  matchTwoMrs,
  MAX_GROUP_RADIUS_PC,
  readCf4Galaxies,
  readCf4Groups,
  vMinusKFor,
  zcatTType,
  type Cf4Galaxy,
  type Cf4Group,
  type LocalGalaxy,
  type TullyGalaxy,
  type TwoMrsGalaxy,
} from './galaxies.ts';
import { galaxyDetails, galaxyRecords } from './laniakea.ts';
import { basinLandmarks, greatAttractor, superclusterLandmarks, wallLandmarks } from './landmarks.ts';
import { parseLedaPgcCsv, pgcClause, type LedaRecord } from './ledaPgc.ts';
import { checkAttractors, cropBasins, quantiseDensity, readFitsCube, readZip, voxelToScene, type WatershedGrid } from './watersheds.ts';

/** An ASU-TSV answer as VizieR's mirrors serve one. */
function asu(columns: readonly string[], rows: readonly (readonly string[])[]): string {
  return ['#', '#Column\tPGC\t(I7)\tPGC', '', columns.join('\t'), columns.map(() => ' ').join('\t'), columns.map(() => '----').join('\t'), ...rows.map((r) => r.join('\t')), ''].join('\n');
}

describe('frames', () => {
  it('gives back Cosmicflows-4\'s own galactic and supergalactic coordinates (PGC 2)', () => {
    // CF4 table2: RA 0.0070, Dec +47.2745; GLON 113.9553, GLAT -14.6992; SGL 341.6440, SGB 20.7388.
    const { lDeg, bDeg } = icrsToGalactic(0.007, 47.2745);
    expect(lDeg).toBeCloseTo(113.9553, 3);
    expect(bDeg).toBeCloseTo(-14.6992, 3);
    const { sglDeg, sgbDeg } = icrsToSupergalactic(0.007, 47.2745);
    expect(sglDeg).toBeCloseTo(341.644, 3);
    expect(sgbDeg).toBeCloseTo(20.7388, 3);
  });

  it('moves a heliocentric velocity to the CMB frame as Cosmicflows-4 does (group PGC 12: Vh 6532, V3k 6179)', () => {
    expect(Math.abs(czCmb(0.036, -6.3739, 6532) - 6179)).toBeLessThan(15);
    const apex = icrsToRaDec(galacticToIcrs(CMB_DIPOLE.lDeg, CMB_DIPOLE.bDeg));
    expect(czCmb(apex.raDeg, apex.decDeg, 0)).toBeCloseTo(CMB_DIPOLE.speedKmS, 3);
  });

  it('turns a redshift into the Hubble law nearby and a comoving distance far off', () => {
    expect(comovingDistanceMpc(0.001)).toBeCloseTo((299792.458 * 0.001) / 74.6, 2);
    expect(comovingDistanceMpc(0.1)).toBeGreaterThan(390);
    expect(comovingDistanceMpc(0.1)).toBeLessThan(395);
    expect(luminosityDistanceMpc(0.1)).toBeCloseTo(1.1 * comovingDistanceMpc(0.1), 6);
  });

  it('puts the supergalactic pole where galactic l 47.37, b +6.32 is', () => {
    const pole = supergalacticToScene([0, 0, 1]);
    const { raDeg, decDeg } = icrsToRaDec(galacticToIcrs(47.37, 6.32));
    const expected = sceneAt(raDeg, decDeg, 1);
    pole.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!, 9));
  });
});

describe('the watershed files', () => {
  /** A one-file zip, stored or deflated. */
  function zip(name: string, data: Uint8Array, deflate: boolean): Uint8Array {
    const body = deflate ? new Uint8Array(deflateRawSync(data)) : data;
    const nameBytes = new TextEncoder().encode(name);
    const local = new Uint8Array(30 + nameBytes.length + body.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, deflate ? 8 : 0, true);
    lv.setUint32(18, body.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(body, 30 + nameBytes.length);
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, deflate ? 8 : 0, true);
    cv.setUint32(20, body.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, 0, true);
    central.set(nameBytes, 46);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, 1, true);
    ev.setUint16(10, 1, true);
    ev.setUint32(12, central.length, true);
    ev.setUint32(16, local.length, true);
    const out = new Uint8Array(local.length + central.length + end.length);
    out.set(local, 0);
    out.set(central, local.length);
    out.set(end, local.length + central.length);
    return out;
  }

  /** A FITS cube of n^3 big-endian float64, NAXIS1 fastest. */
  function fitsCube(n: number, value: (i: number, j: number, k: number) => number): Uint8Array {
    const cards = ['SIMPLE  =                    T', 'BITPIX  =                  -64', 'NAXIS   =                    3', `NAXIS1  = ${String(n).padStart(20)}`, `NAXIS2  = ${String(n).padStart(20)}`, `NAXIS3  = ${String(n).padStart(20)}`, 'END'];
    const header = new TextEncoder().encode(cards.map((c) => c.padEnd(80)).join('').padEnd(2880));
    const data = new Uint8Array(Math.ceil((n ** 3 * 8) / 2880) * 2880);
    const view = new DataView(data.buffer);
    for (let k = 0; k < n; k += 1) {
      for (let j = 0; j < n; j += 1) {
        for (let i = 0; i < n; i += 1) {
          view.setFloat64((i + n * (j + n * k)) * 8, value(i, j, k));
        }
      }
    }
    const out = new Uint8Array(header.length + data.length);
    out.set(header, 0);
    out.set(data, header.length);
    return out;
  }

  it('reads a zip\'s files, stored or deflated', () => {
    const data = new TextEncoder().encode('SIMPLE  = basins');
    for (const deflate of [false, true]) {
      const files = readZip(zip('CF4_new_128-z008_BoA.fits', data, deflate));
      expect(new TextDecoder().decode(files.get('CF4_new_128-z008_BoA.fits'))).toBe('SIMPLE  = basins');
    }
    expect(() => readZip(new Uint8Array(40))).toThrow(/zip/);
  });

  it('reads a FITS cube with NAXIS1 fastest, and refuses one cut short', () => {
    const bytes = fitsCube(4, (i, j, k) => i + 10 * j + 100 * k);
    const cube = readFitsCube(bytes);
    expect(cube.size).toBe(4);
    expect(cube.values[1 + 4 * (2 + 4 * 3)]).toBe(321);
    expect(() => readFitsCube(bytes.subarray(0, 3000))).toThrow(/cut short/);
  });

  it('crops the kept basins to one box for all three grids, drops the SDSS ones, and finds the Milky Way\'s', () => {
    const n = 8;
    const cube = (label: (i: number, j: number, k: number) => number) => readFitsCube(fitsCube(n, label));
    const cubes: Record<WatershedGrid, { size: number; values: Float64Array }> = {
      // Laniakea (1) about the centre, an SDSS basin (7) in a corner: not kept.
      galaxiesAttraction: cube((i, j, k) => (Math.abs(i - 4) <= 1 && Math.abs(j - 4) <= 1 && k === 4 ? 1 : i === 0 && j === 0 ? 7 : 0)),
      galaxiesRepulsion: cube((i, j, k) => (i === 6 && j === 5 && k === 3 ? 1 : 0)),
      groupsAttraction: cube((i, j, k) => (i >= 3 && j >= 3 && k >= 3 && i <= 5 && j <= 5 && k <= 5 ? 4 : 0)),
    };
    const crop = cropBasins(cubes);
    expect(crop.offset).toEqual([3, 3, 3]);
    expect(crop.size).toEqual([4, 3, 3]);
    expect(crop.voxels.galaxiesAttraction).toEqual({ 1: 9 });
    expect(crop.home).toEqual({ galaxiesAttraction: 1, galaxiesRepulsion: 0, groupsAttraction: 4 });
    expect([...crop.grids.galaxiesAttraction].filter((v) => v === 7)).toHaveLength(0);
    // At this size the attractors fall outside the grid: every one is reported.
    expect(checkAttractors(cubes).length).toBeGreaterThan(0);
  });

  it('places the Milky Way\'s voxel at the origin and a voxel along SGX one voxel along the supergalactic x axis', () => {
    const m = voxelToScene(128, [24, 0, 25]);
    const at = (i: number, j: number, k: number) => [0, 1, 2].map((r) => m[r]! * i + m[4 + r]! * j + m[8 + r]! * k + m[12 + r]!);
    at(64 - 24, 64, 64 - 25).forEach((v) => expect(Math.abs(v)).toBeLessThan(1e-3));
    const cellPc = (1000 / 128) * (1e6 / 0.746);
    const step = at(65 - 24, 64, 64 - 25);
    const axis = supergalacticToScene([cellPc, 0, 0]);
    step.forEach((v, i) => expect(v).toBeCloseTo(axis[i]!, 3));
  });

  it('quantises delta in steps of 1/32, clamped', () => {
    expect([...quantiseDensity(Float64Array.of(0, 1, -1.5, 9, -9))]).toEqual([0, 32, -48, 127, -127]);
  });
});

describe('HyperLEDA by PGC number', () => {
  it('reads its CSV and refuses a query it could not run', () => {
    const text = [
      '# Query',
      'objname;pgc;objtype;al2000;de2000;t;bt;vt;ag;logd25;logr25;pa;incl',
      '#-------;---;-------',
      'NGC4889;44715;G ;12.9999;27.9770;-4.3;12.6;11.5;0.03;1.46;0.12;80;46',
      'HD038841;2944028;S ;5.80057;-13.1554;;9.58;9.6;0.908;;;;',
      '# 2 lines were successfully retrieved',
    ].join('\n');
    const records = parseLedaPgcCsv(text);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ pgc: 44715, name: 'NGC4889', type: 'G', tType: -4.3, bMag: 12.6, vMag: 11.5, logD25: 1.46 });
    expect(records[0]!.raDeg).toBeCloseTo(194.9985, 3);
    expect(records[1]!.positionAngleDeg).toBeNull();
    expect(() => parseLedaPgcCsv('Internal database error (565)')).toThrow(/refused/);
  });

  it('asks only for whole PGC numbers', () => {
    expect(pgcClause([2, 4, 12])).toBe('pgc in (2,4,12)');
    expect(() => pgcClause([1.5])).toThrow();
    expect(() => pgcClause([-3])).toThrow();
  });
});

describe('names and codes', () => {
  it('spaces HyperLEDA\'s names, and gives Messier and common names', () => {
    expect(ledaDisplayName('NGC4889')).toEqual({ name: 'NGC 4889', otherNames: [] });
    expect(ledaDisplayName('NGC1068')).toEqual({ name: 'M77', otherNames: ['NGC 1068'] });
    expect(ledaDisplayName('NGC1275')).toEqual({ name: 'NGC 1275', otherNames: ['Perseus A'] });
    expect(ledaDisplayName('ESO137-006')).toEqual({ name: 'ESO 137-6', otherNames: [] });
    expect(ledaDisplayName('PGC000004').name).toBe('PGC 4');
    expect(ledaDisplayName('UGC12889').name).toBe('UGC 12889');
    expect(ledaDisplayName('MCG-05-33-002').name).toBe('MCG -5-33-2');
  });

  it('reads ZCAT types, and knows its quasars', () => {
    expect(zcatTType(' 3A2s')).toBe(3);
    expect(zcatTType('-5   ')).toBe(-5);
    expect(zcatTType('98   ')).toBeNull();
    expect(isQuasar('-9   ')).toBe(true);
    expect(isQuasar('-5   ')).toBe(false);
  });

  it('draws 2MRS\'s zone of avoidance wider about the Galactic centre', () => {
    expect(inZoneOfAvoidance(100, 4.9)).toBe(true);
    expect(inZoneOfAvoidance(100, 6)).toBe(false);
    expect(inZoneOfAvoidance(10, 7)).toBe(true);
    expect(inZoneOfAvoidance(345, -7)).toBe(true);
    expect(inZoneOfAvoidance(40, 7)).toBe(false);
  });
});

describe('the catalogues', () => {
  const CF4 = parseAsuTsv(
    asu(
      ['PGC', '1PGC', 'Vcmb', 'DM', 'e_DM', 'DMsnIa', 'DMtf', 'DMfp', 'DMsbf', 'DMsnII', 'DMtrgb', 'DMceph', 'DMmas', 'RAJ2000', 'DEJ2000'],
      [
        ['      2', '  73150', ' 4726', '34.535', ' 0.460', '      ', '34.535', '      ', '', '', '', '', '', '000.0070', '+47.2745'],
        ['  44715', '  44715', ' 6900', '34.850', ' 0.400', '      ', '      ', '34.850', '', '', '', '', '', '194.9985', '+27.9770'],
        ['  44628', '  44715', ' 7300', '34.900', ' 0.450', '35.000', '      ', '34.900', '', '', '', '', '', '194.8988', '+27.9593'],
      ],
    ),
  );

  it('reads CF4\'s galaxies and their methods', () => {
    const galaxies = readCf4Galaxies(CF4);
    expect(galaxies[0]).toMatchObject({ pgc: 2, group: 73150, vCmb: 4726, modulus: 34.535, methods: LANIAKEA_METHODS.TF });
    expect(galaxies[2]!.methods).toBe(LANIAKEA_METHODS.SNIa | LANIAKEA_METHODS.FP);
  });

  it('centres a CF4 group on its members, whatever the groups table says', () => {
    const rows = parseAsuTsv(
      asu(
        ['1PGC', 'Ngal', 'DMzp', 'e_DMzp', 'Vcmb', 'RAJ2000', 'DEJ2000'],
        [
          // Coma's centre put 160 degrees away, as CF4's groups table does some groups'.
          ['  44715', '  2', '34.870', ' 0.025', ' 1234', '354.1271', '+10.9462'],
          ['  73150', '  1', '34.535', ' 0.460', ' 4726', '000.0070', '+47.2745'],
        ],
      ),
    );
    const { groups, moved } = readCf4Groups(rows, readCf4Galaxies(CF4));
    expect(moved).toBe(1);
    const coma = groups.get(44715)!;
    expect(coma.raDeg).toBeCloseTo(194.95, 1);
    expect(coma.decDeg).toBeCloseTo(27.97, 1);
    expect(coma.vCmb).toBe(7100);
    expect(coma.modulus).toBe(34.87);
    // A group none of whose galaxies are read keeps the table's.
    expect(groups.get(73150)!.vCmb).toBe(4726);
  });

  it('matches 2MRS to Tully\'s PGC by position and K_s, else to CF4 by position', () => {
    const mrs: TwoMrsGalaxy[] = [
      { id: 'A', raDeg: 10, decDeg: 10, lDeg: 0, bDeg: 50, kMag: 10.0, isophoteLogArcsec: 1, axisRatio: 0.5, type: '3', cz: 3000 },
      // Tully has a galaxy here, but 0.3 mag apart in K_s: another galaxy. CF4 has it, 5" off.
      { id: 'B', raDeg: 20, decDeg: 10, lDeg: 0, bDeg: 50, kMag: 10.0, isophoteLogArcsec: 1, axisRatio: 0.5, type: '3', cz: 3000 },
      { id: 'C', raDeg: 30, decDeg: 10, lDeg: 0, bDeg: 50, kMag: 10.0, isophoteLogArcsec: 1, axisRatio: 0.5, type: '3', cz: 3000 },
    ];
    const tully = [
      { pgc: 100, raDeg: 10 + 5 / 3600, decDeg: 10, kMag: 10.01 },
      { pgc: 200, raDeg: 20, decDeg: 10, kMag: 10.3 },
    ].map((t) => ({ ...t, tType: null, heliocentricKmS: 3000, nest: 0, nestMembers: 1, nestPgc1: t.pgc, nestVirialMass: null, nestLuminosityMass: null, nestR2t: null, nestSigma: null }));
    const cf4 = [{ pgc: 300, group: 300, raDeg: 20, decDeg: 10 + 5 / 3600, vCmb: 3000, modulus: 33, modulusError: 0.4, methods: 2 }];
    const match = matchTwoMrs(mrs, tully, cf4);
    expect(match.pgc).toEqual([100, 300, null]);
    expect(match.byTully).toBe(1);
    expect(match.byCf4).toBe(1);
  });

  it('knows a galaxy local-group.json or local-volume.json draws, and not its background', () => {
    const local = (name: string, ra: number, dec: number, size: number, halfLight: number, velocity: number | null): LocalGalaxy => {
      const r = (ra * Math.PI) / 180;
      const d = (dec * Math.PI) / 180;
      return { catalogue: 'local-volume', name, names: [name], raDeg: ra, decDeg: dec, unit: [Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d)], sizeArcmin: size, halfLightArcmin: halfLight, velocity, measuredHalfLightArcmin: null };
    };
    const locals = [local('M87', 187.706, 12.391, 8, 0, 1284), local('LMC', 80.89, -69.76, 0, 300, 262)];
    const at = (raDeg: number, decDeg: number, names: string[], sizeArcmin: number | null, velocity: number | null) => fromLocalCatalogues({ raDeg, decDeg, names, sizeArcmin, velocity }, locals);
    expect(at(187.7059, 12.3911, ['NGC 4486'], 7, 1300)?.name).toBe('M87');
    expect(at(187.75, 12.4, ['M87'], 7, 1300)?.name).toBe('M87');
    expect(at(187.72, 12.391, ['PGC 1'], 0.5, 1300)?.name).toBe('M87');
    expect(at(187.72, 12.391, ['PGC 1'], 0.5, 9000)).toBeNull();
    expect(at(187.8, 12.391, ['PGC 1'], 0.5, 1300)).toBeNull();
    // Behind the Large Magellanic Cloud, at 5,000 km/s: not it.
    expect(at(81, -69, ['PGC 2'], 1, 5000)).toBeNull();
    expect(at(81, -69, ['PGC 3'], 1, 270)?.name).toBe('LMC');
  });
});

describe('the calibrations', () => {
  it('measures V - K_s by type, falling back to all types for a thin bin', () => {
    const calibrators = [
      ...Array.from({ length: 30 }, (_, i) => ({ tType: -5, vFromB: 13 + i * 0.01, kMag: 10 })),
      ...Array.from({ length: 25 }, () => ({ tType: 4, vFromB: 12.8, kMag: 10 })),
      ...Array.from({ length: 3 }, () => ({ tType: 10, vFromB: 12, kMag: 10 })),
    ];
    const table = calibrateVMinusK(calibrators);
    expect(vMinusKFor(table, -5)).toBeCloseTo(3.145, 3);
    expect(vMinusKFor(table, 4)).toBeCloseTo(2.8, 6);
    expect(vMinusKFor(table, 10)).toBe(table.find((r) => r.bin === 'all')!.value);
    expect(vMinusKFor(table, null)).toBe(table.find((r) => r.bin === 'all')!.value);
    expect(() => calibrateVMinusK(calibrators.slice(0, 5))).toThrow(/Only 5/);
  });

  it('measures the half-light radius over R25 for early and late types', () => {
    const calibrators = [
      ...Array.from({ length: 12 }, () => ({ tType: -4, halfLightArcmin: 0.35, r25Arcmin: 1 })),
      ...Array.from({ length: 12 }, () => ({ tType: 5, halfLightArcmin: 0.5, r25Arcmin: 1 })),
    ];
    const table = calibrateHalfLight(calibrators);
    expect(halfLightRatioFor(table, -4)).toBeCloseTo(0.35, 6);
    expect(halfLightRatioFor(table, 5)).toBeCloseTo(0.5, 6);
    expect(() => calibrateHalfLight(calibrators.slice(0, 4))).toThrow(/Only 4/);
  });
});

describe('the build', () => {
  /**
   * A cluster of three CF4 galaxies and a 2MRS-only one in the same 2MASS nest, at 100 Mpc; a
   * lone CF4 galaxy; a 2MRS-only field galaxy; a 2MRS quasar; a galaxy the Local Volume
   * draws; and forty calibrators far off, so the calibrations have what they need.
   */
  function parts() {
    const cf4: Cf4Galaxy[] = [];
    const tully: TullyGalaxy[] = [];
    const mrs: TwoMrsGalaxy[] = [];
    const leda = new Map<number, LedaRecord>();
    const record = (pgc: number, name: string, raDeg: number, decDeg: number, tType: number, bMag: number): LedaRecord => ({
      pgc, name, type: 'G', raDeg, decDeg, tType, bMag, vMag: null, extinctionB: 0.05, logD25: 1.0, logR25: 0.2, positionAngleDeg: 190, inclinationDeg: 60,
    });
    const tullyRow = (pgc: number, raDeg: number, decDeg: number, kMag: number, nest: number, hv: number): TullyGalaxy => ({
      pgc, raDeg, decDeg, kMag, tType: 3, heliocentricKmS: hv, nest, nestMembers: 4, nestPgc1: 1, nestVirialMass: 100, nestLuminosityMass: 100, nestR2t: 1, nestSigma: 500,
    });
    const mrsRow = (id: string, raDeg: number, decDeg: number, kMag: number, cz: number | null, type = ' 3'): TwoMrsGalaxy => ({ id, raDeg, decDeg, lDeg: 100, bDeg: 40, kMag, isophoteLogArcsec: 1.2, axisRatio: 0.6, type, cz });
    // The cluster: CF4 group 1 at modulus 35 (100 Mpc).
    for (const [pgc, ra] of [[1, 150], [2, 150.1], [3, 149.9]] as const) {
      cf4.push({ pgc, group: 1, raDeg: ra, decDeg: 20, vCmb: 7500, modulus: 35, modulusError: 0.4, methods: LANIAKEA_METHODS.FP });
      tully.push(tullyRow(pgc, ra, 20, 10, 100001, 7400));
      mrs.push(mrsRow(`C${pgc}`, ra, 20, 10, 7400));
      leda.set(pgc, record(pgc, `NGC000${pgc}`, ra, 20, -5, 13));
    }
    // Its member CF4 did not measure: linked to the group through the nest.
    tully.push(tullyRow(4, 150.05, 20.05, 11, 100001, 7700));
    mrs.push(mrsRow('C4', 150.05, 20.05, 11, 7700));
    leda.set(4, record(4, 'PGC000004', 150.05, 20.05, 3, 15));
    // A lone CF4 galaxy, with only K (its HyperLEDA record a star's).
    cf4.push({ pgc: 5, group: 5, raDeg: 30, decDeg: -30, vCmb: 3000, modulus: 33, modulusError: 0.4, methods: LANIAKEA_METHODS.TF });
    tully.push(tullyRow(5, 30, -30, 9, 0, 3000));
    mrs.push(mrsRow('L5', 30, -30, 9, 3000));
    leda.set(5, { ...record(5, 'HD000005', 30, -30, 4, 8), type: 'S' });
    // A field galaxy 2MRS alone holds; a quasar; one with no redshift; one in the Local Volume.
    mrs.push(mrsRow('F1', 60, 10, 11, 6000));
    mrs.push(mrsRow('Q1', 187.28, 2.05, 9.9, 47469, '-9'));
    mrs.push(mrsRow('N1', 61, 10, 11.5, null));
    mrs.push(mrsRow('V1', 187.706, 12.391, 5.8, 1284));
    // Calibrators: 40 CF4 groups of one far off, B and K both, and in local-volume.json's Virgo.
    for (let i = 0; i < 40; i += 1) {
      const pgc = 1000 + i;
      const ra = 200 + i;
      cf4.push({ pgc, group: pgc, raDeg: ra, decDeg: -60, vCmb: 5000, modulus: 34, modulusError: 0.4, methods: LANIAKEA_METHODS.TF });
      tully.push(tullyRow(pgc, ra, -60, 10, 0, 5000));
      mrs.push(mrsRow(`K${i}`, ra, -60, 10, 5000));
      leda.set(pgc, record(pgc, `PGC00${pgc}`, ra, -60, i % 2 === 0 ? -5 : 4, 13.1 + (i % 2 === 0 ? 0.96 : 0.57)));
    }
    const cf4Groups = new Map<number, Cf4Group>([[1, { pgc1: 1, members: 3, modulus: 35, modulusError: 0.05, vCmb: 7500, raDeg: 150, decDeg: 20 }]]);
    for (const c of cf4.filter((g) => g.group !== 1)) {
      cf4Groups.set(c.pgc, { pgc1: c.pgc, members: 1, modulus: c.modulus, modulusError: c.modulusError, vCmb: c.vCmb, raDeg: c.raDeg, decDeg: c.decDeg });
    }
    const unit = (ra: number, dec: number): [number, number, number] => {
      const r = (ra * Math.PI) / 180;
      const d = (dec * Math.PI) / 180;
      return [Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d)];
    };
    const locals: LocalGalaxy[] = [
      { catalogue: 'local-volume', name: 'M87', names: ['M87'], raDeg: 187.706, decDeg: 12.391, unit: unit(187.706, 12.391), sizeArcmin: 8, halfLightArcmin: 0, velocity: 1284, measuredHalfLightArcmin: null },
      // The calibrators' twins, each with a measured half-light radius (0.4 R25 and 0.5 R25).
      ...Array.from({ length: 24 }, (_, i): LocalGalaxy => ({
        catalogue: 'local-volume', name: `VCC ${i}`, names: [`VCC ${i}`], raDeg: 100 + i, decDeg: 5, unit: unit(100 + i, 5), sizeArcmin: 3, halfLightArcmin: 0, velocity: 1500,
        measuredHalfLightArcmin: i % 2 === 0 ? 0.2 : 0.25,
      })),
    ];
    for (let i = 0; i < 24; i += 1) {
      const pgc = 5000 + i;
      cf4.push({ pgc, group: pgc, raDeg: 100 + i, decDeg: 5, vCmb: 1500, modulus: 31, modulusError: 0.4, methods: LANIAKEA_METHODS.TF });
      cf4Groups.set(pgc, { pgc1: pgc, members: 1, modulus: 31, modulusError: 0.4, vCmb: 1500, raDeg: 100 + i, decDeg: 5 });
      leda.set(pgc, record(pgc, `PGC00${pgc}`, 100 + i, 5, i % 2 === 0 ? -5 : 4, 12));
    }
    return { cf4, cf4Groups, mrs, tully, leda, locals };
  }

  const build = buildLaniakeaGalaxies(parts());
  const byName = (name: string) => build.galaxies.find((g) => g.name === name)!;

  it('leaves out what the local catalogues draw, quasars, and galaxies with no redshift', () => {
    expect(build.excluded.local).toContain('2MASX JV1 = M87');
    expect(build.excluded.local.filter((e) => e.includes('VCC'))).toHaveLength(24);
    expect(build.excluded.quasars).toBe(1);
    expect(build.excluded.noRedshift).toBe(1);
    expect(build.galaxies.some((g) => g.name.includes('Q1'))).toBe(false);
  });

  it('places a cluster\'s CF4 members at its group\'s distance, its 2MRS-only member linked to it, and draws their depth', () => {
    const members = ['NGC 1', 'NGC 2', 'NGC 3', 'PGC 4'].map(byName);
    for (const g of members) {
      expect(g.group).toBe(members[0]!.group);
      expect(g.flags & LANIAKEA_FLAGS.DEPTH_DRAWN).toBeTruthy();
      expect(g.luminosityDistancePc / 1e6).toBeGreaterThan(95);
      expect(g.luminosityDistancePc / 1e6).toBeLessThan(105);
      expect(g.distanceErrorPc).toBeCloseTo(1e8 * (1 + 0) * (Math.LN10 / 5) * 0.05 * (g.luminosityDistancePc / 1e8), -4);
    }
    expect(byName('NGC 1').flags & LANIAKEA_FLAGS.DISTANCE_GROUP).toBeTruthy();
    expect(byName('PGC 4').flags & LANIAKEA_FLAGS.DISTANCE_LINKED).toBeTruthy();
    const group = build.groups[members[0]!.group]!;
    expect(group.members).toBe(4);
    expect(group.depthSigmaPc).toBeGreaterThan(0);
    expect(group.depthSigmaPc).toBeLessThan(MAX_GROUP_RADIUS_PC);
  });

  it('places a lone CF4 galaxy at its own distance, and a field galaxy by its redshift', () => {
    const lone = build.galaxies.find((g) => g.pgc === 5)!;
    expect(lone.flags & LANIAKEA_FLAGS.DISTANCE_OWN).toBeTruthy();
    expect(lone.group).toBe(-1);
    const field = byName('2MASX JF1');
    expect(field.flags & LANIAKEA_FLAGS.DISTANCE_REDSHIFT).toBeTruthy();
    expect(Number.isNaN(field.distanceErrorPc)).toBe(true);
    expect(field.distancePc / 1e6).toBeGreaterThan(70);
    expect(field.distancePc / 1e6).toBeLessThan(90);
  });

  it('does not use a HyperLEDA record that is a star\'s: V from K_s, named by its 2MASS designation', () => {
    const lone = build.galaxies.find((g) => g.pgc === 5)!;
    expect(lone.name).toBe('2MASX JL5');
    expect(lone.flags & LANIAKEA_FLAGS.V_FROM_K).toBeTruthy();
    expect(lone.vMag).toBeGreaterThan(11);
  });

  it('measures V from B less a colour by type, and sizes from D25 by the calibrated ratio', () => {
    const g = byName('NGC 1');
    expect(g.vMag).toBeCloseTo(13 - 0.05 - 0.96, 6);
    expect(g.flags & LANIAKEA_FLAGS.COLOUR_ESTIMATED).toBeTruthy();
    expect(g.positionAngleDeg).toBe(10);
    expect(g.axisRatio).toBeCloseTo(10 ** -0.2, 6);
    const early = build.halfLight.find((r) => r.bin.startsWith('early'))!.value;
    expect(early).toBeCloseTo(0.4, 6);
    const angular = g.distancePc / (1 + 7500 / 299792.458);
    expect(g.halfLightPc).toBeCloseTo(((early * 0.5) / 60) * (Math.PI / 180) * angular, -1);
  });

  it('writes the records and details as the schema says', () => {
    const records = new DataView(galaxyRecords(build).buffer);
    const k = build.galaxies.indexOf(byName('NGC 1'));
    const g = build.galaxies[k]!;
    const f = (i: number) => records.getFloat32((k * LANIAKEA_RECORD_FLOATS + i) * 4, true);
    expect(f(0)).toBeCloseTo(g.position[0], -1);
    expect(f(3)).toBeCloseTo(g.absV, 4);
    expect(f(10)).toBe(g.flags);
    expect(f(11)).toBe(g.group);
    const details = galaxyDetails(build);
    const n = build.galaxies.length;
    const view = new DataView(details.buffer);
    expect(view.getUint32(k * 4, true)).toBe(1);
    expect(view.getFloat32(n * 4 * 5 + k * 4, true)).toBeCloseTo(g.vMag, 4);
    expect(view.getUint8(n * 4 * 7 + k)).toBe(LANIAKEA_METHODS.FP);
    expect(details.length).toBe(n * 4 * 7 + n);
    // Most luminous first.
    const absV = build.galaxies.map((x) => x.absV).filter((v) => !Number.isNaN(v));
    expect([...absV].sort((a, b) => a - b)).toEqual(absV);
  });
});

describe('the landmarks', () => {
  it('places the Great Attractor at galactic l 307, b +9', () => {
    const ga = greatAttractor();
    const { lDeg, bDeg } = icrsToGalactic(ga.raDeg, ga.decDeg);
    expect(lDeg).toBeCloseTo(307, 6);
    expect(bDeg).toBeCloseTo(9, 6);
    expect(ga.distanceEstimated).toBe(true);
  });

  it('places Laniakea at its attractor with a sphere of its basin\'s volume', () => {
    const voxels = { galaxiesAttraction: { 1: 4079 }, galaxiesRepulsion: {}, groupsAttraction: {} };
    const laniakea = basinLandmarks({ basinVoxels: voxels, basinVoxelSize: 128 }).find((l) => l.name === 'Laniakea Supercluster')!;
    expect(laniakea.distancePc / 1e6).toBeCloseTo(Math.hypot(62, 8, 39) / 0.746, 0);
    expect(laniakea.basin).toEqual([{ grid: 'galaxiesAttraction', label: 1 }]);
    const volume = (4 / 3) * Math.PI * (laniakea.radiusPc! / 1e6) ** 3;
    expect(volume * 0.746 ** 3).toBeCloseTo(1.945e6, -4);
  });

  it('reads Einasto et al.\'s superclusters, at h 0.746', () => {
    const rows = parseAsuTsv(
      asu(['_RAJ2000', '_DEJ2000', 'SC', 'Nmembers', 'Dist', 'ID'], [['196.4900', '-33.0700', '  124', ' 34', ' 142', 'Shapley             ']]),
    );
    const { landmarks, missing } = superclusterLandmarks(rows);
    expect(landmarks[0]).toMatchObject({ name: 'Shapley Supercluster', members: 34, kind: 'supercluster' });
    expect(landmarks[0]!.distancePc / 1e6).toBeCloseTo(142 / 0.746, 0);
    expect(missing).toContain('Hercules Supercluster');
  });

  it('draws the Sloan Great Wall along the equator at z 0.073', () => {
    const wall = wallLandmarks().find((w) => w.name === 'Sloan Great Wall')!;
    expect(wall.path).toHaveLength(5);
    for (const p of wall.path!) {
      expect(Math.hypot(...p) / 1e6).toBeCloseTo(comovingDistanceMpc(0.073), 0);
    }
  });
});

describe('VizieR', () => {
  it('escapes a catalogue name with a plus, and adds the extra parameters', () => {
    expect(asuUrl('https://m/asu-tsv', 'J/A+AS/123/119/tablea2', '&-out.add=_RAJ,_DEJ')).toBe(
      'https://m/asu-tsv?-source=J/A%2BAS/123/119/tablea2&-out.max=unlimited&-out.all&-out.add=_RAJ,_DEJ',
    );
    expect(asuUrl('https://m/asu-tsv', 'J/AJ/145/101/catalog')).toBe('https://m/asu-tsv?-source=J/AJ/145/101/catalog&-out.max=unlimited&-out.all');
  });
});
