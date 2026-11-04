import { describe, expect, it } from 'vitest';

import { buildLocalGroup, displayName, readFitsTable } from './nearbyGalaxies.ts';

/**
 * A FITS file made here, as McConnachie's is made: a primary header with no data, then one
 * binary table -- a name, the centre as text, and big-endian floats, 999 for "not measured".
 */
function fitsFile(rows: readonly (readonly [string, string, string, number, number, number, number])[]): Uint8Array {
  const card = (text: string) => text.padEnd(80, ' ');
  const header = (cards: string[]) => {
    const text = [...cards, 'END'].map(card).join('');
    return text.padEnd(Math.ceil(text.length / 2880) * 2880, ' ');
  };
  const primary = header(['SIMPLE  =                    T', 'BITPIX  =                    8', 'NAXIS   =                    0', 'EXTEND  =                    T']);
  const columns: [string, string][] = [
    ['GalaxyName', '16A'],
    ['RA', '10A'],
    ['Dec', '11A'],
    ['dmod', 'E'],
    ['Vmag', 'E'],
    ['rh', 'E'],
    ['pmra', 'E'],
  ];
  const rowBytes = 16 + 10 + 11 + 4 * 4;
  const table = header([
    "XTENSION= 'BINTABLE'",
    'BITPIX  =                    8',
    'NAXIS   =                    2',
    `NAXIS1  = ${String(rowBytes).padStart(20)}`,
    `NAXIS2  = ${String(rows.length).padStart(20)}`,
    'PCOUNT  =                    0',
    'GCOUNT  =                    1',
    `TFIELDS = ${String(columns.length).padStart(20)}`,
    ...columns.flatMap(([name, form], i) => [`TTYPE${i + 1}  = '${name}'`.slice(0, 80), `TFORM${i + 1}  = '${form}'`]),
  ]);
  const data = new Uint8Array(Math.ceil((rowBytes * rows.length) / 2880) * 2880);
  const view = new DataView(data.buffer);
  rows.forEach((row, r) => {
    let at = r * rowBytes;
    for (const [text, width] of [
      [row[0], 16],
      [row[1], 10],
      [row[2], 11],
    ] as const) {
      data.set(new TextEncoder().encode(text.padEnd(width, ' ')), at);
      at += width;
    }
    for (const value of row.slice(3) as number[]) {
      view.setFloat32(at, value, false);
      at += 4;
    }
  });
  const head = new TextEncoder().encode(primary + table);
  const out = new Uint8Array(head.length + data.length);
  out.set(head);
  out.set(data, head.length);
  return out;
}

describe("McConnachie's catalogue", () => {
  const bytes = fitsFile([
    ['NGC6822', '19:44:56.6', '-14:47:21.0', 23.31, 8.1, 2.65, Number.NaN],
    ['*Tucana3', '23:56:36.0', '-59:36:0.0', 17.01, 14.6, 6, 999],
    ['Leo4', '11:32:57.0', '-0:32:0.0', 20.94, 15.95, 2.61, -0.08],
    ['NoDistance', '0:0:0.0', '0:0:0.0', 999, 999, 999, 999],
  ]);

  it('reads its binary table, a row a galaxy, NaN and 999 kept apart from values', () => {
    const rows = readFitsTable(bytes);
    expect(rows).toHaveLength(4);
    expect(rows[0]!['GalaxyName']).toBe('NGC6822');
    expect(rows[0]!['Dec']).toBe('-14:47:21.0');
    expect(rows[0]!['dmod']).toBeCloseTo(23.31, 5);
    expect(rows[0]!['pmra']).toBeNull();
    expect(rows[1]!['pmra']).toBe(999);
  });

  it('refuses what is not FITS, or is cut short', () => {
    expect(() => readFitsTable(new TextEncoder().encode('<html>Too many processes</html>'))).toThrow(/Not a FITS file/);
    expect(() => readFitsTable(bytes.subarray(0, bytes.length - 2880))).toThrow(/shorter/);
  });

  it('places each at the distance its modulus gives, and leaves out one with none', () => {
    const catalog = buildLocalGroup(readFitsTable(bytes), '2026-11-04T00:00:00Z');
    expect(catalog.count).toBe(3);
    // (m-M)0 = 23.31: 10^(1 + 23.31/5) pc = 459 kpc.
    expect(catalog.distancePc[0]).toBe(459198);
    expect(Math.hypot(catalog.x[0]!, catalog.y[0]!, catalog.z[0]!)).toBeCloseTo(459198, -1);
    // Leo IV's declination is just south of the equator: the sign on "-0" is kept.
    expect(catalog.decDeg[2]).toBeCloseTo(-32 / 60, 4);
    expect(catalog.ambiguous).toEqual([false, true, false]);
    expect(catalog.pmRaMasYr).toEqual([null, null, -0.08]);
    expect(catalog.halfLightArcmin[1]).toBe(6);
  });
});

describe('a galaxy’s name', () => {
  it('is spaced and numbered as the literature numbers it', () => {
    expect(displayName('AndromedaXXI')).toBe('Andromeda XXI');
    expect(displayName('AndromedaI')).toBe('Andromeda I');
    expect(displayName('CanesVenatici(1)')).toBe('Canes Venatici I');
    expect(displayName('CanesVenatici2')).toBe('Canes Venatici II');
    expect(displayName('*Tucana3')).toBe('Tucana III');
    expect(displayName('Bootes4')).toBe('Boötes IV');
    expect(displayName('UrsaMajor(1)')).toBe('Ursa Major I');
    expect(displayName('Segue(1)')).toBe('Segue 1');
    expect(displayName('Willman1')).toBe('Willman 1');
    expect(displayName('LeoA')).toBe('Leo A');
    expect(displayName('Leo1')).toBe('Leo I');
  });

  it('spaces catalogue designations and spells out the rest', () => {
    expect(displayName('NGC6822')).toBe('NGC 6822');
    expect(displayName('UGCA86')).toBe('UGCA 86');
    expect(displayName('KKs3')).toBe('KKs 3');
    expect(displayName('IC1613')).toBe('IC 1613');
    expect(displayName('WLM')).toBe('WLM');
    expect(displayName('M32')).toBe('M32');
    expect(displayName('SagittariusdSph')).toBe('Sagittarius Dwarf Spheroidal');
    expect(displayName('LMC')).toBe('Large Magellanic Cloud');
  });
});
