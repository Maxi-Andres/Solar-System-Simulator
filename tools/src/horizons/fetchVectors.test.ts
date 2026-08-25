import { describe, expect, it } from 'vitest';

import type { VectorTable } from '../types.ts';
import { retryDelayMs } from './client.ts';
import { concatTables, planChunks } from './fetchVectors.ts';

/**
 * Regression tests for the CI failure where Horizons returned 503 four times for
 * Mercury while every other body succeeded.
 *
 * Mercury's request was 1.4 MB and three seconds — twenty-eight times Neptune's —
 * because it samples daily across twenty years. Splitting the window keeps every
 * request ordinary, and the seams must be invisible: a stitched table has to be
 * indistinguishable from one fetched whole.
 */

const START = new Date('2016-08-25T00:00:00Z');
const STOP = new Date('2036-08-26T00:00:00Z');

describe('planChunks', () => {
  it('leaves a small request in one piece', () => {
    // Neptune: 32-day step over twenty years is 229 samples.
    const chunks = planChunks(START, STOP, 32);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.start).toEqual(START);
    expect(chunks[0]!.stop).toEqual(STOP);
  });

  it('splits the request that actually failed in CI', () => {
    // Mercury: 1-day step, 7307 samples.
    const chunks = planChunks(START, STOP, 1);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      const samples = (chunk.stop.getTime() - chunk.start.getTime()) / 86_400_000 + 1;
      expect(samples).toBeLessThanOrEqual(1500);
    }
  });

  it('covers the whole window, start to finish, with no holes', () => {
    for (const stepDays of [1, 2, 4, 8, 32]) {
      const chunks = planChunks(START, STOP, stepDays);

      expect(chunks[0]!.start.getTime()).toBe(START.getTime());
      expect(chunks.at(-1)!.stop.getTime()).toBe(STOP.getTime());

      // Each chunk begins exactly where the previous one ended: adjacent, never
      // overlapping by more than the shared boundary and never leaving a gap.
      for (let i = 1; i < chunks.length; i += 1) {
        expect(chunks[i]!.start.getTime()).toBe(chunks[i - 1]!.stop.getTime());
      }
    }
  });

  it('puts every boundary on the sampling grid', () => {
    // Off-grid boundaries would make the stitched series unevenly spaced, which the
    // interpolator's binary search assumes it is not.
    for (const stepDays of [1, 2, 4]) {
      for (const chunk of planChunks(START, STOP, stepDays)) {
        const offsetDays = (chunk.start.getTime() - START.getTime()) / 86_400_000;
        expect(offsetDays % stepDays).toBe(0);
      }
    }
  });

  it('respects a custom sample ceiling', () => {
    const chunks = planChunks(START, STOP, 1, 100);

    for (const chunk of chunks) {
      const samples = (chunk.stop.getTime() - chunk.start.getTime()) / 86_400_000 + 1;
      expect(samples).toBeLessThanOrEqual(100);
    }
  });
});

/** Builds a table of `count` samples starting at `t0`, one day apart. */
function table(t0: number, count: number): VectorTable {
  const make = (scale: number): number[] =>
    Array.from({ length: count }, (_, i) => (t0 + i) * scale);

  return {
    id: 'test',
    horizonsId: '0',
    center: '500@0',
    count,
    t: Array.from({ length: count }, (_, i) => t0 + i),
    x: make(10),
    y: make(20),
    z: make(30),
    vx: make(0.1),
    vy: make(0.2),
    vz: make(0.3),
  };
}

describe('concatTables', () => {
  it('returns a single table untouched', () => {
    const one = table(2461000.5, 5);
    expect(concatTables([one])).toBe(one);
  });

  it('drops the sample the chunks share at their seam', () => {
    // Chunk boundaries are inclusive at both ends, so the boundary instant arrives
    // twice. Keeping both would break the strictly-increasing invariant the
    // interpolator relies on.
    const joined = concatTables([table(100, 5), table(104, 5)]);

    expect(joined.count).toBe(9);
    expect(joined.t).toEqual([100, 101, 102, 103, 104, 105, 106, 107, 108]);
  });

  it('is indistinguishable from fetching the range whole', () => {
    const whole = table(0, 12);
    const stitched = concatTables([table(0, 5), table(4, 5), table(8, 4)]);

    expect(stitched.count).toBe(whole.count);
    expect(stitched.t).toEqual(whole.t);
    expect(stitched.x).toEqual(whole.x);
    expect(stitched.vz).toEqual(whole.vz);
  });

  it('keeps time strictly increasing across every seam', () => {
    const joined = concatTables([table(0, 4), table(3, 4), table(6, 4)]);

    for (let i = 1; i < joined.count; i += 1) {
      expect(joined.t[i]!).toBeGreaterThan(joined.t[i - 1]!);
    }
  });

  it('refuses chunks that arrive out of order', () => {
    expect(() => concatTables([table(100, 5), table(50, 5)])).toThrow(/out of order/);
  });

  it('rejects an empty list rather than returning something empty', () => {
    expect(() => concatTables([])).toThrow(/empty list/);
  });
});

describe('retryDelayMs', () => {
  it('backs off exponentially', () => {
    // Jittered, so compare the ranges rather than exact values.
    const first = retryDelayMs(1, null);
    const third = retryDelayMs(3, null);

    expect(first).toBeGreaterThanOrEqual(1500);
    expect(first).toBeLessThanOrEqual(2500);
    expect(third).toBeGreaterThanOrEqual(6000);
    expect(third).toBeLessThanOrEqual(10_000);
  });

  it('caps the wait so a run cannot hang indefinitely', () => {
    expect(retryDelayMs(20, null)).toBeLessThanOrEqual(45_000);
  });

  it('jitters, so shared CI runners do not retry in lockstep', () => {
    const samples = new Set(Array.from({ length: 20 }, () => retryDelayMs(3, null)));

    expect(samples.size).toBeGreaterThan(1);
  });

  it('honours Retry-After when the server sends one', () => {
    expect(retryDelayMs(1, 12)).toBe(12_000);
    // ...but still bounded.
    expect(retryDelayMs(1, 9999)).toBe(45_000);
  });
});
