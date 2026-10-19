import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { BELT_CLASSES, BELT_RECORD_FLOATS, type BeltInfo } from '@sss/tools/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  beltDensities,
  BeltSource,
  beltTiers,
  checkBeltRecords,
  countClasses,
  decodeBeltRecords,
  loadBeltInfo,
  loadBeltTier,
  parseBeltInfo,
  RECORD,
  RECORD_BYTES,
  RECORD_FLOATS,
  type BeltFetchers,
} from './belt.ts';
import { describeWithData as withData } from './describeWithData.ts';
import { RETRY_AFTER_MS } from './chunkedTable.ts';

/**
 * Loading the belt: the contract with the generator, held from this side.
 *
 * The binary is nine little-endian float32s an asteroid and nothing else -- no header,
 * no count -- so everything that keeps one asteroid's elements from being read as its
 * neighbour's is checked here: the record length, the byte count, the byte order.
 */

const INFO: BeltInfo = {
  source: { name: 'JPL Small-Body Database', url: 'https://ssd-api.jpl.nasa.gov/sbdb_query.api', queriedAt: '2026-10-19T00:00:00Z' },
  file: 'elements.bin',
  count: 3,
  recordFloats: 9,
  magnitudeLimit: 15,
  referenceJd: 2461000.5,
  elementEpochs: { minJd: 2461000.5, maxJd: 2461000.5 },
  classes: [...BELT_CLASSES],
  classCounts: { MBA: 2, APO: 1 },
  excluded: ['1', '4'],
  dropped: { notElliptic: 0, missingElements: 0 },
};

/** Three asteroids, one per row: a (km), e, i, node, peri, M, n (rad/day), H, class. */
const RECORDS = [
  [4.14e8, 0.0785, 0.1849, 1.4016, 1.2824, 2.2, 0.003746, 5.1, 0],
  [3.53e8, 0.0894, 0.1240, 1.8114, 2.6328, 0.4, 0.004723, 6.3, 0],
  [1.38e8, 0.1914, 0.0581, 3.5838, 2.2222, -0.4, 0.017202, 14.9, 4],
] as const;

/** The records as the generator writes them: little-endian float32, row after row. */
function encode(rows: readonly (readonly number[])[]): ArrayBuffer {
  const buffer = new ArrayBuffer(rows.length * RECORD_BYTES);
  const view = new DataView(buffer);
  rows.flat().forEach((value, k) => view.setFloat32(k * 4, value, true));
  return buffer;
}

/** A fourth asteroid, faint, for the last tier. */
const FAINT = [3.9e8, 0.12, 0.2, 0.3, 0.4, 1.1, 0.0042, 18.4, 0] as const;

/**
 * The same asteroids as B2b writes them: three tiers -- H < 15, 15 to 16, 16 and fainter
 * -- holding two, one and one. The middle one is RECORDS's third, moved to H 15.5.
 */
const TIERED: BeltInfo = {
  ...INFO,
  file: 'elements-0.bin',
  count: 4,
  magnitudeLimit: 18.4,
  classCounts: { MBA: 3, APO: 1 },
  tiers: [
    { file: 'elements-0.bin', count: 2, bytes: 72, brightestH: null, faintestH: 15 },
    { file: 'elements-1.bin', count: 1, bytes: 36, brightestH: 15, faintestH: 16 },
    { file: 'elements-2.bin', count: 1, bytes: 36, brightestH: 16, faintestH: null },
  ],
};

const TIERED_FILES: Record<string, unknown> = {
  '/data/belt/belt.json': TIERED,
  '/data/belt/elements-0.bin': encode([RECORDS[0], RECORDS[1]]),
  '/data/belt/elements-1.bin': encode([[...RECORDS[2].slice(0, 7), 15.5, 4]]),
  '/data/belt/elements-2.bin': encode([FAINT]),
};

