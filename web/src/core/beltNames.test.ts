import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { BELT_CLASSES, type BeltInfo, type BeltNames } from '@sss/tools/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { decodeBeltRecords, httpBeltFetchers, RECORD, RECORD_BYTES, RECORD_FLOATS, type BeltFetchers, type LoadedTier } from './belt.ts';
import { addBeltBody, beltBodyFacts, beltBodyId, nominalRadiusKm, parseBeltBodyId, recordElements } from './beltBodies.ts';
import { indexNames, loadBeltRecord, parseBeltNames, searchNames } from './beltNames.ts';
import { describeWithData as withData } from './describeWithData.ts';
import { loadEphemerisStore, type EphemerisStore, type Fetcher } from './ephemerisStore.ts';
import { propagate } from './kepler.ts';
import { beltPosition } from '../scene/beltShader.ts';

/**
 * Finding a belt asteroid by name and making it a body: the index, the record behind a
 * name, and the body made from it.
 */

const INFO = {
  recordFloats: 9,
  count: 4,
  file: 'elements-0.bin',
  magnitudeLimit: 18,
  referenceJd: 2461332.5,
  elementEpochs: { minJd: 2461200.5, maxJd: 2461200.5 },
  classes: [...BELT_CLASSES],
  classCounts: { MBA: 3, AMO: 1 },
  tiers: [
    { file: 'elements-0.bin', count: 3, bytes: 108, brightestH: null, faintestH: 15 },
    { file: 'elements-1.bin', count: 1, bytes: 36, brightestH: 15, faintestH: null },
  ],
  names: { file: 'names.json', count: 4, bytes: 0 },
} as unknown as BeltInfo;

const NAMES: BeltNames = {
  count: 4,
  display: ['1 Ceres', '433 Eros', '4596 (1981 QB)', '2024 YR4'],
  designation: ['A801 AA', 'A898 PA', null, null],
  tier: [0, 0, 0, 1],
  index: [0, 1, 2, 0],
  classIndex: [0, 6, 0, 4],
};

/** Records: a (km), e, i, node, peri, M, n, H, class. */
const ROWS = [
  [4.14e8, 0.0785, 0.1849, 1.4016, 1.2824, 2.2, 0.003746, 3.3, 0],
  [2.18e8, 0.2229, 0.1890, 5.7, 3.92, -0.4, 0.009147, 10.4, 6],
  [3.53e8, 0.0894, 0.1240, 1.8114, 2.6328, 0.4, 0.004723, 13.1, 0],
] as const;
const FAINT = [3.9e8, 0.66, 0.006, 4.3, 2.4, 1.1, 0.0042, 23.9, 4] as const;

function encode(rows: readonly (readonly number[])[]): ArrayBuffer {
  const buffer = new ArrayBuffer(rows.length * RECORD_BYTES);
  const view = new DataView(buffer);
  rows.flat().forEach((value, k) => view.setFloat32(k * 4, value, true));
  return buffer;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the name index', () => {
  const index = indexNames(INFO, parseBeltNames(NAMES, INFO));

  it('rejects a pointer to a record that is not there', () => {
    expect(() => parseBeltNames({ ...NAMES, index: [0, 1, 2, 1] }, INFO)).toThrow(/entry 3 points at tier 1, record 1/);
    expect(() => parseBeltNames({ ...NAMES, tier: [0, 0, 0, 2] }, INFO)).toThrow(/tier 2/);
    expect(() => parseBeltNames({ ...NAMES, display: ['1 Ceres'] }, INFO)).toThrow(/display/);
  });

  it('finds a name whole, by its start, by a word in it, or anywhere in it', () => {
    expect(searchNames(index, 'eros').map(({ k }) => k)).toEqual([1]);
    expect(searchNames(index, '433 eros')[0]).toEqual({ k: 1, score: 0 });
    expect(searchNames(index, '2024 yr4')[0]!.k).toBe(3);
    expect(searchNames(index, 'yr4')[0]!.k).toBe(3);
  });

  it('matches the designation a name does not show, a step below the name', () => {
    const match = searchNames(index, 'a898 pa')[0]!;
    expect(match.k).toBe(1);
    expect(match.score).toBe(0.5);
  });

  it('keeps the index’s order -- brightness -- among equal matches, and stops at the limit', () => {
    // "1" starts "1 Ceres" and is a word of nothing else; every name has a digit 1 or not.
    const ones = searchNames(index, '1');
    expect(ones[0]!.k).toBe(0);
    expect(searchNames(index, '1', 1)).toHaveLength(1);
    expect(searchNames(index, '   ')).toEqual([]);
  });
});

