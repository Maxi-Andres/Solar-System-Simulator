import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HorizonsResponse } from './client.ts';
import {
  horizonsCacheDirectory,
  horizonsCacheKey,
  horizonsCacheStats,
  latestInstant,
  pruneHorizonsCache,
  refreshPhaseMs,
  resetHorizonsCacheStats,
  reusable,
  stillFresh,
  throughHorizonsCache,
  useHorizonsCache,
} from './responseCache.ts';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 21, 6, 0);

/** A vector query ending `daysAgo` before NOW, as queries.ts writes one. */
function query(daysAgo: number, command = '-96'): Record<string, string> {
  const stop = new Date(NOW - daysAgo * DAY);
  const start = new Date(stop.getTime() - DAY);
  const at = (date: Date) => `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 16)}`;
  return {
    COMMAND: command,
    CENTER: '500@0',
    EPHEM_TYPE: 'VECTORS',
    START_TIME: at(start),
    STOP_TIME: at(new Date(Math.floor(stop.getTime() / 60_000) * 60_000)),
    STEP_SIZE: '1m',
  };
}

function answer(text: string): HorizonsResponse {
  return { signature: { source: 'NASA/JPL Horizons API', version: '1.2' }, result: text };
}

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'horizons-cache-'));
  useHorizonsCache(directory);
  resetHorizonsCacheStats();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
  useHorizonsCache(undefined);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('latestInstant', () => {
  it('reads STOP_TIME to the minute, and the latest of a TLIST', () => {
    expect(latestInstant({ STOP_TIME: '2018-11-01 12:34' })?.toISOString()).toBe('2018-11-01T12:34:00.000Z');
    expect(latestInstant({ STOP_TIME: '2018-11-01' })?.toISOString()).toBe('2018-11-01T00:00:00.000Z');
    // JD 2451545.0 is 2000-01-01 12:00.
    expect(latestInstant({ TLIST: '2451544.0 2451545.000000' })?.toISOString()).toBe('2000-01-01T12:00:00.000Z');
  });

  it('dates nothing it cannot read, so it is never kept', () => {
    expect(latestInstant({ COMMAND: 'MB' })).toBeNull();
    expect(latestInstant({ STOP_TIME: 'JD 2451545' })).toBeNull();
    expect(latestInstant({ TLIST: '' })).toBeNull();
    expect(latestInstant({ TLIST: 'now' })).toBeNull();
  });
});

describe('reusable', () => {
  it('only a query ending at least 90 days ago', () => {
    expect(reusable(query(91), NOW)).toBe(true);
    expect(reusable(query(89), NOW)).toBe(false);
    expect(reusable(query(0), NOW)).toBe(false);
    expect(reusable(query(-400), NOW)).toBe(false);
  });

  it('never the elements at the run, the major-body list, or a probe of the far future', () => {
    expect(reusable({ COMMAND: '399', TLIST: (NOW / DAY + 2440587.5).toFixed(6) }, NOW)).toBe(false);
    expect(reusable({ COMMAND: 'MB' }, NOW)).toBe(false);
    expect(reusable({ COMMAND: '-96', START_TIME: '2200-01-01 00:00', STOP_TIME: '2200-01-02 00:00' }, NOW)).toBe(false);
    expect(reusable({ COMMAND: '-96', START_TIME: '1900-01-01 00:00', STOP_TIME: '1900-01-02 00:00' }, NOW)).toBe(true);
  });
});

describe('stillFresh', () => {
  it('holds within the body\'s 28-day period and never past it', () => {
    const params = query(200);
    const phase = refreshPhaseMs(params);
    // The start of this body's current period.
    const periodStart = Math.floor((NOW + phase) / (28 * DAY)) * 28 * DAY - phase;
    expect(stillFresh(params, periodStart, periodStart + 27 * DAY)).toBe(true);
    expect(stillFresh(params, periodStart, periodStart + 28 * DAY)).toBe(false);
    expect(stillFresh(params, periodStart - 1, periodStart + 1)).toBe(false);
    // Nothing fetched in the future, whatever the clock did.
    expect(stillFresh(params, NOW + DAY, NOW)).toBe(false);
  });

  it('turns over every query about one body together, whatever its window', () => {
    const a = query(100);
    const b = { ...query(3000), STEP_SIZE: '1d' };
    expect(refreshPhaseMs(a)).toBe(refreshPhaseMs(b));
    expect(refreshPhaseMs(a)).not.toBe(refreshPhaseMs(query(100, '-121')));
  });
});

