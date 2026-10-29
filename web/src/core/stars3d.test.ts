import { STAR3D_FLAGS, STAR3D_KM_S_TO_PC_PER_YEAR, STAR3D_RECORD_FLOATS, type Stars3dNames } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import type { BeltFetchers, BinaryFetchOptions } from './belt.ts';
import { makeStore } from './satelliteTestFixtures.ts';
import { addStarBody, isCatalogueStar, parseStarBodyId, starBodyFacts, starBodyId } from './starBodies.ts';
import {
  indexStarNames,
  KM_S_TO_PC_PER_YEAR,
  parseStarNames,
  parseStars3dInfo,
  PARSEC_KM,
  STAR3D,
  STAR3D_FLAG,
  STAR3D_FLOATS,
  Stars3dSource,
  systemDisplayName,
} from './stars3d.ts';
import { searchNames } from './beltNames.ts';
import { isShown } from '../scene/floatingOrigin.ts';
import { layersFor } from './search.ts';

/** Two tiers: a Sirius-like star and a faint one, then one more. */
const TIER0 = new Float32Array([
  -0.5, 2.4, -0.4, -12, 0, 3, 1.42, 0.0, 0, STAR3D_FLAG.RADIAL_VELOCITY | STAR3D_FLAG.HIPPARCOS_PARALLAX,
  10, 20, 30, 1, 2, 3, 5.5, 0.6, -1, STAR3D_FLAG.GCNS | STAR3D_FLAG.GCNS_WITHIN_100PC,
]);
const TIER1 = new Float32Array([1, 0, 0, 0, 30, 0, 11.2, 1.6, 1, STAR3D_FLAG.GCNS]);

/** The details file of tier 0: ids, HIP numbers, parallaxes, their errors. */
function details0(): ArrayBuffer {
  const n = 2;
  const buffer = new ArrayBuffer(n * 20);
  const view = new DataView(buffer);
  view.setBigUint64(0, 2947050466531873024n, true);
  view.setBigUint64(8, 0n, true);
  view.setUint32(n * 8, 32349, true);
  view.setUint32(n * 8 + 4, 0, true);
  view.setFloat32(n * 12, 379.21, true);
  view.setFloat32(n * 12 + 4, 26.7, true);
  view.setFloat32(n * 16, 1.58, true);
  view.setFloat32(n * 16 + 4, 0, true);
  return buffer;
}

const INFO = {
  sources: [],
  queriedAt: '2026-10-22',
  epochJulianYear: 2000,
  frame: 'ecliptic',
  obliquityArcsec: 84381.448,
  parallaxSnrLimit: 5,
  photometry: '',
  count: 3,
  recordFloats: 10,
  kmPerSecondToParsecPerYear: STAR3D_KM_S_TO_PC_PER_YEAR,
  tiers: [
    { file: 'tier-0.bin', count: 2, bytes: 80, brightestMv: null, faintestMv: 8, details: 'details-0.bin', detailsBytes: 40 },
    { file: 'tier-1.bin', count: 1, bytes: 40, brightestMv: 8, faintestMv: null, details: 'details-1.bin', detailsBytes: 20 },
  ],
  sky: { rows: 2, placed: 2, atInfinity: 0 },
  counts: { gaiaParallax: 2, hipparcosParallax: 1, literatureParallax: 0, radialVelocity: 1, gcns: 2, withinTenParsecs: 1 },
  crossMatch: { byId: 1, byPosition: 0, positionalRadiusArcsec: 1 },
  overrides: [],
  dropped: {},
  names: { file: 'names.json', count: 2, bytes: 100 },
};

const NAMES: Stars3dNames = {
  count: 2,
  display: ['Sirius', 'Gliese 1'],
  iau: [true, false],
  designations: [['alf CMa A', 'HIP 32349'], ['GJ 1']],
  system: ['Sirius', null],
  nearest: [7, null],
  spectralType: ['A1V', null],
  tier: [0, 1],
  index: [0, 0],
};

const FILES: Record<string, ArrayBuffer> = {
  '/data/stars3d/tier-0.bin': TIER0.buffer,
  '/data/stars3d/tier-1.bin': TIER1.buffer,
  '/data/stars3d/details-0.bin': details0(),
};

function fetchers(log: string[] = []): BeltFetchers {
  return {
    json: async (path) => {
      log.push(path);
      if (path === '/data/stars3d/stars3d.json') return INFO;
      if (path === '/data/stars3d/names.json') return NAMES;
      return null;
    },
    binary: async (path: string, options: BinaryFetchOptions = {}) => {
      log.push(options.range === undefined ? path : `${path}@${options.range.offset}+${options.range.length}`);
      const file = FILES[path];
      if (file === undefined) return null;
      return options.range === undefined
        ? file.slice(0)
        : file.slice(options.range.offset, options.range.offset + options.range.length);
    },
  };
}