/** A promise and the hand that resolves it. */
function deferred(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/**
 * Fetchers over an in-memory directory; a path not in it is a 404. A file can be held
 * back until a promise resolves -- reporting some bytes on the way, and rejecting as a
 * browser's fetch does if it is aborted meanwhile -- or made to fail once.
 */
function memoryFetchers(files: Record<string, unknown>) {
  const asked: string[] = [];
  const aborted: string[] = [];
  const expected: (number | undefined)[] = [];
  const held = new Map<string, { readonly gate: Promise<void>; readonly partialBytes: number }>();
  const failing = new Set<string>();
  const fetchers: BeltFetchers = {
    json: async (path) => {
      asked.push(path);
      return path in files ? files[path] : null;
    },
    binary: async (path, options = {}) => {
      asked.push(path);
      expected.push(options.expectedBytes);
      const hold = held.get(path);
      if (hold !== undefined) {
        held.delete(path);
        if (hold.partialBytes > 0) {
          options.onProgress?.(hold.partialBytes);
        }
        await hold.gate;
        if (options.signal?.aborted === true) {
          aborted.push(path);
          throw new DOMException('The operation was aborted.', 'AbortError');
        }
      }
      if (failing.delete(path)) {
        throw new Error(`Failed to load ${path}: HTTP 503`);
      }
      return path in files ? (files[path] as ArrayBuffer) : null;
    },
  };
  return {
    ...fetchers,
    asked,
    aborted,
    expected,
    hold: (path: string, gate: Promise<void>, partialBytes = 0) => {
      held.set(path, { gate, partialBytes });
    },
    failOnce: (path: string) => {
      failing.add(path);
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the record layout', () => {
  it('reads as many floats an asteroid as the generator writes', () => {
    // Restated rather than imported, as the app does with the generator's configuration;
    // this is what keeps the two from drifting apart.
    expect(RECORD_FLOATS).toBe(BELT_RECORD_FLOATS);
    expect(RECORD_BYTES).toBe(36);
  });

  it('puts every element where the contract says', () => {
    expect(RECORD).toEqual({ a: 0, e: 1, i: 2, node: 3, peri: 4, M: 5, n: 6, H: 7, class: 8 });
  });
});

describe('parseBeltInfo', () => {
  it('accepts the contract', () => {
    expect(parseBeltInfo(INFO)).toBe(INFO);
  });

  it('rejects any other record length', () => {
    expect(() => parseBeltInfo({ ...INFO, recordFloats: 8 })).toThrow(/8 floats per asteroid/);
    expect(() => parseBeltInfo({ ...INFO, recordFloats: undefined })).toThrow(/floats per asteroid/);
  });

  it('rejects a file name that could reach outside belt/', () => {
    for (const file of ['../manifest.json', 'a/b.bin', '', '.hidden']) {
      expect(() => parseBeltInfo({ ...INFO, file })).toThrow(/elements file/);
    }
  });

  it('rejects what the renderer cannot do without', () => {
    expect(() => parseBeltInfo(null)).toThrow();
    expect(() => parseBeltInfo({ ...INFO, count: 2.5 })).toThrow(/count/);
    expect(() => parseBeltInfo({ ...INFO, referenceJd: Number.NaN })).toThrow(/mean anomalies/);
    expect(() => parseBeltInfo({ ...INFO, magnitudeLimit: undefined })).toThrow(/magnitude/);
  });
});

describe('decodeBeltRecords', () => {
  it('reads little-endian float32s at a stride of nine', () => {
    const records = decodeBeltRecords(encode(RECORDS), 3);

    expect(records.length).toBe(27);
    for (const [row, values] of RECORDS.entries()) {
      for (const [column, value] of values.entries()) {
        expect(records[row * RECORD_FLOATS + column]).toBe(Math.fround(value));
      }
    }
    // The third asteroid's H and class, by name: where the stride would show first.
    expect(records[2 * RECORD_FLOATS + RECORD.H]).toBe(Math.fround(14.9));
    expect(records[2 * RECORD_FLOATS + RECORD.class]).toBe(4);
  });

  it('reads the same on a big-endian host', () => {
    // The DataView path, forced: the bytes' order belongs to the file, not to the machine.
    const buffer = encode(RECORDS);
    expect(decodeBeltRecords(buffer, 3, false)).toEqual(decodeBeltRecords(buffer, 3, true));
  });

  it('is not the bytes read the other way round', () => {
    // The check that the test above could fail: big-endian bytes do not decode to the
    // same numbers.
    const buffer = new ArrayBuffer(RECORD_BYTES);
    const view = new DataView(buffer);
    RECORDS[0].forEach((value, k) => view.setFloat32(k * 4, value, false));
    expect(decodeBeltRecords(buffer, 1)[RECORD.a]).not.toBe(Math.fround(RECORDS[0][RECORD.a]));
  });

  it('rejects a file a byte too short or too long', () => {
    const buffer = encode(RECORDS);
    expect(() => decodeBeltRecords(buffer.slice(0, buffer.byteLength - 1), 3)).toThrow(/107 bytes/);
    expect(() => decodeBeltRecords(buffer, 4)).toThrow(/144/);
    expect(() => decodeBeltRecords(buffer, 2)).toThrow(/72/);
  });
});

describe('checkBeltRecords', () => {
  it('passes real ellipses', () => {
    expect(() => checkBeltRecords(decodeBeltRecords(encode(RECORDS), 3))).not.toThrow();
  });

  it('rejects anything the shader could not solve', () => {
    const withValue = (index: number, value: number) => {
      const records = decodeBeltRecords(encode(RECORDS), 3).slice();
      records[RECORD_FLOATS + index] = value;
      return records;
    };
    expect(() => checkBeltRecords(withValue(RECORD.e, 1))).toThrow(/asteroid 1 is not on an ellipse/);
    expect(() => checkBeltRecords(withValue(RECORD.e, -0.1))).toThrow(/ellipse/);
    expect(() => checkBeltRecords(withValue(RECORD.a, 0))).toThrow(/ellipse/);
    expect(() => checkBeltRecords(withValue(RECORD.M, Number.NaN))).toThrow(/asteroid 1 has a non-finite/);
  });
});

describe('beltTiers', () => {
  it('reads data from before the tiers as one tier, everything it has', () => {
    // B2a's belt.json: a file and a count, and no tier list.
    expect(beltTiers(INFO)).toEqual([
      { file: 'elements.bin', count: 3, bytes: 108, brightestH: null, faintestH: 15 },
    ]);
    expect(beltDensities(INFO)).toEqual([{ tiers: 1, count: 3, bytes: 108, faintestH: 15 }]);
  });

  it('offers every prefix of the tiers, counted and sized from belt.json', () => {
    expect(beltDensities(TIERED)).toEqual([
      { tiers: 1, count: 2, bytes: 72, faintestH: 15 },
      { tiers: 2, count: 3, bytes: 108, faintestH: 16 },
      { tiers: 3, count: 4, bytes: 144, faintestH: null },
    ]);
  });

  it('rejects tiers that do not add up, or misstate their size', () => {
    expect(() => parseBeltInfo({ ...TIERED, count: 5 })).toThrow(/tiers hold 4 asteroids, and it says 5/);
    const lying = TIERED.tiers!.map((tier, index) => (index === 1 ? { ...tier, bytes: 35 } : tier));
    expect(() => parseBeltInfo({ ...TIERED, tiers: lying })).toThrow(/tier 1 says 35 bytes/);
    const escaping = TIERED.tiers!.map((tier, index) => (index === 2 ? { ...tier, file: '../x' } : tier));
    expect(() => parseBeltInfo({ ...TIERED, tiers: escaping })).toThrow(/tier 2 does not name/);
    expect(() => parseBeltInfo({ ...TIERED, tiers: [] })).toThrow(/no tiers/);
  });
});

describe('countClasses', () => {
  it('counts each class code by its name', () => {
    const records = decodeBeltRecords(encode(RECORDS), 3);
    expect(countClasses(records, BELT_CLASSES)).toEqual({ MBA: 2, APO: 1 });
  });
});

describe('loading', () => {
  it('round-trips a belt written as the generator writes one', async () => {
    const fetchers = memoryFetchers({
      '/base/data/belt/belt.json': INFO,
      '/base/data/belt/elements.bin': encode(RECORDS),
    });

    const info = await loadBeltInfo(fetchers, '/base/');
    const records = await loadBeltTier(fetchers, beltTiers(info!)[0]!, '/base/');

    expect(fetchers.asked).toEqual(['/base/data/belt/belt.json', '/base/data/belt/elements.bin']);
    expect(info).toEqual(INFO);
    expect(Array.from(records)).toEqual(RECORDS.flat().map(Math.fround));
  });

  it('reads data with no belt as no belt, quietly', async () => {
    const note = vi.spyOn(console, 'info').mockImplementation(() => {});

    expect(await loadBeltInfo(memoryFetchers({}), '/')).toBeNull();
    // Said once, as a note rather than a warning: such data is old, not broken.
    expect(note).toHaveBeenCalledTimes(1);
  });

  it('rejects a tier belt.json names that is not there', async () => {
    const fetchers = memoryFetchers({});
    await expect(loadBeltTier(fetchers, beltTiers(INFO)[0]!)).rejects.toThrow(
      /elements.bin, which is not there/,
    );
  });

  it('rejects a tier whose file does not match its count', async () => {
    const fetchers = memoryFetchers({ '/data/belt/elements.bin': encode(RECORDS) });
    const tier = { ...beltTiers(INFO)[0]!, count: 4, bytes: 144 };
    await expect(loadBeltTier(fetchers, tier)).rejects.toThrow(/108 bytes/);
  });

  it('tells the fetch how big the tier is, so it can be read into one buffer', async () => {
    const fetchers = memoryFetchers({ '/data/belt/elements.bin': encode(RECORDS) });
    await loadBeltTier(fetchers, beltTiers(INFO)[0]!);
    expect(fetchers.expected).toEqual([108]);
  });
});

/** A source over the tiered belt, and every frame it asked for. */
function tieredSource(files: Record<string, unknown> = TIERED_FILES) {
  const fetchers = memoryFetchers(files);
  const settled = vi.fn();
  return { fetchers, settled, source: new BeltSource(fetchers, '/', settled) };
}

describe('BeltSource', () => {
  it('fetches nothing until asked', () => {
    const { fetchers, source } = tieredSource();
    expect(fetchers.asked).toEqual([]);
    expect(source.view.state).toBe('idle');
    expect(source.view.tiers).toEqual([]);
  });

  it('loads the prefix asked for, in order, each published as it lands', async () => {
    const { fetchers, settled, source } = tieredSource();
    const seen: number[] = [];
    source.subscribe(() => {
      const count = source.view.tiers.length;
      if (seen.at(-1) !== count) {
        seen.push(count);
      }
    });

    await source.request(2);

    expect(fetchers.asked).toEqual([
      '/data/belt/belt.json',
      '/data/belt/elements-0.bin',
      '/data/belt/elements-1.bin',
    ]);
    // Drawn one at a time: the first was in the view before the second was fetched.
    expect(seen).toEqual([0, 1, 2]);
    expect(source.view.tiers.map((tier) => tier.index)).toEqual([0, 1]);
    expect(source.view.state).toBe('ready');
    // A frame for each tier that changed what is drawn.
    expect(settled).toHaveBeenCalledTimes(2);
  });

  it('asks the first tier alone by default, and once however often it is asked', async () => {
    const { fetchers, source } = tieredSource();
    await Promise.all([source.request(1), source.request(1)]);
    await source.request(1);
    expect(fetchers.asked).toEqual(['/data/belt/belt.json', '/data/belt/elements-0.bin']);
  });

  it('takes more tiers than the data has as all of them', async () => {
    const { source } = tieredSource();
    await source.request(9);
    expect(source.view.tiers.length).toBe(3);
    expect(source.progress.wanted).toBe(3);
  });

  it('reads B2a data, with no tier list, as its one tier', async () => {
    const { fetchers, source } = tieredSource({
      '/data/belt/belt.json': INFO,
      '/data/belt/elements.bin': encode(RECORDS),
    });
    await source.request(3);
    expect(fetchers.asked).toEqual(['/data/belt/belt.json', '/data/belt/elements.bin']);
    expect(source.view.tiers.length).toBe(1);
    expect(source.view.tiers[0]!.classCounts).toEqual({ MBA: 2, APO: 1 });
  });

  it('lets go of the tiers past a lower density at once, and fetches nothing for it', async () => {
    const { fetchers, settled, source } = tieredSource();
    await source.request(3);
    const first = source.view.tiers[0];
    settled.mockClear();

    await source.request(1);

    expect(source.view.tiers.length).toBe(1);
    // The same first tier, not fetched again: the records are the ones already here.
    expect(source.view.tiers[0]).toBe(first);
    expect(fetchers.asked.length).toBe(4);
    // Letting go changes what is drawn, so it asks for a frame too.
    expect(settled).toHaveBeenCalledTimes(1);
    expect(source.progress).toEqual({
      wanted: 1,
      loaded: 1,
      bytesWanted: 72,
      bytesLoaded: 72,
      failed: false,
    });
  });

  it('releases down to a number without fetching up to it', async () => {
    const { fetchers, source } = tieredSource();
    await source.request(3);
    source.release(1);
    expect(source.view.tiers.length).toBe(1);
    source.release(2);
    expect(source.view.tiers.length).toBe(1);
    expect(fetchers.asked.length).toBe(4);
  });

  it('aborts a tier on its way when the density drops below it', async () => {
    const gate = deferred();
    const { fetchers, source } = tieredSource();
    fetchers.hold('/data/belt/elements-1.bin', gate.promise);

    const loading = source.request(2);
    await vi.waitFor(() => expect(fetchers.asked).toContain('/data/belt/elements-1.bin'));
    source.release(1);
    gate.resolve();
    await loading;

    expect(fetchers.aborted).toEqual(['/data/belt/elements-1.bin']);
    expect(source.view.tiers.length).toBe(1);
    expect(source.view.state).toBe('ready');
    expect(source.progress.failed).toBe(false);
  });

  it('reports its progress in tiers and in bytes, the tier on its way included', async () => {
    const gate = deferred();
    const { fetchers, source } = tieredSource();
    fetchers.hold('/data/belt/elements-1.bin', gate.promise, 20);

    const loading = source.request(3);
    await vi.waitFor(() => expect(source.progress.loaded).toBe(1));
    // The first tier whole, nothing of the second yet: the step is a quarter megabyte.
    expect(source.progress).toEqual({
      wanted: 3,
      loaded: 1,
      bytesWanted: 144,
      bytesLoaded: 72,
      failed: false,
    });
    expect(source.view.state).toBe('loading');
    gate.resolve();
    await loading;

    expect(source.progress).toEqual({
      wanted: 3,
      loaded: 3,
      bytesWanted: 144,
      bytesLoaded: 144,
      failed: false,
    });
  });

  it('asks data with no belt once, and never again', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { fetchers, source } = tieredSource({});

    await source.request(1);
    await source.request(3);

    expect(source.view.state).toBe('absent');
    expect(source.view.tiers).toEqual([]);
    expect(fetchers.asked).toEqual(['/data/belt/belt.json']);
  });

  it('keeps what it has when a tier fails, and tries again after the delay', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const { fetchers, settled, source } = tieredSource();
    fetchers.failOnce('/data/belt/elements-1.bin');

    await source.request(2);
    expect(source.view.state).toBe('failed');
    expect(source.progress.failed).toBe(true);
    expect(source.view.tiers.length).toBe(1);
    // A failure shows too: the scene carries on with what it has.
    expect(settled).toHaveBeenCalledTimes(2);

    await source.request(2);
    expect(fetchers.asked.filter((path) => path.endsWith('-1.bin')).length).toBe(1);

    now.mockReturnValue(1_000_000 + RETRY_AFTER_MS + 1);
    await source.request(2);
    expect(source.view.tiers.length).toBe(2);
    expect(source.view.state).toBe('ready');
  });

  it('tries again at once when told to', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { fetchers, source } = tieredSource();
    fetchers.failOnce('/data/belt/elements-0.bin');

    await source.request(1);
    expect(source.progress.failed).toBe(true);
    await source.retry();
    expect(source.view.tiers.length).toBe(1);
    expect(source.progress.failed).toBe(false);
  });
});

