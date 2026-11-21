import { describe, expect, it } from 'vitest';

import { brightestMagnitude, columnBuffers, loadStarCatalog, parseStarCatalog, withTypedColumns } from './starCatalog.ts';

/** Three stars, as stars.json has them. */
const RAW = {
  sources: [],
  via: 'test',
  queriedAt: '2026-11-21T00:00:00Z',
  epoch: 'ICRS, J2000.0',
  magnitudeLimit: 8,
  count: 3,
  dropped: { noPosition: 0, noColorIndex: 0 },
  ra: [101.287, 95.988, 213.915],
  dec: [-16.716, -52.696, 19.182],
  mag: [-1.44, -0.62, -0.05],
  bv: [0.009, 0.164, 1.239],
  pmRa: [-546.01, 19.93, -1093.39],
  pmDec: [-1223.07, 23.24, -2000.06],
};

describe('the star catalogue', () => {
  it('hands its columns over as Float64Arrays holding the same numbers', () => {
    const typed = withTypedColumns(parseStarCatalog(structuredClone(RAW)));
    for (const column of ['ra', 'dec', 'mag', 'bv', 'pmRa', 'pmDec'] as const) {
      expect(typed[column]).toBeInstanceOf(Float64Array);
      expect([...typed[column]]).toEqual(RAW[column]);
    }
    expect(typed.count).toBe(3);
    expect(typed.magnitudeLimit).toBe(8);
    // One buffer per column, to transfer rather than copy.
    expect(columnBuffers(typed)).toHaveLength(6);
    expect(brightestMagnitude(typed)).toBe(-1.44);
  });

  it('reads the typed columns back as a catalogue, and still checks their lengths', () => {
    const typed = withTypedColumns(parseStarCatalog(structuredClone(RAW)));
    expect(parseStarCatalog(typed)).toBe(typed);
    expect(() => parseStarCatalog({ ...typed, mag: new Float64Array(2) })).toThrow(/has 2 entries but count says 3/);
  });

  it('is read on this thread through the fetcher where there are no workers', async () => {
    const asked: string[] = [];
    const catalog = await loadStarCatalog(async (path) => {
      asked.push(path);
      return structuredClone(RAW);
    }, '/base/');
    expect(asked).toEqual(['/base/data/stars.json']);
    expect(catalog.mag).toEqual(RAW.mag);
  });
});
