import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { SATELLITE_REGIME_SHIFT, SATELLITE_TYPE_SHIFT } from '@sss/tools/types';
import { describe, expect, it, vi } from 'vitest';

import type { BeltFetchers } from './belt.ts';
import { describeWithData as withData } from './describeWithData.ts';
import { addNamedSatellites, bulkStateTeme, satelliteNow, satrecOf, sgp4At } from './satelliteBodies.ts';
import { makeStore } from './satelliteTestFixtures.ts';
import {
  checkSatelliteRecords,
  decodeSatelliteRecords,
  LazySource,
  loadSatelliteNames,
  loadSatellites,
  parseSatelliteInfo,
  REGIME_SHIFT,
  SAT,
  SATELLITE_FLOATS,
  TYPE_SHIFT,
  type Satellites,
} from './satellites.ts';
import { temeToEclipticMatrix } from './teme.ts';
import { utcToTdb } from './time.ts';

/** satellites.json's checks, the lazy source, and the generated data when there is any. */

const ARCSEC = Math.PI / (180 * 3600);

function info(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    referenceJdUtc: 2461334.5,
    groups: [],
    named: { file: 'named.json', count: 0 },
    names: { file: 'bulk-names.json' },
    sgp4: { file: 'sgp4.json', count: 0, thresholdKm: 50, windowDays: 3 },
    bulk: { file: 'bulk.bin', count: 2, bytes: 2 * SATELLITE_FLOATS * 4, recordFloats: SATELLITE_FLOATS },
    ...overrides,
  };
}

describe('satellites.json', () => {
  it('restates the generator’s shifts', () => {
    expect(REGIME_SHIFT).toBe(SATELLITE_REGIME_SHIFT);
    expect(TYPE_SHIFT).toBe(SATELLITE_TYPE_SHIFT);
  });

  it('is read when it is the shape the app expects', () => {
    expect(parseSatelliteInfo(info()).bulk.count).toBe(2);
  });

  it('is refused, loudly, when it is not', () => {
    expect(() => parseSatelliteInfo(info({ bulk: { file: 'bulk.bin', count: 2, bytes: 96, recordFloats: 11 } }))).toThrow(
      /11 floats/,
    );
    expect(() => parseSatelliteInfo(info({ bulk: { file: 'bulk.bin', count: 2, bytes: 95, recordFloats: 12 } }))).toThrow(
      /bytes/,
    );
    expect(() => parseSatelliteInfo(info({ named: { file: '../x.json' } }))).toThrow(/name its files/);
    expect(() => parseSatelliteInfo(info({ referenceJdUtc: 'soon' }))).toThrow(/given at/);
  });

  it('decodes records, and refuses one that is not on an orbit', () => {
    const records = new Float32Array(SATELLITE_FLOATS);
    records[SAT.a] = 6798;
    records[SAT.e] = 0.0007;
    expect(() => checkSatelliteRecords(records)).not.toThrow();
    expect(decodeSatelliteRecords(records.buffer, false)).toEqual(records);
    records[SAT.a] = 3000;
    expect(() => checkSatelliteRecords(records)).toThrow(/not on an orbit/);
    records[SAT.a] = 6798;
    records[SAT.ddM] = Number.NaN;
    expect(() => checkSatelliteRecords(records)).toThrow(/not a number/);
  });

  it('is no satellites at all when the data has none, said once', async () => {
    const quiet = vi.spyOn(console, 'info').mockImplementation(() => {});
    const none: BeltFetchers = { json: async () => null, binary: async () => null };
    expect(await loadSatellites(none, '/')).toBeNull();
    quiet.mockRestore();
  });
});

describe('a lazy source', () => {
  it('lets a second request wait on the first, rather than miss it', async () => {
    let release: (value: number) => void = () => {};
    const source = new LazySource<number>(
      () => new Promise<number>((resolve) => (release = resolve)),
      'a number',
      () => {},
    );
    const first = source.request();
    const second = source.request();
    release(7);
    await second;
    expect(source.value).toBe(7);
    await first;
    expect(source.state).toBe('ready');
  });
});

