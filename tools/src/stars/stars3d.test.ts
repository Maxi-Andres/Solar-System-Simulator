import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { STAR3D_FLAGS, STAR3D_RECORD_FLOATS } from '../types.ts';
import {
  absoluteMagnitude,
  build3d,
  OVERRIDES,
  skyCounterpartFilter,
  tierDetailsBytes,
  tierRecordBytes,
  toScene,
  type Stars3dBuild,
} from './build3d.ts';
import { parseBsc } from './bsc.ts';
import { buildSky } from './buildStarCatalog.ts';
import { parseBscName, parseGreekDesignation, shortForms, spelledOut } from './designations.ts';
import { buildNames } from './names3d.ts';
import { DWARF_SEQUENCE, johnsonFromGaia } from './photometry.ts';
import {
  gcnsGaiaArchivePages,
  gcnsVizierPages,
  parseBrightGaiaCsv,
  parseGcnsCsv,
  parseHipparcos2Csv,
  type BrightGaiaRow,
} from './sources3d.ts';
import { gaiaSourceIdPages } from './tap.ts';
import { gaiaArchiveHipparcosQuery, parseHipparcosCsv } from './vizier.ts';

/**
 * The 3D stars, against real rows.
 *
 * Every fixture is a verbatim excerpt of what the services returned on 2026-10-22 --
 * the GCNS joined to DR3 on the ESA Gaia Archive, the bright Gaia set, the Hipparcos
 * new reduction, Hipparcos 1997 and the Bright Star Catalogue -- trimmed to the stars
 * the claims below are about: the Sun's nearest neighbours, Sirius, Vega, Betelgeuse,
 * 61 Cygni, 70 Ophiuchi. So the distances checked are the published ones, not numbers
 * these tests made up.
 */

const FIXTURES = join(import.meta.dirname, '__fixtures__');
const fixture = (name: string): string => readFileSync(join(FIXTURES, name), 'utf8');

const sky = buildSky({
  hipparcos: parseHipparcosCsv(fixture('hipparcos.csv')),
  tycho2: [],
  queriedAt: '2026-10-22T00:00:00Z',
});
const gcns = parseGcnsCsv(fixture('gcns.csv'));
const hipparcos2 = parseHipparcos2Csv(fixture('hipparcos2.csv'));
const bright = parseBrightGaiaCsv(fixture('bright-gaia.csv'));

function build(brightGaia: readonly BrightGaiaRow[] | null = bright): Stars3dBuild {
  return build3d({ sky, gcns, hipparcos2, brightGaia, sources: [], queriedAt: 'test' });
}

const built = build();

/** The table index of the star with this HIP number or Gaia id. */
function find(result: Stars3dBuild, id: { hip?: number; gaia?: string }): number {
  const { table } = result;
  for (let k = 0; k < table.count; k += 1) {
    if (id.hip !== undefined && table.hip[k] === id.hip) {
      return k;
    }
    if (id.gaia !== undefined && table.gaiaId[k] === BigInt(id.gaia)) {
      return k;
    }
  }
  return -1;
}

function distancePc(result: Stars3dBuild, k: number): number {
  const { table } = result;
  return Math.hypot(table.x[k]!, table.y[k]!, table.z[k]!);
}

const PROXIMA = '5853498713190525696';
const BARNARD = '4472832130942575872';
const CYG_A = '1872046609345556480';

