import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { STAR3D_RECORD_FLOATS } from '../types.ts';
import { ARCHIVE_COLUMNS, archiveQuery, decodeEntities, parseArchiveCsv, referenceText } from './archive.ts';
import {
  archivePlacement,
  buildExoplanets,
  hipNumber,
  matchHost,
  omegaConvention,
  starLookup,
  type Star3dIds,
} from './buildExoplanets.ts';

/**
 * The Archive's planets against real rows: __fixtures__/pscomppars.csv is a verbatim
 * excerpt of what its TAP service answered to archiveQuery() on 2026-10-29 -- TRAPPIST-1's
 * seven, HD 219134's six (two transiting, two flagged controversial), tau Ceti's three
 * (all flagged), HD 80606 b (e = 0.93), Proxima's two, 51 Pegasi b, Kepler-452 b, HR 8799's
 * four imaged planets, two microlensing planets with no period, and DMPP-3 A b, whose host
 * has a HIP number and no Gaia id.
 */

const rows = parseArchiveCsv(readFileSync(join(import.meta.dirname, '__fixtures__', 'pscomppars.csv'), 'utf8'));
const byName = (name: string) => rows.find((row) => row.name === name)!;

describe('reading the Archive', () => {
  it('asks for every column it reads, in one ordered query', () => {
    const query = archiveQuery();
    for (const column of ARCHIVE_COLUMNS) {
      expect(query).toContain(column);
    }
    expect(query).toMatch(/FROM pscomppars ORDER BY hostname, pl_name$/);
  });

  it('reads every row', () => {
    expect(rows).toHaveLength(28);
    expect(rows.filter((row) => row.hostname === 'TRAPPIST-1')).toHaveLength(7);
  });

  it('turns reference links into the words they show, accents and all', () => {
    expect(byName('TRAPPIST-1 b').radiusRef).toBe('Agol et al. 2021');
    expect(byName('TRAPPIST-1 b').discoveryRef).toBe('Gillon et al. 2016');
    // Padded with spaces in the Archive's own link.
    expect(byName('51 Peg b').discoveryRef).toBe('Mayor & Queloz 1995');
    expect(byName('Proxima Cen b').periastronRef).toBe('Suárez Mascareño et al. 2025');
    expect(referenceText('')).toBeNull();
    expect(decodeEntities('&#x10D;&#351;&Scaron;&unknown;')).toBe('čşŠ&unknown;');
  });

  it('keeps the ids, the host and its astrometry', () => {
    const b = byName('TRAPPIST-1 b');
    expect(b.gaiaDr3).toBe('2635476908753563008');
    expect(b.hip).toBeNull();
    expect(b.distancePc).toBeCloseTo(12.42988881, 8);
    expect(b.pmRaMasYr).toBe(901);
    expect(b.radiusSun).toBe(0.1192);
    expect(b.massSun).toBe(0.0898);
    expect(byName('DMPP-3 A b').gaiaDr3).toBeNull();
    expect(byName('DMPP-3 A b').hip).toBe('HIP 28941');
  });

  it('flags the controversial and the transiting', () => {
    expect(rows.filter((row) => row.controversial).map((row) => row.name).sort()).toEqual([
      'HD 219134 f',
      'HD 219134 g',
      'Kepler-452 b',
      'tau Cet f',
      'tau Cet g',
      'tau Cet h',
    ]);
    expect(byName('HD 219134 b').transits).toBe(true);
    expect(byName('HD 219134 d').transits).toBe(false);
  });

  it('tells a measured radius from the Archive estimate', () => {
    expect(byName('TRAPPIST-1 e').radiusCalculated).toBe(false);
    expect(byName('51 Peg b').radiusCalculated).toBe(true);
  });

  it('turns a value published as a limit into no value, and says so', () => {
    // 51 Peg b: e < 0.0063.
    expect(byName('51 Peg b').eccentricity).toBeNull();
    expect(byName('51 Peg b').eccentricityLimit).toBe(true);
    expect(byName('HD 80606 b').eccentricity).toBe(0.93183);
  });

  it('keeps a microlensing planet with a separation and no period', () => {
    const lens = byName('AT2021ueyL b');
    expect(lens.method).toBe('Microlensing');
    expect(lens.semiMajorAxisAu).toBe(4.01);
  });
});

describe('the argument of periastron', () => {
  it('is the star’s, where one paper’s times can tell: HD 80606 b (Pearson et al. 2022)', () => {
    // Periastron 5.73 days before the transit, e = 0.932: only 90 deg - omega puts the
    // planet in front of the star then.
    expect(omegaConvention(byName('HD 80606 b'))).toBe('star');
  });

  it('cannot be told where the times are another paper’s, or the orbit nearly round', () => {
    expect(omegaConvention(byName('HD 219134 d'))).toBeNull();
    expect(omegaConvention(byName('TRAPPIST-1 b'))).toBeNull();
  });
});

