import { QUASAR_ABS_V, QUASAR_BV, QUASAR_BYTES, QUASAR_POSITION_UNIT_PC, SZ_CLUSTER_BYTES, type QuasarsInfo } from '@sss/tools/quasars';
import { describe, expect, it, vi } from 'vitest';

import { PLANCK_DISTANCES } from '../../../tools/src/quasars/planck.ts';
import { CLUSTER_RECORD_HOLDERS, QUASAR_RECORD_HOLDERS } from '../../../tools/src/quasars/sources.ts';
import { floorShown } from '../scene/crowding.ts';
import {
  holdQuasarPatch,
  QUASAR_PATCH_SEPARATION_PX,
  quasarFloorShown,
  QUASARS_FROM_LY,
  QUASARS_FULL_LY,
  quasarsFade,
  ringsKept,
} from '../scene/Quasars.tsx';
import { crowdingGrid } from '../scene/screenCrowding.ts';
import { comovingDistanceMpc } from './cosmology.ts';
import { FAR_LANDMARKS, fieldHalfAngle } from './farLandmarks.ts';
import {
  DOT_LEAST,
  parseQuasarChunk,
  parseQuasarsInfo,
  parseSzClusters,
  quasarAbsVOf,
  quasarBvOf,
  quasarChunkBudget,
  quasarDot,
  quasarSource,
} from './quasars.ts';
import { RECORD_HOLDERS, recordHolderBodyId, recordHolderOf } from './recordHolders.ts';

const LIGHT_YEAR_PC = 0.30660139378555057;

/** A quasars.json as the data writes it, its numbers small. */
function info(): QuasarsInfo {
  return {
    positionUnitPc: QUASAR_POSITION_UNIT_PC,
    quasars: {
      bytesPerQuasar: QUASAR_BYTES,
      chunks: [
        { file: 'quasars-0.bin', bytes: 2 * QUASAR_BYTES, count: 2, absVBrightest: -29, absVFaintest: -27 },
        { file: 'quasars-1.bin', bytes: QUASAR_BYTES, count: 1, absVBrightest: -25, absVFaintest: -25 },
      ],
      absVPercentiles: { p5: -28, p50: -26, p95: -24 },
      halfCountPc: 5e9,
    },
    footprint: { grid: { decBands: 90, raCells: 180, cellDeg2: 2.5 }, survey: {} },
    clusters: { file: 'sz-clusters.bin', bytes: 2 * SZ_CLUSTER_BYTES, count: 2 },
  } as unknown as QuasarsInfo;
}

describe('quasars.json and its files', () => {
  it('is read only in the layout this app was written for', () => {
    expect(parseQuasarsInfo(info()).quasars.chunks).toHaveLength(2);
    expect(() => parseQuasarsInfo({ ...info(), positionUnitPc: 100_000 })).toThrow();
    const badChunk = info();
    (badChunk.quasars.chunks as unknown as { file: string }[])[0]!.file = '../x.bin';
    expect(() => parseQuasarsInfo(badChunk)).toThrow(/cannot be/);
    expect(() => parseQuasarsInfo({ ...info(), clusters: { file: 'sz-clusters.bin', bytes: 7, count: 2 } })).toThrow(/SZ clusters/);
  });

  it('reads a chunk as its columns', () => {
    const buffer = new ArrayBuffer(2 * QUASAR_BYTES);
    new Int16Array(buffer, 0, 6).set([1, 2, 3, -4, -5, -6]);
    new Uint8Array(buffer).set([10, 255, 20, 254, 8, 16], 12);
    const chunk = parseQuasarChunk(buffer, 2);
    expect(Array.from(chunk.positions)).toEqual([1, 2, 3, -4, -5, -6]);
    expect(Array.from(chunk.absV)).toEqual([10, 255]);
    expect(Array.from(chunk.bv)).toEqual([20, 254]);
    expect(Array.from(chunk.flags)).toEqual([8, 16]);
    expect(() => parseQuasarChunk(buffer, 3)).toThrow();
    expect(quasarAbsVOf(10)).toBeCloseTo(QUASAR_ABS_V.min + 0.5, 9);
    expect(Number.isNaN(quasarAbsVOf(QUASAR_ABS_V.unknown))).toBe(true);
    expect(quasarBvOf(20)).toBeCloseTo(QUASAR_BV.min + 0.2, 9);
  });

  it('reads the SZ clusters as places, redshifts and masses', () => {
    const buffer = new ArrayBuffer(2 * SZ_CLUSTER_BYTES);
    new Float32Array(buffer).set([1, 2, 3, 4, 5, 6, 0.1, 0.5, 7, Number.NaN]);
    const clusters = parseSzClusters(buffer, 2);
    expect(Array.from(clusters.z)).toEqual([Math.fround(0.1), 0.5]);
    expect(clusters.mass[0]).toBe(7);
    expect(() => parseSzClusters(buffer, 1)).toThrow();
  });
});

