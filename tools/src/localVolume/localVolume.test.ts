import { describe, expect, it } from 'vitest';

import type { LocalGroupCatalog } from '../types.ts';
import { asuNumber, parseAsuTsv } from './asu.ts';
import { boxClause, matchLeda, parseLedaCsv } from './hyperleda.ts';
import {
  buildLocalVolume,
  circularHalfLightFraction,
  evccName,
  holmbergHalfLightRatio,
  johnsonFromSdss,
  selectEvcc,
  selectUngc,
  templateColour,
  ungcGroups,
  ungcName,
  virgoPlacement,
  virgoSubstructure,
  withHolmbergHalfLight,
} from './localVolume.ts';

/** An ASU-TSV answer as VizieR's mirrors serve one: comments, header, units, dashes, rows. */
function asu(columns: readonly string[], rows: readonly (readonly string[])[]): string {
  return [
    '#',
    '#   VizieR Astronomical Server vizier.cfa.harvard.edu',
    '#Column\tName\t(a18)\tGalaxy name',
    '',
    columns.join('\t'),
    columns.map(() => ' ').join('\t'),
    columns.map(() => '----').join('\t'),
    ...rows.map((row) => row.join('\t')),
    '',
  ].join('\n');
}

const UNGC_COLUMNS = ['Name', 'RAJ2000', 'DEJ2000', 'a26', 'b/a', 'AB', 'Bmag', 'TT', 'Mcl', 'HRV', 'Dist', 'f_Dist', 'i', 'l_MHI', 'MHI', 'MD', 'Ti1', 'KLum'];
const UNGC = parseAsuTsv(
  asu(UNGC_COLUMNS, [
    // In McConnachie's catalogue: left out.
    ['WLM               ', '00 01 58.1', '-15 27 40', ' 11.48', ' 0.35', ' 0.16', '11.03', ' 9', 'Im   ', '-122', ' 0.97', 'TRGB', '90', ' ', ' 7.83', 'MESSIER031     ', ' 0.0', ' 7.69'],
    // Drawn by the app itself.
    ['MESSIER031        ', '00 42 44.5', '+41 16 08', '190.55', ' 0.32', ' 0.27', ' 4.36', ' 3', '     ', '-300', ' 0.77', 'Cep ', '77', ' ', ' 9.73', 'Milky Way      ', ' 0.4', '10.73'],
    ['MESSIER081        ', '09 55 33.2', '+69 03 55', ' 26.92', ' 0.52', ' 0.29', ' 7.89', ' 3', '     ', ' -34', ' 3.63', 'Cep ', '62', ' ', ' 9.42', 'MESSIER082     ', ' 1.0', '10.95'],
    ['MESSIER082        ', '09 55 52.4', '+69 40 47', ' 11.22', ' 0.38', ' 0.54', ' 9.30', ' 8', '     ', ' 203', ' 3.53', 'TRGB', '69', ' ', ' 8.92', 'MESSIER081     ', ' 2.0', '10.65'],
    ['KDG061            ', '09 57 02.7', '+68 35 30', '  1.86', ' 0.50', ' 0.31', '15.20', '-3', 'Sph  ', '-135', ' 3.66', 'TRGB', '60', '<', ' 6.00', 'MESSIER082     ', ' 3.6', ' 7.80'],
    ['NGC0253           ', '00 47 34.3', '-25 17 32', ' 26.30', ' 0.23', ' 0.08', ' 8.04', ' 5', '     ', ' 243', ' 3.94', 'TRGB', '85', ' ', ' 9.24', 'NGC0247        ', '-0.5', '10.98'],
    ['NGC0247           ', '00 47 08.3', '-20 45 37', ' 21.38', ' 0.32', ' 0.08', ' 9.67', ' 7', '     ', ' 160', ' 3.72', 'TRGB', '74', ' ', ' 9.24', 'NGC0253        ', ' 1.5', ' 9.89'],
    ['UGC07584          ', '12 28 02.9', '+22 35 18', '  0.91', ' 0.60', ' 0.12', '15.88', '10', 'BCD  ', ' 603', ' 9.20', 'TF  ', '55', ' ', ' 7.69', 'NGC4565        ', ' 0.4', ' 8.10'],
    ['NGC5194           ', '13 29 52.4', '+47 11 54', ' 13.80', ' 0.62', ' 0.15', ' 8.67', ' 5', '     ', ' 463', ' 8.39', 'SN  ', '53', ' ', ' 9.51', 'NGC5195        ', ' 1.0', '10.81'],
  ]),
);
const DISTANCES = parseAsuTsv(
  asu(
    ['Name', 'DM', 'e_DM', 'n_DM'],
    [
      ['WLM               ', '24.93', ' 0.04', 'TRGB'],
      ['MESSIER081        ', '27.80', ' 0.08', 'Cep '],
      ['MESSIER082        ', '27.74', ' 0.04', 'TRGB'],
      // A distance by another method than the adopted one is not the adopted's.
      ['KDG061            ', '27.90', ' 0.20', 'BS  '],
      // An error past a magnitude is a typo, left out.
      ['NGC5194           ', '29.62', '24.23', 'SN  '],
    ],
  ),
);