/**
 * The generated belt, when there is one: the files as they were written, read through
 * the app's own loader -- every tier of them.
 */
const DATA_ROOT = join(import.meta.dirname, '../../public');

async function readOrNull<T>(path: string, read: (file: string) => Promise<T>): Promise<T | null> {
  try {
    return await read(join(DATA_ROOT, path));
  } catch {
    return null;
  }
}

const diskFetchers: BeltFetchers = {
  json: (path) =>
    readOrNull(path, async (file) => JSON.parse(await readFile(file, 'utf8')) as unknown),
  binary: (path) =>
    readOrNull(path, async (file) => {
      const bytes = await readFile(file);
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    }),
};

interface Generated {
  readonly info: BeltInfo;
  readonly tiers: readonly Float32Array[];
}

async function tryLoad(): Promise<Generated | null> {
  try {
    const info = await loadBeltInfo(diskFetchers, '/');
    if (info === null) {
      return null;
    }
    const tiers = await Promise.all(beltTiers(info).map((tier) => loadBeltTier(diskFetchers, tier)));
    return { info, tiers };
  } catch {
    return null;
  }
}

vi.spyOn(console, 'info').mockImplementation(() => {});
const generated = await tryLoad();
vi.restoreAllMocks();
const describeWithData = withData(generated !== null);