describe('the distances, against the published ones', () => {
  it('puts the nearest stars where everyone else does', () => {
    // Gaia DR3 for Proxima and Barnard's Star; Hipparcos-2 for Sirius and Vega, which
    // Gaia saturates on; Kervella et al. 2016 for Alpha Centauri A and B.
    const expected: [{ hip?: number; gaia?: string }, number][] = [
      [{ gaia: PROXIMA }, 1.302],
      [{ hip: 71683 }, 1.338],
      [{ hip: 71681 }, 1.338],
      [{ gaia: BARNARD }, 1.828],
      [{ hip: 32349 }, 2.637],
      [{ hip: 91262 }, 7.679],
    ];
    for (const [id, pc] of expected) {
      const k = find(built, id);
      expect(k, JSON.stringify(id)).toBeGreaterThanOrEqual(0);
      expect(distancePc(built, k)).toBeCloseTo(pc, 3);
    }
  });

  it('gives Betelgeuse, far beyond 100 pc, its Hipparcos distance rather than none', () => {
    const k = find(built, { hip: 27989 });
    expect(built.table.flags[k]! & STAR3D_FLAGS.HIPPARCOS_PARALLAX).toBeTruthy();
    // 6.55 +/- 0.83 mas: S/N 7.9, over the threshold, and 153 pc.
    expect(distancePc(built, k)).toBeCloseTo(1000 / 6.55, 2);
  });

  it('takes one published parallax for Alpha Centauri A and B, not two that disagree', () => {
    const a = find(built, { hip: 71683 });
    const b = find(built, { hip: 71681 });
    for (const k of [a, b]) {
      expect(built.table.flags[k]! & STAR3D_FLAGS.LITERATURE_PARALLAX).toBeTruthy();
      expect(built.table.parallaxMas[k]).toBe(747.17);
    }
    expect(OVERRIDES.map((entry) => entry.hip)).toEqual([71683, 71681]);
  });

  it('prefers the smaller error when Gaia and Hipparcos both qualify', () => {
    // 61 Cygni A: Gaia 285.995 +/- 0.060 against Hipparcos-2's +/- 0.59 or so.
    const k = find(built, { gaia: CYG_A });
    expect(built.table.flags[k]! & STAR3D_FLAGS.HIPPARCOS_PARALLAX).toBe(0);
    expect(built.table.parallaxErrorMas[k]).toBeCloseTo(0.0599, 4);
  });

  it('drops a census star whose parallax is under S/N 5, and one with no colour', () => {
    expect(built.info.dropped.gcnsParallaxBelowSnr).toBe(1);
    expect(built.info.dropped.gcnsNoColour).toBe(1);
  });

  it('computes absolute magnitude so the Sun sees the apparent V again', () => {
    const k = find(built, { hip: 32349 });
    const d = distancePc(built, k);
    expect(built.table.absMag[k]! + 5 * Math.log10(d) - 5).toBeCloseTo(-1.44, 4);
    expect(absoluteMagnitude(0, 100)).toBe(0);
  });
});

describe('each star once', () => {
  it('does not add a census star the sky already holds', () => {
    let copies = 0;
    for (let k = 0; k < built.table.count; k += 1) {
      copies += built.table.gaiaId[k] === BigInt(CYG_A) ? 1 : 0;
    }
    expect(copies).toBe(1);
    expect(built.table.sky[find(built, { gaia: CYG_A })]).toBeGreaterThanOrEqual(0);
  });

  it("drops a resolved component of a sky entry, so 70 Oph's light is not drawn twice", () => {
    // Hipparcos holds 70 Ophiuchi as one star, V 4.03 at the pair's photocentre; Gaia
    // has A and B 5" apart, both brighter than V 8.
    expect(built.info.dropped.gcnsComponentOfSkyEntry).toBe(2);
    expect(find(built, { gaia: '4468557611984384512' })).toBe(-1);
    expect(find(built, { hip: 88601 })).toBeGreaterThanOrEqual(0);
  });

  it('keeps the sky rows and the census apart in the counts', () => {
    expect(built.info.sky.placed + built.info.sky.atInfinity).toBe(sky.catalog.count);
    // HIP 55203 has no parallax in the trimmed Hipparcos-2 fixture: it stays at infinity.
    expect(built.info.sky.atInfinity).toBe(1);
  });

  it('matches by position when no cross-match identifier is there', () => {
    // The same rows with the HIP column blank, as VizieR returns them.
    const anonymous = bright.map((row) => ({ ...row, hip: 0 }));
    const result = build(anonymous);
    expect(result.info.crossMatch.byId).toBe(0);
    expect(result.info.crossMatch.byPosition).toBeGreaterThanOrEqual(2);
    const k = find(result, { gaia: CYG_A });
    expect(result.table.sky[k]).toBeGreaterThanOrEqual(0);
  });

  it('falls back to the census when the bright set could not be read', () => {
    const result = build(null);
    const k = find(result, { gaia: CYG_A });
    expect(result.table.sky[k]).toBeGreaterThanOrEqual(0);
    expect(result.table.flags[k]! & STAR3D_FLAGS.GCNS).toBeTruthy();
  });

  it('keeps only the bright rows that could be a sky star', () => {
    const keep = skyCounterpartFilter(sky);
    // Proxima and Barnard's are not in this sky (V > 8); 61 Cygni is.
    expect(bright.filter(keep).map((row) => row.sourceId)).toContain(CYG_A);
    expect(bright.filter(keep).map((row) => row.sourceId)).not.toContain(PROXIMA);
  });
});