describe('the record behind a name', () => {
  const tier0: LoadedTier = {
    index: 0,
    tier: INFO.tiers![0]!,
    records: decodeBeltRecords(encode(ROWS), 3),
    classCounts: {},
  };

  it('comes from its tier when the tier is loaded, without a fetch', async () => {
    const binary = vi.fn();
    const fetchers = { json: vi.fn(), binary } as unknown as BeltFetchers;
    const record = await loadBeltRecord(fetchers, INFO, 0, 1, [tier0]);
    expect(Array.from(record)).toEqual(ROWS[1].map(Math.fround));
    expect(binary).not.toHaveBeenCalled();
  });

  it('is fetched alone, by a range request, when it is not', async () => {
    const fetchers: BeltFetchers = {
      json: async () => null,
      binary: async (path, options) => {
        expect(path).toBe('/data/belt/elements-1.bin');
        expect(options?.range).toEqual({ offset: 0, length: RECORD_BYTES });
        return encode([FAINT]);
      },
    };
    const record = await loadBeltRecord(fetchers, INFO, 1, 0, [tier0]);
    expect(record[RECORD.H]).toBe(Math.fround(23.9));
  });

  it('reads just the bytes asked for from a server that honours Range, or one that does not', async () => {
    const whole = new Uint8Array(encode(ROWS));
    const asked: (string | null)[] = [];
    // First a 206 with the slice, then a 200 with the whole file in small chunks.
    let honour = true;
    vi.stubGlobal('fetch', async (_path: string, init: RequestInit) => {
      asked.push(new Headers(init.headers).get('Range'));
      if (honour) {
        return new Response(whole.slice(RECORD_BYTES, 2 * RECORD_BYTES), { status: 206 });
      }
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (let at = 0; at < whole.length; at += 10) {
            controller.enqueue(whole.slice(at, at + 10));
          }
          controller.close();
        },
      });
      return new Response(stream, { status: 200 });
    });
    const range = { offset: RECORD_BYTES, length: RECORD_BYTES };
    const partial = await httpBeltFetchers.binary('/x.bin', { range });
    expect(asked[0]).toBe(`bytes=${RECORD_BYTES}-${2 * RECORD_BYTES - 1}`);
    expect(Array.from(new Float32Array(partial!))).toEqual(ROWS[1].map(Math.fround));
    honour = false;
    const fallback = await httpBeltFetchers.binary('/x.bin', { range });
    expect(Array.from(new Float32Array(fallback!))).toEqual(ROWS[1].map(Math.fround));
  });
});

describe('a belt record as a body', () => {
  it('has the elements of its record, placed where the shader puts its dot', () => {
    const records = decodeBeltRecords(encode(ROWS), 3);
    const record = records.slice(RECORD_FLOATS, 2 * RECORD_FLOATS);
    const elements = recordElements(record, INFO.referenceJd, 'belt-0-1');
    for (const dt of [0, 30, 365.25]) {
      const body = propagate(elements, INFO.referenceJd + dt).position;
      const dot = beltPosition(records, 1, dt);
      // Float64 against the shader's float32: 141 km at most within a year.
      expect(Math.hypot(body.x - dot.x, body.y - dot.y, body.z - dot.z)).toBeLessThan(200);
    }
  });

  it('has an id that says where its record is, and nothing else does', () => {
    expect(parseBeltBodyId(beltBodyId(4, 123_456))).toEqual({ tier: 4, index: 123_456 });
    expect(parseBeltBodyId('earth')).toBeNull();
    expect(parseBeltBodyId('belt-x-1')).toBeNull();
  });

  it('takes a size from H only to frame by: 4.2 km across at H 15', () => {
    expect(2 * nominalRadiusKm(15)).toBeCloseTo(4.2, 1);
  });
});

// The store, with the generated data, to add a body to.
const DATA_ROOT = join(import.meta.dirname, '../../public');
const disk: Fetcher = async (path) => JSON.parse(await readFile(join(DATA_ROOT, path), 'utf8')) as unknown;
const store: EphemerisStore | null = await loadEphemerisStore(disk, '/').catch(() => null);
const describeWithData = withData(store !== null);