describeWithData('the generated belt', () => {
  const { info, tiers } = generated!;
  const at = (records: Float32Array, index: number, element: keyof typeof RECORD) =>
    records[index * RECORD_FLOATS + RECORD[element]]!;

  it('holds in its tiers exactly the classes belt.json counts', () => {
    const counted: Record<string, number> = {};
    for (const records of tiers) {
      for (const [name, count] of Object.entries(countClasses(records, info.classes))) {
        counted[name] = (counted[name] ?? 0) + count;
      }
    }
    expect(counted).toEqual(info.classCounts);
    expect(info.classes).toEqual([...BELT_CLASSES]);
  });

  it('is ordered brightest first, each tier inside its own magnitudes', () => {
    let previous = -Infinity;
    for (const [index, tier] of beltTiers(info).entries()) {
      const records = tiers[index]!;
      for (let k = 0; k < tier.count; k += 1) {
        const H = at(records, k, 'H');
        const below = tier.faintestH === null || H < tier.faintestH + 1e-4;
        const above = tier.brightestH === null || H >= tier.brightestH - 1e-4;
        if (H < previous || !below || !above) {
          throw new Error(`Tier ${index}, asteroid ${k}: H ${H} after ${previous}.`);
        }
        previous = H;
      }
    }
  });

  it('has every element in its range', () => {
    for (const records of tiers) {
      for (let k = 0; k < records.length / RECORD_FLOATS; k += 1) {
        const M = at(records, k, 'M');
        const cls = at(records, k, 'class');
        const i = at(records, k, 'i');
        // [-π, π): perihelion at zero, where float32 is finest. See BELT_RECORD_FLOATS.
        if (!(M >= -Math.fround(Math.PI) && M <= Math.fround(Math.PI)) || !(i >= 0 && i <= Math.PI)) {
          throw new Error(`Asteroid ${k}: M = ${M}, i = ${i}.`);
        }
        if (!Number.isInteger(cls) || cls < 0 || cls >= BELT_CLASSES.length || at(records, k, 'n') <= 0) {
          throw new Error(`Asteroid ${k}: class ${cls}, n = ${at(records, k, 'n')}.`);
        }
      }
    }
  });

  it('has a mean motion that agrees with its semi-major axis', () => {
    // Kepler's third law about the Sun alone: n = sqrt(GM / a^3). The asteroid's own
    // mass is nothing next to it, so this is a check on units -- km and rad/day -- that a
    // swapped column or a degree left unconverted would fail by orders of magnitude.
    // Not tighter: SBDB's own n for a few detached objects hundreds of AU out sits up to
    // 3e-4 off this, and the shader uses SBDB's.
    const GM_SUN = 1.32712440041e11; // km^3/s^2, DE441
    for (const records of tiers) {
      for (let k = 0; k < records.length / RECORD_FLOATS; k += 1) {
        const n = Math.sqrt(GM_SUN / at(records, k, 'a') ** 3) * 86_400;
        if (!(Math.abs(at(records, k, 'n') / n - 1) < 1e-3)) {
          throw new Error(`Asteroid ${k}: n = ${at(records, k, 'n')} rad/day, a says ${n}.`);
        }
      }
    }
  });
});