describe('the frame and the motion', () => {
  it("keeps a sky star's direction exactly as stars.json has it", () => {
    const k = find(built, { hip: 32349 });
    const row = built.table.sky[k]!;
    const ra = (sky.catalog.ra[row]! * Math.PI) / 180;
    const dec = (sky.catalog.dec[row]! * Math.PI) / 180;
    const expected = toScene([
      Math.cos(dec) * Math.cos(ra),
      Math.cos(dec) * Math.sin(ra),
      Math.sin(dec),
    ]);
    const d = distancePc(built, k);
    expect(built.table.x[k]! / d).toBeCloseTo(expected[0], 12);
    expect(built.table.y[k]! / d).toBeCloseTo(expected[1], 12);
    expect(built.table.z[k]! / d).toBeCloseTo(expected[2], 12);
  });

  it('rotates by the IAU 1976 obliquity: the ecliptic pole becomes +z', () => {
    // The north ecliptic pole is at RA 18h, Dec 90 - 23.4392911 degrees.
    const dec = ((90 - 84381.448 / 3600) * Math.PI) / 180;
    const pole = toScene([0, -Math.cos(dec), Math.sin(dec)]);
    expect(pole[2]).toBeCloseTo(1, 12);
  });

  it("gives Barnard's Star its measured space motion", () => {
    const k = find(built, { gaia: BARNARD });
    const { table } = built;
    const d = distancePc(built, k);
    const radial = (table.x[k]! * table.vx[k]! + table.y[k]! * table.vy[k]! + table.z[k]! * table.vz[k]!) / d;
    expect(radial).toBeCloseTo(-110.468, 2);
    // Total 142.5 km/s: 110.5 towards us and 90 across, from 10.39"/yr at 1.83 pc.
    expect(Math.hypot(table.vx[k]!, table.vy[k]!, table.vz[k]!)).toBeCloseTo(142.5, 0);
    expect(table.flags[k]! & STAR3D_FLAGS.RADIAL_VELOCITY).toBeTruthy();
  });

  it('leaves the radial part at zero, and unflagged, where Gaia measured none', () => {
    const k = find(built, { hip: 32349 });
    const { table } = built;
    const d = distancePc(built, k);
    const radial = (table.x[k]! * table.vx[k]! + table.y[k]! * table.vy[k]! + table.z[k]! * table.vz[k]!) / d;
    expect(Math.abs(radial)).toBeLessThan(1e-9);
    expect(table.flags[k]! & STAR3D_FLAGS.RADIAL_VELOCITY).toBe(0);
  });
});