/** A tier of 3D stars with the given ids, each record its index in x so a match can be seen. */
function tierOf(stars: readonly { gaia: bigint; hip: number }[]): Star3dIds['tiers'][number] {
  const records = new Float32Array(stars.length * STAR3D_RECORD_FLOATS);
  stars.forEach((_, i) => {
    records[i * STAR3D_RECORD_FLOATS] = i + 0.5;
  });
  return {
    gaia: BigUint64Array.from(stars, (star) => star.gaia),
    hip: Uint32Array.from(stars, (star) => star.hip),
    records,
  };
}

describe('finding the hosts among the 3D stars', () => {
  const stars: Star3dIds = {
    queriedAt: '2026-10-24T00:00:00Z',
    frame: 'test frame',
    tiers: [
      tierOf([
        { gaia: 0n, hip: 1 },
        // tau Ceti as a sky star with no Gaia counterpart.
        { gaia: 0n, hip: 8102 },
      ]),
      tierOf([
        { gaia: 2635476908753563008n, hip: 0 },
        { gaia: 0n, hip: 28941 },
        // HD 219134 under its HIP number, but another Gaia source.
        { gaia: 1n, hip: 114622 },
      ]),
    ],
  };
  const lookup = starLookup(stars);

  it('by Gaia DR3 id', () => {
    expect(matchHost(byName('TRAPPIST-1 b'), lookup)).toEqual({ tier: 1, index: 0, by: 'gaia' });
  });

  it('by HIP number where the Gaia id is not among them, or there is none', () => {
    expect(matchHost(byName('tau Cet f'), lookup)).toEqual({ tier: 0, index: 1, by: 'hip' });
    expect(matchHost(byName('DMPP-3 A b'), lookup)).toEqual({ tier: 1, index: 1, by: 'hip' });
  });

  it('not by HIP number where the star there is another Gaia source, nor for a B', () => {
    expect(matchHost(byName('HD 219134 b'), lookup)).toBeNull();
    expect(hipNumber('HIP 12345 B')).toBeNull();
    expect(hipNumber('HIP 12345 AB')).toBe(12345);
    expect(hipNumber('HIP 28941 A')).toBe(28941);
  });

  it('places the rest from the Archive, carried back to J2000', () => {
    const kepler = archivePlacement(byName('Kepler-452 b'))!;
    // 551.7 pc; it moves 16 years' worth of a few tens of km/s, a few 1e-4 pc.
    expect(Math.hypot(...kepler.position)).toBeCloseTo(551.727, 2);
    expect(archivePlacement({ ...byName('Kepler-452 b'), distancePc: null })).toBeNull();
  });

  it('writes the catalogue: hosts sorted, planets by period, references once', () => {
    const catalog = buildExoplanets({ rows, queriedAt: 'test', stars });
    const { hosts, planets } = catalog;
    expect(catalog.counts.planets).toBe(28);
    expect(hosts.count).toBe(11);
    expect(catalog.counts.matchedByGaia).toBe(1);
    expect(catalog.counts.matchedByHip).toBe(2);
    expect(catalog.counts.placedFromArchive).toBe(8);
    expect(catalog.stars3dQueriedAt).toBe('2026-10-24T00:00:00Z');
    const trappist = hosts.name.indexOf('TRAPPIST-1');
    expect(hosts.tier[trappist]).toBe(1);
    expect(hosts.index[trappist]).toBe(0);
    // Its own record's position, float for float.
    expect(hosts.x[trappist]).toBe(0.5);
    const first = hosts.firstPlanet[trappist]!;
    expect(hosts.planetCount[trappist]).toBe(7);
    expect(planets.name.slice(first, first + 7)).toEqual(['b', 'c', 'd', 'e', 'f', 'g', 'h'].map((l) => `TRAPPIST-1 ${l}`));
    // Seven radii from the transits, none for 51 Pegasi b's estimate.
    expect(planets.radiusEarth.slice(first, first + 7).every((r) => r !== null)).toBe(true);
    expect(planets.radiusEarth[planets.name.indexOf('51 Peg b')]).toBeNull();
    expect(catalog.references[planets.radiusRef[first]!]).toBe('Agol et al. 2021');
    expect(new Set(catalog.references).size).toBe(catalog.references.length);
    expect(hosts.designations[hosts.name.indexOf('tau Cet')]).toEqual([
      'Gaia DR3 2452378776434477184',
      'HIP 8102',
      'HD 10700',
    ]);
    expect(catalog.omegaCheck).toEqual({ star: 1, planet: 0, neither: 0 });
  });
});