describeWithData('going to a belt asteroid', () => {
  const s = store!;
  const index = indexNames(INFO, parseBeltNames(NAMES, INFO));
  const tier0: LoadedTier = { index: 0, tier: INFO.tiers![0]!, records: decodeBeltRecords(encode(ROWS), 3), classCounts: {} };
  const tier1: LoadedTier = { index: 1, tier: INFO.tiers![1]!, records: decodeBeltRecords(encode([FAINT]), 1), classCounts: {} };
  const fetchers = { json: vi.fn(), binary: vi.fn() } as unknown as BeltFetchers;

  it('makes it a body, placed by its elements and flagged approximate', async () => {
    const before = s.version;
    const id = await addBeltBody(s, index, 1, fetchers, [tier0, tier1], 'sun');
    expect(id).toBe('belt-0-1');
    expect(s.version).toBe(before + 1);
    expect(s.body(id).name).toBe('433 Eros');
    const state = s.stateInRoot(id, INFO.referenceJd + 10)!;
    expect(state.approximate).toBe(true);
    expect(s.isExactAt(INFO.referenceJd + 10, [id])).toBe(false);
    expect(beltBodyFacts(id)!.orbitClass).toBe('AMO');
  });

  it('keeps the one the camera is on, and lets the others go', async () => {
    const eros = beltBodyId(0, 1);
    const yr4 = await addBeltBody(s, index, 3, fetchers, [tier0, tier1], eros);
    expect(s.isPropagatedBody(eros)).toBe(true);
    expect(s.isPropagatedBody(yr4)).toBe(true);
    // With the camera on 2024 YR4, going to Ceres takes Eros away.
    const ceres = await addBeltBody(s, index, 0, fetchers, [tier0, tier1], yr4);
    expect(s.isPropagatedBody(eros)).toBe(false);
    expect(beltBodyFacts(eros)).toBeNull();
    expect(s.isPropagatedBody(ceres)).toBe(true);
    expect(s.isPropagatedBody(yr4)).toBe(true);
  });

  it('removes only what it added', () => {
    const count = s.bodies.length;
    s.removePropagatedBody('earth');
    expect(s.bodies.length).toBe(count);
  });
});

describeWithData('a belt body, in the frame every body is in', () => {
  it('is its heliocentric orbit about the Sun, not about the barycentre', async () => {
    // A parentless body's state is barycentric, and propagated elements are heliocentric:
    // the Sun's own place has to be added, or the body sits up to 1.5 million km off its
    // dot -- which is the Sun's wobble about the barycentre.
    const s = store!;
    const index = indexNames(INFO, parseBeltNames(NAMES, INFO));
    const tier0: LoadedTier = { index: 0, tier: INFO.tiers![0]!, records: decodeBeltRecords(encode(ROWS), 3), classCounts: {} };
    const id = await addBeltBody(s, index, 2, { json: vi.fn(), binary: vi.fn() } as unknown as BeltFetchers, [tier0], 'none');
    const jd = INFO.referenceJd + 40;
    const aboutSun = s.stateRelativeTo(id, 'sun', jd)!.position;
    const want = propagate(recordElements(tier0.records.slice(2 * RECORD_FLOATS, 3 * RECORD_FLOATS), INFO.referenceJd, id), jd).position;
    expect(Math.hypot(aboutSun.x - want.x, aboutSun.y - want.y, aboutSun.z - want.z)).toBeLessThan(1e-3);
  });
});

// The generated names, against the generated belt.
const realNames = await (async () => {
  try {
    const { loadNameIndex } = await import('./beltNames.ts');
    return await loadNameIndex(
      {
        json: async (path) => {
          try {
            return JSON.parse(await readFile(join(DATA_ROOT, path), 'utf8')) as unknown;
          } catch {
            return null;
          }
        },
        binary: async (path, options) => {
          const bytes = await readFile(join(DATA_ROOT, path));
          const offset = options?.range?.offset ?? 0;
          const length = options?.range?.length ?? bytes.byteLength;
          return bytes.buffer.slice(bytes.byteOffset + offset, bytes.byteOffset + offset + length) as ArrayBuffer;
        },
      },
      '/',
    );
  } catch {
    return null;
  }
})();
const describeWithNames = withData(realNames !== null);

describeWithNames('the generated name index', () => {
  const index = realNames!;

  it('finds 433 Eros first for "eros", among more than a hundred thousand', () => {
    const eros = searchNames(index, 'eros')[0]!;
    expect(index.names.display[eros.k]).toBe('433 Eros');
    expect(index.names.count).toBeGreaterThan(100_000);
  });

  it('points every name at a record of its own class', async () => {
    // Each tier file read once: two hundred reads of up to 23 MB would be the test's time.
    const files = new Map<string, Buffer>();
    const disk: BeltFetchers = {
      json: async () => null,
      binary: async (path, options) => {
        let bytes = files.get(path);
        if (bytes === undefined) {
          bytes = await readFile(join(DATA_ROOT, path));
          files.set(path, bytes);
        }
        const offset = options!.range!.offset;
        return bytes.buffer.slice(bytes.byteOffset + offset, bytes.byteOffset + offset + options!.range!.length) as ArrayBuffer;
      },
    };
    // A spread of entries across every tier, read by range as the app reads them.
    for (let k = 0; k < index.names.count; k += Math.floor(index.names.count / 200)) {
      const record = await loadBeltRecord(disk, index.info, index.names.tier[k]!, index.names.index[k]!, []);
      expect(record[RECORD.class], index.names.display[k]).toBe(index.names.classIndex[k]);
    }
  }, 60_000);
});