describe('the files', () => {
  it('writes records little-endian, ten floats a star, in Mv order', () => {
    const indices = built.order;
    const bytes = tierRecordBytes(built.table, indices);
    expect(bytes.length).toBe(indices.length * STAR3D_RECORD_FLOATS * 4);
    const view = new DataView(bytes.buffer);
    let previous = -Infinity;
    for (let i = 0; i < indices.length; i += 1) {
      const mv = view.getFloat32((i * STAR3D_RECORD_FLOATS + 6) * 4, true);
      expect(mv).toBeGreaterThanOrEqual(previous);
      previous = mv;
    }
    const first = indices[0]!;
    expect(view.getFloat32(0, true)).toBeCloseTo(built.table.x[first]!, 4);
  });

  it('writes the 64-bit Gaia ids whole', () => {
    const k = find(built, { gaia: PROXIMA });
    const bytes = tierDetailsBytes(built.table, new Uint32Array([k]));
    const view = new DataView(bytes.buffer);
    expect(view.getBigUint64(0, true)).toBe(BigInt(PROXIMA));
    expect(view.getUint32(8, true)).toBe(70890);
    expect(view.getFloat32(12, true)).toBeCloseTo(768.0665, 3);
  });

  it('splits the tiers at the Mv limits, every star in exactly one', () => {
    const total = built.info.tiers.reduce((sum, tier) => sum + tier.count, 0);
    expect(total).toBe(built.table.count);
    expect(built.tierStarts[0]).toBe(0);
  });
});

describe('the names', () => {
  const bsc = parseBsc(fixture('bsc-catalog.dat'));
  const { names, nearbyUnmatched } = buildNames({ build: built, sky, bsc });
  const entry = (display: string): number => names.display.indexOf(display);

  it("shows the IAU's name and keeps every other as a designation", () => {
    const k = entry('Sirius');
    expect(names.iau[k]).toBe(true);
    expect(names.designations[k]).toEqual(
      expect.arrayContaining(['Alpha Canis Majoris', 'alf CMa', 'HR 2491', 'HD 48915', 'HIP 32349']),
    );
    expect(names.system[k]).toBe('Sirius');
  });

  it('names the nearest systems and ranks them by distance', () => {
    const proxima = entry('Proxima Centauri');
    expect(names.system[proxima]).toBe('Alpha Centauri');
    expect(names.nearest[proxima]).toBe(1);
    expect(names.nearest[entry('Rigil Kentaurus')]).toBe(1);
    expect(names.designations[entry('Rigil Kentaurus')]).toContain('Alpha Centauri A');
    expect(names.nearest[entry("Barnard's Star")]).toBe(2);
  });

  it('tells 61 Cygni A from B, which the Bright Star Catalogue does not', () => {
    const a = entry('61 Cygni A');
    expect(a).toBeGreaterThanOrEqual(0);
    expect(names.designations[a]).toContain('61 Cygni');
    expect(names.system[a]).toBe('61 Cygni');
    expect(entry('61 Cygni B')).toBeGreaterThanOrEqual(0);
  });

  it('points each name at its own record', () => {
    const k = entry("Barnard's Star");
    const position = built.tierStarts[names.tier[k]!]! + names.index[k]!;
    expect(built.table.gaiaId[built.order[position]!]).toBe(BigInt(BARNARD));
  });

  it('orders the index by apparent brightness', () => {
    expect(names.display[0]).toBe('Sirius');
  });

  it('reports the nearby stars it could not find, here the ones the fixture lacks', () => {
    expect(nearbyUnmatched).toContain('Wolf 1061');
    expect(nearbyUnmatched).not.toContain('Proxima Centauri');
  });
});