describe('the quasars drawn', () => {
  it('weigh a dot by luminosity, whole at the 5th percentile, its least at the 95th and when unknown', () => {
    const p = { p5: -28, p95: -24 };
    expect(quasarDot(-29, p)).toBe(1);
    expect(quasarDot(-24, p)).toBe(DOT_LEAST);
    expect(quasarDot(Number.NaN, p)).toBe(DOT_LEAST);
    expect(quasarDot(-26, p)).toBeCloseTo((1 + DOT_LEAST) / 2, 9);
  });

  it('are none near the Sun and all from 3 billion light years', () => {
    expect(quasarsFade(0.5e9 * LIGHT_YEAR_PC)).toBe(0);
    expect(quasarsFade(QUASARS_FROM_LY * LIGHT_YEAR_PC)).toBe(0);
    expect(quasarsFade(QUASARS_FULL_LY * LIGHT_YEAR_PC)).toBe(1);
    expect(quasarsFade(1.7e9 * LIGHT_YEAR_PC)).toBeGreaterThan(0);
  });

  it('stay as wedges to the farthest the camera goes, where the galaxies’ maps are gone', () => {
    const half = 4.82e9;
    const ppr = 1000;
    for (const ly of [10e9, 30e9, 40e9]) expect(quasarFloorShown(half, ly * LIGHT_YEAR_PC, ppr)).toBe(1);
    // The galaxies' rule has them gone at the farthest the camera goes, 40 billion ly; the quasars' keeps them.
    expect(floorShown(half, 40e9 * LIGHT_YEAR_PC, ppr)).toBe(0);
    // A speck: gone at 6 pixels in radius.
    expect(quasarFloorShown(half, 100e9 * LIGHT_YEAR_PC, 30)).toBe(0);
  });

  it('hold a crowded patch at its dots a pixel apart, four times the galaxies’ two', () => {
    const grid = crowdingGrid(96, 96);
    grid.counts.fill(0);
    // 2 samples a cell of 48 x 48 px, each for 4,608 quasars: 4 a square pixel.
    grid.counts.fill(2);
    holdQuasarPatch(grid, 4608, 96, 96);
    const density = (2 * 4608) / (48 * 48);
    expect(grid.kept[0]).toBe(Math.round(255 / (density * QUASAR_PATCH_SEPARATION_PX ** 2)));
    grid.counts.fill(0);
    holdQuasarPatch(grid, 4608, 96, 96);
    expect(grid.kept[0]).toBe(255);
  });

  it('keep the clusters’ rings whole while they are apart, and fewer as they crowd', () => {
    const near = ringsKept(2e9, 1000, 3e9, 1000);
    const far = ringsKept(2e9, 1000, 20e9, 1000);
    expect(near).toBe(1);
    expect(far).toBeLessThan(near);
  });

  it('are given every chunk unless the device says it is small', () => {
    expect(quasarChunkBudget(6)).toBe(6);
    expect(quasarChunkBudget(6, { memoryGb: 4 })).toBe(4);
    expect(quasarChunkBudget(6, { memoryGb: 2 })).toBe(2);
    expect(quasarChunkBudget(6, { coarsePointer: true })).toBe(2);
  });
});