/** McConnachie's catalogue as local-group.json gives it, the columns the matching reads. */
const LOCAL_GROUP = {
  count: 1,
  name: ['WLM'],
  otherNames: [['Wolf-Lundmark-Melotte']],
  raDeg: [0.4924],
  decDeg: [-15.4609],
  distancePc: [932830],
} as unknown as LocalGroupCatalog;

const EVCC_COLUMNS = ['EVCC', 'VCC', 'NGC', 'RAJ2000', 'DEJ2000', 'cz', 'cz2', 'MmI', 'MTyp1', 'gmag', 'rmag', 'R50'];
const EVCC = parseAsuTsv(
  asu(EVCC_COLUMNS, [
    // M87, with Mei et al.'s SBF distance.
    [' 786', '1316', '4486 ', '187.7058', '+12.3911', '1284.0', '1307.0', 'M', 'E       ', '9.56', '8.82', ' 59.94'],
    // A dwarf in cluster A with no distance of its own.
    ['1000', '1500', '     ', '187.9000', '+12.0000', ' 900.0', '      ', 'M', 'dE(N)   ', '15.60', '15.00', '  9.00'],
    // UGC 7584, which the UNGC holds: left out, and a calibrator.
    [' 900', '1504', '     ', '187.0120', '+22.5884', ' 600.0', '      ', 'M', 'Irr(LSB)', '15.70', '15.30', ' 12.40'],
    // A possible member: left out.
    ['2001', '    ', '     ', '183.0000', '+13.4000', '2100.0', '      ', 'P', 'Sc      ', '14.00', '13.50', ' 20.00'],
  ]),
);
const MEI = parseAsuTsv(
  asu(
    ['VCC', 'm-M', 'e_m-M'],
    [
      ['1316', '31.18', ' 0.07'],
      ['1535', '     ', '     '],
    ],
  ),
);

describe('VizieR ASU answers', () => {
  it('reads each row by its column, blank where not measured', () => {
    expect(UNGC).toHaveLength(9);
    expect(UNGC[0]!['Name']).toBe('WLM');
    expect(asuNumber(UNGC[0]!, 'Dist')).toBe(0.97);
    expect(asuNumber(UNGC[0]!, 'l_MHI')).toBeNull();
  });

  it("throws on VizieR's in-band error, a missing column, or no table", () => {
    expect(() => parseAsuTsv('#INFO\tError=Table or Catalog not found: J/X/1/2\t\n')).toThrow(/not found/);
    expect(() => parseAsuTsv(asu(['Name'], [['x']]), ['Dist'])).toThrow(/no column "Dist"/);
    expect(() => parseAsuTsv('<html>404 Not Found</html>')).toThrow(/no table/);
  });
});