/** The generated satellites, when there are any, through the app's own loaders. */
const DATA_ROOT = join(import.meta.dirname, '../../public');

async function readOrNull<T>(path: string, read: (file: string) => Promise<T>): Promise<T | null> {
  try {
    return await read(join(DATA_ROOT, path));
  } catch {
    return null;
  }
}

const diskFetchers: BeltFetchers = {
  json: (path) => readOrNull(path, async (file) => JSON.parse(await readFile(file, 'utf8')) as unknown),
  binary: (path) =>
    readOrNull(path, async (file) => {
      const bytes = await readFile(file);
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    }),
};

async function tryLoad(): Promise<Satellites | null> {
  try {
    return await loadSatellites(diskFetchers, '/');
  } catch {
    return null;
  }
}

vi.spyOn(console, 'info').mockImplementation(() => {});
const generated = await tryLoad();
vi.restoreAllMocks();
const describeWithData = withData(generated !== null);

describeWithData('the generated satellites', () => {
  const satellites = generated!;
  const { info } = satellites;

  it("turns TEME into the ecliptic as the generator does: two implementations agree", () => {
    // The generator's one matrix for the reference instant against teme.ts's for the same
    // instant -- written apart, from the same theories.
    const mine = temeToEclipticMatrix(utcToTdb(info.referenceJdUtc));
    const theirs = info.frame.temeToEclipticJ2000;
    let worst = 0;
    for (let k = 0; k < 9; k += 1) {
      worst = Math.max(worst, Math.abs(mine[k]! - theirs[k]!));
    }
    expect(worst / ARCSEC).toBeLessThan(0.05);
  });

  it('places every named satellite and every one of the SGP4 tier at the reference', () => {
    for (const omm of [...satellites.named.map((s) => s.omm), ...satellites.sgp4.map((s) => s.omm)]) {
      const satrec = satrecOf(omm, omm.OBJECT_NAME);
      expect(satrec, omm.OBJECT_NAME).not.toBeNull();
      const teme = sgp4At(satrec!, info.referenceJdUtc);
      expect(teme, omm.OBJECT_NAME).not.toBeNull();
      expect(Math.hypot(teme!.position.x, teme!.position.y, teme!.position.z)).toBeGreaterThan(6378);
    }
  });

  it('has every bulk satellite above the ground at the reference, on the app’s model', () => {
    const out = new Float64Array(6);
    for (let k = 0; k < info.bulk.count; k += 1) {
      bulkStateTeme(satellites.records, k, 0, out);
      // Perigee can dip under the equatorial radius for a decaying object's last days;
      // anything at the centre would be a misread record.
      expect(Math.hypot(out[0]!, out[1]!, out[2]!)).toBeGreaterThan(6300);
    }
  });

  it('names every bulk record', async () => {
    const names = await loadSatelliteNames(diskFetchers, info, '/');
    expect(names.names.name).toHaveLength(info.bulk.count);
    expect(names.byNorad.size).toBe(info.bulk.count);
  });

  it('makes every named satellite a body, at a height it really flies at', () => {
    const store = makeStore();
    addNamedSatellites(store, satellites);
    const bodies = store.bodies.filter((body) => body.kind === 'satellite');
    expect(bodies).toHaveLength(info.named.count);
    const jd = utcToTdb(info.referenceJdUtc);
    for (const body of bodies) {
      expect(store.isCoveredAt(body.id, jd), body.name).toBe(true);
      const height = satelliteNow(body.id, jd)!.heightKm;
      // From the ISS's 420 km to a geostationary 35,786, and Molniya-like apogees past.
      expect(height, body.name).toBeGreaterThan(150);
      expect(height, body.name).toBeLessThan(400_000);
    }
  });

  it('counts its chips over every satellite', () => {
    expect(satellites.chips).toHaveLength(info.bulk.count);
    expect(satellites.namedChips).toHaveLength(info.named.count);
    expect(satellites.sgp4Chips).toHaveLength(info.sgp4.count);
  });
});
