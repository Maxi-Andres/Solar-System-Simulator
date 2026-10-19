import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { BELT_CLASSES, BELT_RECORD_FLOATS, type BeltInfo } from '@sss/tools/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BeltSource,
  checkBeltRecords,
  decodeBeltRecords,
  loadBelt,
  parseBeltInfo,
  RECORD,
  RECORD_BYTES,
  RECORD_FLOATS,
  type Belt,
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

/** Fetchers over an in-memory directory; a path not in it is a 404. */
function memoryFetchers(files: Record<string, unknown>): BeltFetchers & { readonly asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    json: async (path) => {
      asked.push(path);
      return path in files ? files[path] : null;
    },
    binary: async (path) => {
      asked.push(path);
      return path in files ? (files[path] as ArrayBuffer) : null;
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

describe('loadBelt', () => {
  it('round-trips a belt written as the generator writes one', async () => {
    const fetchers = memoryFetchers({
      '/base/data/belt/belt.json': INFO,
      '/base/data/belt/elements.bin': encode(RECORDS),
    });

    const belt = await loadBelt(fetchers, '/base/');

    expect(fetchers.asked).toEqual(['/base/data/belt/belt.json', '/base/data/belt/elements.bin']);
    expect(belt!.info).toEqual(INFO);
    expect(Array.from(belt!.records)).toEqual(RECORDS.flat().map(Math.fround));
  });

  it('reads data with no belt as no belt, quietly', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    expect(await loadBelt(memoryFetchers({}), '/')).toBeNull();
    // Said once, as a note rather than a warning: such data is old, not broken.
    expect(info).toHaveBeenCalledTimes(1);
  });

  it('rejects a belt.json whose elements file is missing', async () => {
    const fetchers = memoryFetchers({ '/data/belt/belt.json': INFO });
    await expect(loadBelt(fetchers)).rejects.toThrow(/elements.bin, which is not there/);
  });

  it('rejects a belt whose file does not match its count', async () => {
    const fetchers = memoryFetchers({
      '/data/belt/belt.json': { ...INFO, count: 4 },
      '/data/belt/elements.bin': encode(RECORDS),
    });
    await expect(loadBelt(fetchers)).rejects.toThrow(/108 bytes/);
  });

  it('rejects a belt with another record length before fetching its elements', async () => {
    const fetchers = memoryFetchers({ '/data/belt/belt.json': { ...INFO, recordFloats: 10 } });
    await expect(loadBelt(fetchers)).rejects.toThrow(/10 floats/);
    expect(fetchers.asked).toEqual(['/data/belt/belt.json']);
  });
});

describe('BeltSource', () => {
  const BELT: Belt = { info: INFO, records: decodeBeltRecords(encode(RECORDS), 3) };

  it('fetches nothing until asked, and once however often it is asked', async () => {
    const load = vi.fn(async () => BELT);
    const settled = vi.fn();
    const source = new BeltSource(load, settled);

    expect(load).not.toHaveBeenCalled();
    expect(source.belt).toBeNull();

    await Promise.all([source.request(), source.request()]);
    await source.request();

    expect(load).toHaveBeenCalledTimes(1);
    expect(source.belt).toBe(BELT);
    expect(source.state).toBe('ready');
    // The arrival asks for a frame: the canvas renders on demand.
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('tells its listeners when the belt arrives', async () => {
    const source = new BeltSource(async () => BELT, () => {});
    const listener = vi.fn(() => {
      // Already there when they are told.
      expect(source.belt).toBe(BELT);
    });
    const unsubscribe = source.subscribe(listener);

    await source.request();

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('asks data with no belt once, and never again', async () => {
    const load = vi.fn(async () => null);
    const source = new BeltSource(load, () => {});

    await source.request();
    await source.request();

    expect(source.state).toBe('absent');
    expect(source.belt).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('logs a failure and tries again only after the retry delay', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const load = vi.fn<() => Promise<Belt | null>>().mockRejectedValueOnce(new Error('HTTP 503'));
    load.mockResolvedValue(BELT);
    const settled = vi.fn();
    const source = new BeltSource(load, settled);

    await source.request();
    expect(source.state).toBe('failed');
    // A failure shows too: the scene carries on without the belt.
    expect(settled).toHaveBeenCalledTimes(1);

    await source.request();
    expect(load).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_000_000 + RETRY_AFTER_MS + 1);
    await source.request();
    expect(load).toHaveBeenCalledTimes(2);
    expect(source.belt).toBe(BELT);
  });
});

/**
 * The generated belt, when there is one: the file as it was written, read through the
 * app's own loader.
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

async function tryLoad(): Promise<Belt | null> {
  try {
    return await loadBelt(diskFetchers, '/');
  } catch {
    return null;
  }
}

vi.spyOn(console, 'info').mockImplementation(() => {});
const generated = await tryLoad();
vi.restoreAllMocks();
const describeWithData = withData(generated !== null);

describeWithData('the generated belt', () => {
  const { info, records } = generated!;
  const at = (index: number, element: keyof typeof RECORD) =>
    records[index * RECORD_FLOATS + RECORD[element]]!;

  it('holds as many asteroids as its classes add up to', () => {
    const total = Object.values(info.classCounts).reduce((sum, count) => sum + (count ?? 0), 0);
    expect(total).toBe(info.count);
    expect(info.classes).toEqual([...BELT_CLASSES]);
  });

  it('is ordered brightest first, and stops at its limit', () => {
    for (let k = 1; k < info.count; k += 1) {
      if (at(k, 'H') < at(k - 1, 'H')) {
        throw new Error(`Asteroid ${k} (H ${at(k, 'H')}) is brighter than the one before it.`);
      }
    }
    expect(at(info.count - 1, 'H')).toBeLessThan(info.magnitudeLimit + 1e-4);
  });

  it('has every element in its range', () => {
    for (let k = 0; k < info.count; k += 1) {
      const M = at(k, 'M');
      const cls = at(k, 'class');
      const i = at(k, 'i');
      // [-π, π): perihelion at zero, where float32 is finest. See BELT_RECORD_FLOATS.
      if (!(M >= -Math.fround(Math.PI) && M <= Math.fround(Math.PI)) || !(i >= 0 && i <= Math.PI)) {
        throw new Error(`Asteroid ${k}: M = ${M}, i = ${i}.`);
      }
      if (!Number.isInteger(cls) || cls < 0 || cls >= BELT_CLASSES.length || at(k, 'n') <= 0) {
        throw new Error(`Asteroid ${k}: class ${cls}, n = ${at(k, 'n')}.`);
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
    for (let k = 0; k < info.count; k += 1) {
      const n = Math.sqrt(GM_SUN / at(k, 'a') ** 3) * 86_400;
      if (!(Math.abs(at(k, 'n') / n - 1) < 1e-3)) {
        throw new Error(`Asteroid ${k}: n = ${at(k, 'n')} rad/day, a says ${n}.`);
      }
    }
  });
});