describe('HyperLEDA', () => {
  const csv = [
    '# Query Description',
    '#-------;---',
    'objname;pgc;objtype;al2000;de2000;pa;logr25;logd25;incl',
    '#-------;---',
    'NGC3031;28630;G ;9.9258;69.0653;157;0.283;2.33;62',
    'PGC999;999;G ;9.92585;69.0660;12;0.5;0.8;80',
    'STAR1;1;S ;9.9258;69.0654;;;;',
    '#-- end of data table --',
  ].join('\n');

  it('reads its CSV, and refuses an error', () => {
    const objects = parseLedaCsv(csv);
    expect(objects).toHaveLength(3);
    expect(objects[0]!.raDeg).toBeCloseTo(148.887, 3);
    expect(objects[2]!.positionAngleDeg).toBeNull();
    expect(() => parseLedaCsv('Internal database error (565)')).toThrow(/refused/);
  });

  it('takes the nearest galaxy of the right size, never a small one beside it', () => {
    const objects = parseLedaCsv(csv);
    const m81 = matchLeda({ raDeg: 148.8882, decDeg: 69.0653, sizeArcmin: 26.9 }, objects);
    expect(m81?.pgc).toBe(28630);
    expect(m81?.positionAngleDeg).toBe(157);
    expect(m81?.axisRatio).toBeCloseTo(10 ** -0.283, 6);
    // A dwarf of 0.3' 2.5" from M81's centre: HyperLEDA's M81 is far too big to be it; the
    // small galaxy at the dwarf's place is of its size, so it is taken.
    const dwarf = matchLeda({ raDeg: 148.88775, decDeg: 69.066, sizeArcmin: 0.3 }, objects);
    expect(dwarf?.pgc).toBe(999);
    expect(matchLeda({ raDeg: 10, decDeg: 10, sizeArcmin: 1 }, objects)).toBeNull();
  });

  it('asks for a box about each galaxy, split where it crosses 0h', () => {
    const clause = boxClause([{ raDeg: 0.001, decDeg: 0, sizeArcmin: null }]);
    expect(clause).toMatch(/al2000 >= 23\.99\d+ or al2000 <= 0\.00\d+/);
  });
});

describe('names', () => {
  it("spaces the UNGC's, Messier's first", () => {
    expect(ungcName('NGC0253')).toEqual({ name: 'NGC 253', otherNames: ['Sculptor Galaxy'] });
    expect(ungcName('MESSIER081')).toEqual({ name: 'M81', otherNames: ['NGC 3031', "Bode's Galaxy"] });
    expect(ungcName('NGC5236').name).toBe('M83');
    expect(ungcName('UGCA086').name).toBe('UGCA 86');
    expect(ungcName('ESO409-015').name).toBe('ESO 409-015');
    expect(ungcName('KK13').name).toBe('KK 13');
    expect(ungcName('MRK0036').name).toBe('Mrk 36');
    expect(ungcName('VCC0114').name).toBe('VCC 114');
    expect(ungcName('HolmII').name).toBe('Holmberg II');
    expect(ungcName('[CKT2009]d0926+70').name).toBe('d0926+70');
    expect(ungcName('And XVIII').name).toBe('And XVIII');
  });

  it("names an EVCC galaxy by NGC (or Messier), VCC, else EVCC", () => {
    expect(evccName(786, 1316, '4486')).toEqual({ name: 'M87', otherNames: ['NGC 4486', 'Virgo A', 'VCC 1316', 'EVCC 786'] });
    expect(evccName(3, null, '3810')).toEqual({ name: 'NGC 3810', otherNames: ['EVCC 3'] });
    expect(evccName(1000, 1500, '')).toEqual({ name: 'VCC 1500', otherNames: ['EVCC 1000'] });
    expect(evccName(2001, null, '')).toEqual({ name: 'EVCC 2001', otherNames: [] });
  });
});

describe('colour and size where not measured', () => {
  it('gives B-V by dwarf class, else by T type between the templates', () => {
    expect(templateColour(-3, 'Sph')).toBe(0.72);
    expect(templateColour(10, 'Ir')).toBe(0.47);
    expect(templateColour(-1, 'Tr')).toBe(0.59);
    expect(templateColour(-5, '')).toBe(0.96);
    expect(templateColour(3, '')).toBeCloseTo((0.78 + 0.57) / 2, 6);
    expect(templateColour(11, '')).toBe(0.47);
    expect(templateColour(null, '')).toBeNull();
  });

  it("turns SDSS g and r into Johnson V and B-V by Jester et al.'s relations", () => {
    const { v, bv } = johnsonFromSdss(10, 9.3);
    expect(v).toBeCloseTo(10 - 0.59 * 0.7 - 0.01, 6);
    expect(bv).toBeCloseTo(0.98 * 0.7 + 0.22, 6);
  });

  it('knows what a disc shows of its half-light radius in circles', () => {
    expect(circularHalfLightFraction(1)).toBeCloseTo(1, 3);
    expect(circularHalfLightFraction(0.5)).toBeCloseTo(0.744, 2);
    // Edge on, far from sqrt(q): a line of light still holds half within a finite circle.
    expect(circularHalfLightFraction(0.1)).toBeCloseTo(0.57, 2);
  });

  it('calibrates the half-light radius on the Holmberg radius by the median, and refuses too few', () => {
    const calibrators = [0.3, 0.4, 0.5, 0.5, 0.55, 0.6, 0.6, 0.7, 0.8, 0.9, 1.0].map((r, i) => ({ name: `g${i}`, holmbergRadiusArcmin: 1, halfLightArcmin: r }));
    expect(holmbergHalfLightRatio(calibrators).ratio).toBe(0.6);
    expect(() => holmbergHalfLightRatio(calibrators.slice(0, 5))).toThrow(/Only 5/);
  });
});