describe('fetching the quasars', () => {
  it('asks for nothing on a site built without them', async () => {
    const fetchers = { json: vi.fn(), binary: vi.fn() };
    const source = quasarSource(fetchers, '/', false);
    source.quasars.request(6);
    await source.clusters.request();
    await source.info.request();
    expect(fetchers.json).not.toHaveBeenCalled();
    expect(fetchers.binary).not.toHaveBeenCalled();
    expect(source.quasars.chunks).toHaveLength(0);
  });

  it('fetches quasars.json, then the chunks most luminous first, as many as asked for', async () => {
    const fetchers = {
      json: vi.fn(async () => info()),
      binary: vi.fn(async (_path: string, options?: { expectedBytes?: number }) => new ArrayBuffer(options?.expectedBytes ?? 0)),
    };
    const source = quasarSource(fetchers, '/base/', true);
    const landed = new Promise<void>((done) => source.quasars.subscribe(() => done()));
    source.quasars.request(1);
    await landed;
    expect(fetchers.json).toHaveBeenCalledWith('/base/data/quasars/quasars.json');
    expect(fetchers.binary.mock.calls.map((call) => call[0])).toEqual(['/base/data/quasars/quasars-0.bin']);
    expect(source.quasars.chunks[0]!.count).toBe(2);
  });
});

describe('the quasars and the record-holders', () => {
  it('are placed in one cosmology: the data’s Planck 2018 is the app’s', () => {
    for (const z of [0.158339, 1, 2.219, 5, 7.02]) {
      expect(PLANCK_DISTANCES.distance(z) / comovingDistanceMpc(z)).toBeCloseTo(1, 5);
    }
  });

  it('look for the same quasar and cluster record-holders the app marks', () => {
    const marked = (kind: string) =>
      RECORD_HOLDERS.filter((h) => h.kind === kind).map((h) => ({ key: h.key, raDeg: h.raDeg, decDeg: h.decDeg, z: h.z }));
    const looked = (list: readonly { key: string; raDeg: number; decDeg: number; z: number }[]) =>
      list.map(({ key, raDeg, decDeg, z }) => ({ key, raDeg, decDeg, z }));
    expect(looked(QUASAR_RECORD_HOLDERS)).toEqual(marked('quasar'));
    expect(looked(CLUSTER_RECORD_HOLDERS).sort((a, b) => a.key.localeCompare(b.key))).toEqual(
      [...marked('cluster'), ...marked('supercluster')].sort((a, b) => a.key.localeCompare(b.key)),
    );
  });
});

describe('the far landmarks', () => {
  it('are bodies as the record-holders are, but not counted among them', () => {
    const ids = new Set([...RECORD_HOLDERS, ...FAR_LANDMARKS].map(recordHolderBodyId));
    expect(ids.size).toBe(RECORD_HOLDERS.length + FAR_LANDMARKS.length);
    for (const landmark of FAR_LANDMARKS) {
      expect(recordHolderOf(recordHolderBodyId(landmark))).toBe(landmark);
      expect(RECORD_HOLDERS).not.toContain(landmark);
    }
    expect(FAR_LANDMARKS.filter((l) => l.kind === 'quasar-group').map((l) => l.key)).toEqual(['huge-lqg', 'clowes-campusano-lqg', 'u1-11']);
    expect(FAR_LANDMARKS.filter((l) => l.kind === 'deep-field')).toHaveLength(4);
  });

  it('say the Huge-LQG is a claim', () => {
    const huge = FAR_LANDMARKS.find((l) => l.key === 'huge-lqg')!;
    expect(huge.record).toMatch(/claimed/i);
    expect(huge.note).toMatch(/a claim, not a structure/);
  });

  it('give a field its width on the sky: the HUDF’s 11 square arcminutes a disc 1.9′ in radius', () => {
    expect((fieldHalfAngle(11) * 180 * 60) / Math.PI).toBeCloseTo(Math.sqrt(11 / Math.PI), 9);
  });
});