describe('the readers', () => {
  it('reads a census page, NaN for what is missing', () => {
    const proxima = [...gcns.sourceId].indexOf(BigInt(PROXIMA));
    expect(gcns.parallaxMas[proxima]).toBeCloseTo(768.0665, 4);
    expect(gcns.dist50Pc[proxima]).toBeCloseTo(1.302, 3);
    expect(gcns.hip[proxima]).toBe(70890);
    expect([...gcns.bp].some((value) => Number.isNaN(value))).toBe(true);
  });

  it('keeps a source the cross-match join returned twice once', () => {
    const csv = fixture('gcns.csv');
    const lines = csv.trimEnd().split('\n');
    const doubled = parseGcnsCsv(`${[...lines, lines[1]].join('\n')}\n`);
    expect(doubled.count).toBe(gcns.count);
  });

  it('pages Gaia by source_id into twelve ranges that tile the id space', () => {
    const pages = gaiaSourceIdPages('source_id');
    expect(pages).toHaveLength(12);
    const id = BigInt(PROXIMA);
    const containing = pages.filter((page) => {
      const [, low, high] = /(\d+) AND source_id < (\d+)/.exec(page)!;
      return id >= BigInt(low!) && id < BigInt(high!);
    });
    expect(containing).toHaveLength(1);
    expect(pages[0]).toContain('source_id >= 0 AND');
    expect(pages[11]).toContain(`< ${12n << 59n}`);
  });

  it('asks both services for the same columns under the same names', () => {
    for (const page of [gcnsGaiaArchivePages()[0]!, gcnsVizierPages()[0]!]) {
      for (const column of ['"source_id"', '"parallax"', '"bp"', '"dist_50"']) {
        expect(page).toContain(column);
      }
    }
    expect(gaiaArchiveHipparcosQuery(8)).toContain('b_v AS "B-V"');
    // VizieR matches names without regard to case, and the GCNS table there also has the
    // Gunn "gmag": unquoted, Gmag is ambiguous and the query is refused (seen 2026-10-24).
    expect(gcnsVizierPages()[0]).toContain('"Gmag" AS "g"');
    expect(gcnsVizierPages()[0]).toContain('RA_ICRS AS "ra"');
  });
});

describe('Gaia photometry to Johnson', () => {
  it('lands on the table at its own rows: a G2V dwarf', () => {
    const g2v = DWARF_SEQUENCE.find(([bpRp]) => bpRp === 0.823)!;
    const { v, bv, clamped } = johnsonFromGaia(5, 0.823);
    expect(bv).toBeCloseTo(g2v[1], 10);
    expect(v).toBeCloseTo(5 + 0.165, 10);
    expect(clamped).toBe(false);
  });

  it('rises monotonically, so interpolating in it is defined', () => {
    for (let i = 1; i < DWARF_SEQUENCE.length; i += 1) {
      expect(DWARF_SEQUENCE[i]![0]).toBeGreaterThan(DWARF_SEQUENCE[i - 1]![0]);
    }
  });

  it('says when a colour is past the end of the sequence', () => {
    expect(johnsonFromGaia(10, -0.4).clamped).toBe(true);
    expect(johnsonFromGaia(10, 6).bv).toBe(2.16);
  });
});

describe('designations', () => {
  it('reads the Bright Star Catalogue name field', () => {
    const sirius = parseBscName('  9Alp CMa')!;
    expect(spelledOut(sirius)).toBe('Alpha Canis Majoris');
    expect(shortForms(sirius)).toEqual(['alf CMa', '9 CMa']);
    const rigil = parseBscName('   Alp1Cen')!;
    expect(spelledOut(rigil)).toBe('Alpha1 Centauri');
    expect(shortForms(rigil)).toEqual(['alf01 Cen']);
    expect(spelledOut(parseBscName(' 61    Cyg')!)).toBe('61 Cygni');
    expect(parseBscName('          ')).toBeNull();
  });

  it("reads the IAU list's Greek form", () => {
    expect(spelledOut(parseGreekDesignation('θ1 Eri')!)).toBe('Theta1 Eridani');
    expect(spelledOut(parseGreekDesignation('80 UMa')!)).toBe('80 Ursae Majoris');
    expect(spelledOut(parseGreekDesignation('ν2 Draconis')!)).toBe('Nu2 Draconis');
  });

  it('parses the real catalogue lines', () => {
    const stars = parseBsc(fixture('bsc-catalog.dat'));
    expect(stars).toHaveLength(12);
    const sirius = stars.find((star) => star.hr === 2491)!;
    expect(sirius.hd).toBe(48915);
    expect(sirius.spectralType).toBe('A1Vm');
  });
});