describe("Virgo's depth", () => {
  it('finds the substructure, the smaller one where two overlap, by position and velocity', () => {
    expect(virgoSubstructure(187.7, 12.4, 1300)?.name).toBe('Virgo A');
    expect(virgoSubstructure(187.44, 8.1, 1000)?.name).toBe('Virgo B');
    expect(virgoSubstructure(185.0, 5.8, 2200)?.name).toBe('Virgo W');
    // At the W cloud's place, but at the cluster's velocity: not in it.
    expect(virgoSubstructure(185.0, 5.8, 900)).toBeNull();
    // Inside cluster A's circle and the Low Velocity Cloud's, slow: the smaller, the LVC.
    expect(virgoSubstructure(185.28, 13.05, 200)?.name).toBe('Virgo LVC');
    expect(virgoSubstructure(185.28, 13.05, 1200)?.name).toBe('Virgo A');
  });

  it('places each the same way every run, and spreads cluster A by the measured depth', () => {
    expect(virgoPlacement('VCC 1500', 187.9, 12, 900)).toEqual(virgoPlacement('VCC 1500', 187.9, 12, 900));
    const distances = Array.from({ length: 4000 }, (_, i) => virgoPlacement(`VCC ${i}`, 187.9, 12, 900).distanceMpc);
    const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
    const rms = Math.sqrt(distances.reduce((a, b) => a + (b - mean) ** 2, 0) / distances.length);
    expect(mean).toBeCloseTo(16.7, 1);
    expect(rms).toBeGreaterThan(0.55);
    expect(rms).toBeLessThan(0.65);
  });

  it('spreads the outskirts deeper the farther out, within the zero-velocity radius', () => {
    // 10 degrees from M87: 2.9 Mpc projected.
    const far = Array.from({ length: 2000 }, (_, i) => virgoPlacement(`EVCC ${i}`, 187.7, 2.4, 1000));
    expect(far[0]!.group).toBe('Virgo');
    expect(far[0]!.sigmaMpc).toBeCloseTo(Math.sqrt(0.36 + (16.5 * ((10 * Math.PI) / 180)) ** 2 / 2), 1);
    const offsets = far.map((p) => p.distanceMpc - 16.5);
    // sqrt(7.2^2 - 2.87^2): no farther from M87 than its zero-velocity radius.
    expect(Math.max(...offsets.map(Math.abs))).toBeLessThanOrEqual(6.61);
    expect(Math.sqrt(offsets.reduce((a, b) => a + b * b, 0) / offsets.length)).toBeGreaterThan(1.5);
  });
});

describe("the UNGC's groups", () => {
  it('names a group for its most luminous member, through the chain of disturbers', () => {
    const groups = ungcGroups(UNGC);
    expect(groups.get('MESSIER081')).toBe('M81');
    expect(groups.get('MESSIER082')).toBe('M81');
    expect(groups.get('KDG061')).toBe('M81');
    // NGC 253 is no one's member, but heads NGC 247's group.
    expect(groups.get('NGC0253')).toBe('NGC 253');
    expect(groups.get('NGC0247')).toBe('NGC 253');
    // Bound to a disturber the UNGC does not hold.
    expect(groups.get('UGC07584')).toBe('NGC 4565');
  });
});