describe('the 3D stars’ data', () => {
  it('restates the contract’s constants', () => {
    expect(STAR3D_FLOATS).toBe(STAR3D_RECORD_FLOATS);
    expect(KM_S_TO_PC_PER_YEAR).toBe(STAR3D_KM_S_TO_PC_PER_YEAR);
    expect(STAR3D_FLAG).toEqual(STAR3D_FLAGS);
    // The contract's constant and a Julian year over the IAU parsec part at 8e-12 of
    // themselves -- 3e-14 pc for a 100 km/s star after a century. Nothing.
    expect(Math.abs(KM_S_TO_PC_PER_YEAR / ((365.25 * 86_400) / PARSEC_KM) - 1)).toBeLessThan(1e-10);
  });

  it('checks stars3d.json against the sky it was built with', () => {
    expect(parseStars3dInfo(INFO, 2).count).toBe(3);
    expect(() => parseStars3dInfo(INFO, 3)).toThrow(/stars.json has 3/);
    expect(() => parseStars3dInfo({ ...INFO, recordFloats: 9 }, 2)).toThrow(/floats a star/);
    expect(() => parseStars3dInfo({ ...INFO, count: 4 }, 2)).toThrow(/tiers hold 3/);
    expect(() =>
      parseStars3dInfo({ ...INFO, tiers: [{ ...INFO.tiers[0], file: '../x.bin' }, INFO.tiers[1]] }, 2),
    ).toThrow(/whole records/);
  });

  it('loads the tiers in order, brightest first, after stars3d.json', async () => {
    const log: string[] = [];
    const source = new Stars3dSource(fetchers(log), 2, '/');
    expect(source.view.state).toBe('idle');
    await source.request();
    expect(source.view.state).toBe('ready');
    expect(source.view.tiers.map((tier) => tier.records.length)).toEqual([20, 10]);
    expect(log).toEqual(['/data/stars3d/stars3d.json', '/data/stars3d/tier-0.bin', '/data/stars3d/tier-1.bin']);
    // Asked again, nothing more is fetched.
    await source.request();
    expect(log).toHaveLength(3);
  });

  it('is absent, quietly, where the data has no 3D stars', async () => {
    const empty: BeltFetchers = { json: async () => null, binary: async () => null };
    const source = new Stars3dSource(empty, 2, '/');
    await source.request();
    expect(source.view.state).toBe('absent');
  });

  it('reads one record on its own for a tier not yet in, and a star’s details', async () => {
    const log: string[] = [];
    const source = new Stars3dSource(fetchers(log), 2, '/');
    const record = await source.record(0, 1);
    expect(Array.from(record)).toEqual(Array.from(TIER0.subarray(10, 20)));
    expect(log).toContain('/data/stars3d/tier-0.bin@40+40');
    const details = await source.details(0, 0);
    expect(details).toEqual({
      gaiaDr3: '2947050466531873024',
      hip: 32349,
      parallaxMas: Math.fround(379.21),
      parallaxErrorMas: Math.fround(1.58),
    });
    expect((await source.details(0, 1))?.parallaxErrorMas).toBeNull();
  });

  it('finds a star by any of its designations', () => {
    const index = indexStarNames(parseStarNames(NAMES, parseStars3dInfo(INFO, 2)));
    expect(searchNames(index, 'sirius')[0]?.k).toBe(0);
    expect(searchNames(index, 'HIP 32349')[0]?.k).toBe(0);
    expect(searchNames(index, 'alf cma')[0]?.k).toBe(0);
    expect(() => parseStarNames({ ...NAMES, index: [0, 5] }, parseStars3dInfo(INFO, 2))).toThrow(/not there/);
  });
});

describe('a star made a body', () => {
  it('is placed by its record, followed at its own motion, and in no layer', async () => {
    const store = makeStore();
    const source = new Stars3dSource(fetchers(), 2, '/');
    const index = indexStarNames(NAMES);
    const id = await addStarBody(store, source, index, 0, 'sun');
    expect(id).toBe(starBodyId(0, 0));
    expect(parseStarBodyId(id)).toEqual({ tier: 0, index: 0 });
    const body = store.body(id);
    expect(isCatalogueStar(body)).toBe(true);
    expect(isCatalogueStar(store.body('sun'))).toBe(false);
    expect(body.name).toBe('Sirius');
    expect(body.radiusPublished).toBe(false);
    expect(isShown(body, new Set())).toBe(true);
    expect(layersFor(body)).toEqual([]);
    expect(starBodyFacts(id)?.spectralType).toBe('A1V');

    // About the Sun: the record's parsecs, moved on by its velocity.
    const jd = 2_461_320.5;
    const state = store.stateRelativeTo(id, 'sun', jd)!;
    const years = (jd - 2_451_545) / 365.25;
    expect(state.position.x / PARSEC_KM).toBeCloseTo(TIER0[STAR3D.x]! + TIER0[STAR3D.vx]! * years * KM_S_TO_PC_PER_YEAR, 9);
    expect(state.velocity.x).toBeCloseTo(-12, 9);
    // Exact: the catalogue's own model, not flagged APPROXIMATE.
    expect(store.isExactAt(jd, [id])).toBe(true);
    expect(state.approximate).toBe(false);
  });
});

describe('a star system as shown', () => {
  it('is its name, and nothing for a double-star catalogue entry', () => {
    expect(systemDisplayName('Alpha Centauri')).toBe('Alpha Centauri');
    expect(systemDisplayName('61 Cygni')).toBe('61 Cygni');
    expect(systemDisplayName('CCDM J01441-1557')).toBeNull();
    expect(systemDisplayName('WDS J03329-0927')).toBeNull();
    expect(systemDisplayName(null)).toBeNull();
  });
});