describe('horizonsCacheKey', () => {
  it('is the exact query, in any order', () => {
    expect(horizonsCacheKey({ A: '1', B: '2' })).toBe(horizonsCacheKey({ B: '2', A: '1' }));
    expect(horizonsCacheKey({ A: '1', B: '2' })).not.toBe(horizonsCacheKey({ A: '1', B: '3' }));
  });
});

describe('throughHorizonsCache', () => {
  it('asks once for the far past, then answers from what it kept, the same answer', async () => {
    const ask = vi.fn(async () => answer('$$SOE\n1,2,3\n$$EOE'));
    const first = await throughHorizonsCache(query(400), ask, NOW);
    const second = await throughHorizonsCache(query(400), ask, NOW + DAY);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(horizonsCacheStats()).toEqual({ hits: 1, stored: 1, live: 0 });
  });

  it('always asks for anything near the present, and keeps nothing of it', async () => {
    const ask = vi.fn(async () => answer('recent'));
    await throughHorizonsCache(query(10), ask, NOW);
    await throughHorizonsCache(query(10), ask, NOW);
    expect(ask).toHaveBeenCalledTimes(2);
    expect(readdirSync(directory)).toEqual([]);
    expect(horizonsCacheStats().live).toBe(2);
  });

  it('asks again once the body\'s period has turned, and keeps the new answer', async () => {
    let n = 0;
    const ask = vi.fn(async () => answer(`answer ${(n += 1)}`));
    const params = query(400);
    expect((await throughHorizonsCache(params, ask, NOW)).result).toBe('answer 1');
    expect((await throughHorizonsCache(params, ask, NOW + 28 * DAY)).result).toBe('answer 2');
    expect((await throughHorizonsCache(params, ask, NOW + 28 * DAY + 1)).result).toBe('answer 2');
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('keeps nothing when the question fails', async () => {
    await expect(
      throughHorizonsCache(query(400), async () => Promise.reject(new Error('503')), NOW),
    ).rejects.toThrow('503');
    expect(readdirSync(directory)).toEqual([]);
  });

  it('throws away a kept file that does not read, and asks again', async () => {
    const ask = vi.fn(async () => answer('good'));
    await throughHorizonsCache(query(400), ask, NOW);
    const [file] = readdirSync(directory);
    writeFileSync(join(directory, file!), 'not gzip');
    expect((await throughHorizonsCache(query(400), ask, NOW)).result).toBe('good');
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('keeps nothing with the cache off', async () => {
    useHorizonsCache(null);
    const ask = vi.fn(async () => answer('x'));
    await throughHorizonsCache(query(400), ask, NOW);
    await throughHorizonsCache(query(400), ask, NOW);
    expect(ask).toHaveBeenCalledTimes(2);
  });
});

describe('horizonsCacheDirectory', () => {
  it('is off under vitest unless named, and off when HORIZONS_CACHE=off', () => {
    useHorizonsCache(undefined);
    vi.stubEnv('HORIZONS_CACHE', '');
    expect(horizonsCacheDirectory()).toBeNull();
    vi.stubEnv('HORIZONS_CACHE', 'off');
    expect(horizonsCacheDirectory()).toBeNull();
    vi.stubEnv('HORIZONS_CACHE', directory);
    expect(horizonsCacheDirectory()).toBe(directory);
  });
});

describe('pruneHorizonsCache', () => {
  it('drops what this run did not use, and keeps what it did', async () => {
    const ask = async () => answer('x'.repeat(100));
    await throughHorizonsCache(query(400), ask, NOW);
    await throughHorizonsCache(query(500), ask, NOW);
    // A file from an earlier run this one never asked about.
    writeFileSync(join(directory, 'stale.json.gz'), 'old');
    resetHorizonsCacheStats();
    await throughHorizonsCache(query(400), ask, NOW);

    const left = await pruneHorizonsCache();
    expect(left).toMatchObject({ files: 1, removed: 2 });
    expect(readdirSync(directory)).toHaveLength(1);
    expect(existsSync(join(directory, 'stale.json.gz'))).toBe(false);
  });

  it('drops the oldest past the size cap', async () => {
    const ask = async () => answer(Math.random().toString(36).repeat(2000));
    await throughHorizonsCache(query(400), ask, NOW);
    await throughHorizonsCache(query(500), ask, NOW);
    const left = await pruneHorizonsCache(0);
    expect(left).toMatchObject({ files: 0, bytes: 0, removed: 2 });
  });
});