describe('the Local Volume', () => {
  const ungc = selectUngc(UNGC, DISTANCES, LOCAL_GROUP);
  const evcc = selectEvcc(EVCC, MEI, ungc.galaxies, LOCAL_GROUP);

  it("leaves out McConnachie's galaxies, the app's own, and the EVCC's twins and possible members", () => {
    expect(ungc.inLocalGroup).toEqual(['WLM']);
    expect(ungc.drawnByTheApp).toEqual(['MESSIER031']);
    expect(ungc.galaxies.map((g) => g.name)).toEqual(['M81', 'M82', 'KDG 61', 'NGC 253', 'NGC 247', 'UGC 7584', 'M51']);
    expect(evcc.possibleMembers).toBe(1);
    expect(evcc.inUngc).toEqual(['VCC 1504 = UGC 7584']);
    expect(evcc.calibrators).toHaveLength(1);
    expect(evcc.galaxies.map((g) => g.name)).toEqual(['M87', 'VCC 1500']);
  });

  it('places each at its measured distance, or says it is estimated', () => {
    const m81 = ungc.galaxies[0]!;
    expect(m81.distancePc).toBeCloseTo(10 ** (1 + 27.8 / 5), 3);
    expect(m81.distanceErrorPc).toBeCloseTo(m81.distancePc * (Math.LN10 / 5) * 0.08, 3);
    expect(m81.distanceEstimated).toBe(false);
    // KDG 61's table6 modulus is by another method: the catalogue's adopted distance.
    expect(ungc.galaxies[2]!.distancePc).toBeCloseTo(3.66e6, 0);
    expect(ungc.galaxies[2]!.distanceErrorPc).toBeNull();
    expect(ungc.galaxies[2]!.logHiMassSun).toBeNull();
    expect(ungc.galaxies[6]!.distanceErrorPc).toBeNull();
    const [m87, dwarf] = evcc.galaxies;
    expect(m87!.distanceMethod).toBe('SBF');
    expect(m87!.distancePc).toBeCloseTo(10 ** (1 + 31.18 / 5), 3);
    expect(dwarf!.distanceMethod).toBe('cluster');
    expect(dwarf!.distanceEstimated).toBe(true);
    expect(dwarf!.group).toBe('Virgo A');
    expect(dwarf!.distanceErrorPc).toBeCloseTo(0.6e6, 0);
  });

  it('gives V corrected for the dust in front, and a colour, measured or by type', () => {
    const m81 = ungc.galaxies[0]!;
    expect(m81.vMag).toBeCloseTo(7.89 - 0.29 - templateColour(3, '')!, 6);
    expect(m81.colourEstimated).toBe(true);
    expect(evcc.galaxies[0]!.vMag).toBeCloseTo(9.56 - 0.59 * (9.56 - 8.82) - 0.01, 6);
    expect(evcc.galaxies[0]!.colourEstimated).toBe(false);
  });

  it('writes the catalogue in the scene frame, sizes major-axis, orientations where HyperLEDA has them', () => {
    const ungcGalaxies = withHolmbergHalfLight(ungc.galaxies, 0.5);
    const leda = { pgc: 1, name: 'x', separationArcmin: 0, positionAngleDeg: 40, axisRatio: 0.5, inclinationDeg: 60 };
    const catalog = buildLocalVolume({
      ungc: ungcGalaxies,
      evcc: evcc.galaxies,
      ledaUngc: ungcGalaxies.map((_, i) => (i === 0 ? leda : null)),
      ledaEvcc: [leda, null],
      sources: { ungc: { url: 'u', queriedAt: 't' } },
    });
    expect(catalog.count).toBe(9);
    expect(catalog.sample.filter((s) => s === 'evcc')).toHaveLength(2);
    for (let i = 0; i < catalog.count; i += 1) {
      expect(Math.hypot(catalog.x[i]!, catalog.y[i]!, catalog.z[i]!) / catalog.distancePc[i]!).toBeCloseTo(1, 4);
    }
    // M81: the UNGC's own axis ratio, HyperLEDA's position angle; half-light 0.5 of the Holmberg radius.
    expect(catalog.axisRatio[0]).toBe(0.52);
    expect(catalog.positionAngleDeg[0]).toBe(40);
    expect(catalog.halfLightArcmin[0]).toBeCloseTo(0.5 * 13.46, 2);
    expect(catalog.positionAngleDeg[1]).toBeNull();
    // M87: HyperLEDA's axis ratio, and R50 (circular) made major-axis.
    const m87 = catalog.name.indexOf('M87');
    expect(catalog.axisRatio[m87]).toBe(0.5);
    expect(catalog.halfLightArcmin[m87]).toBeCloseTo(59.94 / 60 / circularHalfLightFraction(0.5), 3);
    expect(catalog.halfLightEstimated[m87]).toBe(false);
    // VCC 1500: no HyperLEDA match, so its R50 is left circular and it has no orientation.
    expect(catalog.halfLightArcmin[m87 + 1]).toBeCloseTo(9 / 60, 3);
    expect(catalog.axisRatio[m87 + 1]).toBeNull();
    expect(catalog.group[0]).toBe('M81');
  });
});
