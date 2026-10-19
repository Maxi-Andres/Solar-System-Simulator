import type { TableInfo, VectorTable } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import {
  BYTES_PER_SAMPLE,
  ChunkBudget,
  ChunkedTable,
  RETRY_AFTER_MS,
  samplesBetween,
} from './chunkedTable.ts';

/**
 * A straight-line body sampled once a day, split into chunks of `size` samples that
 * share their boundary sample -- the layout the generator writes.
 */
function fixture(chunkCount: number, size = 11): { info: TableInfo; tables: VectorTable[] } {
  const tables: VectorTable[] = [];
  for (let c = 0; c < chunkCount; c += 1) {
    const t = Array.from({ length: size }, (_, i) => 1000 + c * (size - 1) + i);
    // x = 86400 km per day, so the velocity is exactly 1 km/s and Hermite is exact.
    tables.push({
      id: 'probe',
      horizonsId: '0',
      center: '500@0',
      count: size,
      t,
      x: t.map((day) => (day - 1000) * 86_400),
      y: t.map(() => 0),
      z: t.map(() => 0),
      vx: t.map(() => 1),
      vy: t.map(() => 0),
      vz: t.map(() => 0),
    });
  }
  return {
    info: {
      startJd: tables[0]!.t[0]!,
      stopJd: tables.at(-1)!.t.at(-1)!,
      chunks: tables.map((table) => ({
        startJd: table.t[0]!,
        stopJd: table.t.at(-1)!,
        count: table.count,
      })),
    },
    tables,
  };
}

/** A loader that records requests and lets the test decide when each one lands. */
function controlledLoader(tables: readonly VectorTable[]) {
  const requested: number[] = [];
  const settle = new Map<number, { resolve: () => void; reject: () => void }>();
  const load = (_id: string, index: number): Promise<VectorTable> => {
    requested.push(index);
    return new Promise((resolve, reject) => {
      settle.set(index, {
        resolve: () => resolve(tables[index]!),
        reject: () => reject(new Error('404')),
      });
    });
  };
  return { load, requested, settle };
}

describe('ChunkedTable', () => {
  it('finds the chunk for an instant, including on the seams', () => {
    const { info } = fixture(3);
    const table = new ChunkedTable('probe', info, null);

    expect(table.indexAt(1000)).toBe(0);
    expect(table.indexAt(1005.5)).toBe(0);
    // 1010 is the last sample of chunk 0 and the first of chunk 1: either answers it.
    expect(table.indexAt(1010)).toBe(1);
    expect(table.indexAt(1029.9)).toBe(2);
    expect(table.indexAt(1030)).toBe(2);
    expect(table.indexAt(999.9)).toBe(-1);
    expect(table.indexAt(1030.1)).toBe(-1);
  });

  it('answers nothing until the chunk arrives, then the exact state', async () => {
    const { info, tables } = fixture(3);
    const loader = controlledLoader(tables);
    const table = new ChunkedTable('probe', info, loader.load);

    expect(table.stateAt(1015.5)).toBeNull();
    loader.settle.get(1)!.resolve();
    await table.whenLoadedAt(1015.5);

    const state = table.stateAt(1015.5)!;
    expect(state.position.x).toBeCloseTo(15.5 * 86_400, 6);
    expect(state.velocity.x).toBeCloseTo(1, 9);
  });

  it('asks once per chunk, however many frames want it', () => {
    const { info, tables } = fixture(3);
    const loader = controlledLoader(tables);
    const table = new ChunkedTable('probe', info, loader.load);

    for (let frame = 0; frame < 60; frame += 1) {
      table.stateAt(1015.5);
    }
    expect(loader.requested).toEqual([1]);
  });

  it('fetches the next chunk ahead of the clock, and not from the middle', async () => {
    const { info, tables } = fixture(3);
    const loader = controlledLoader(tables);
    const table = new ChunkedTable('probe', info, loader.load);

    table.stateAt(1015);
    loader.settle.get(1)!.resolve();
    await table.whenLoadedAt(1015);

    // Middle of chunk 1: nothing more.
    table.stateAt(1015);
    expect(loader.requested).toEqual([1]);

    // Into its last quarter: chunk 2 is asked for before the clock gets there.
    table.stateAt(1018);
    expect(loader.requested).toEqual([1, 2]);

    // Into its first quarter, running backwards: chunk 0.
    table.stateAt(1011);
    expect(loader.requested).toEqual([1, 2, 0]);
  });

  it('waits after a failure rather than asking sixty times a second', async () => {
    const { info, tables } = fixture(2);
    const loader = controlledLoader(tables);
    let now = 0;
    const table = new ChunkedTable('probe', info, loader.load, () => now);

    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => errors.push(args);
    try {
      table.stateAt(1005);
      loader.settle.get(0)!.reject();
      await table.whenLoadedAt(1005);

      table.stateAt(1005);
      expect(loader.requested).toEqual([0]);
      expect(errors).toHaveLength(1);

      now += RETRY_AFTER_MS + 1;
      table.stateAt(1005);
      expect(loader.requested).toEqual([0, 0]);
    } finally {
      console.error = original;
    }
  });

  it('refuses to be built from a table shipped whole', () => {
    expect(
      () => new ChunkedTable('probe', { startJd: 0, stopJd: 1, chunks: null }, null),
    ).toThrow(/not a chunked table/);
  });
});

describe('samples over a stretch of time', () => {
  it('joins chunks on their shared sample, keeping it once', () => {
    const { tables } = fixture(3);
    // Chunks span 1000..1010, 1010..1020, 1020..1030.
    const joined = samplesBetween(tables, 1008.5, 1021.5)!;
    expect(joined.t).toEqual([
      1008, 1009, 1010, 1011, 1012, 1013, 1014, 1015, 1016, 1017, 1018, 1019, 1020, 1021, 1022,
    ]);
    expect(joined.count).toBe(15);
    expect(joined.x[0]).toBe(8 * 86_400);
  });

  it('starts and stops on samples when the stretch does', () => {
    const { tables } = fixture(1);
    expect(samplesBetween(tables, 1002, 1004)!.t).toEqual([1002, 1003, 1004]);
  });

  it('answers only from chunks already here, and asks for none', async () => {
    const { info, tables } = fixture(3);
    const { load, requested, settle } = controlledLoader(tables);
    const table = new ChunkedTable('probe', info, load);
    void table.request(1);
    settle.get(1)!.resolve();
    await table.request(1);
    expect(table.samplesIfLoaded(1012, 1014)!.t).toEqual([1012, 1013, 1014]);
    // Reaching back into chunk 0, which is not here.
    expect(table.samplesIfLoaded(1008, 1012)).toBeNull();
    expect(requested).toEqual([1]);
  });
});

describe('a budget for the chunks', () => {
  /** One fixture chunk, in bytes: eleven samples. */
  const CHUNK = 11 * BYTES_PER_SAMPLE;

  /** A loader that answers at once, from `tables`, and records what it was asked for. */
  function instantLoader(tables: readonly VectorTable[]) {
    const requested: number[] = [];
    const load = (_id: string, index: number): Promise<VectorTable> => {
      requested.push(index);
      return Promise.resolve(tables[index]!);
    };
    return { load, requested };
  }

  /** Lets every load already started land. */
  const settled = () => new Promise<void>((resolve) => setImmediate(resolve));

  /** One frame: the body placed at `jd`, then whatever that asked for allowed to land. */
  async function frame(table: ChunkedTable, jd: number) {
    let state = table.stateAt(jd);
    if (state === null) {
      await table.whenLoadedAt(jd);
      state = table.stateAt(jd);
    }
    await settled();
    return state;
  }

  it('stays within it as the clock runs through, never letting go the chunk in use', async () => {
    const { info, tables } = fixture(6);
    const budget = new ChunkBudget(2 * CHUNK);
    const { load, requested } = instantLoader(tables);
    const table = new ChunkedTable('probe', info, load, undefined, budget);

    const answers = new Map<number, unknown>();
    for (let jd = 1000; jd <= 1060; jd += 0.5) {
      answers.set(jd, await frame(table, jd));
      expect(answers.get(jd)).not.toBeNull();
      expect(table.isLoaded(table.indexAt(jd))).toBe(true);
      expect(budget.bytes).toBeLessThanOrEqual(budget.limitBytes);
    }
    // Each chunk once, the next one ahead of the clock, and never one twice.
    expect(requested).toEqual([0, 1, 2, 3, 4, 5]);
    // Two of six kept: the one in use and the one before it.
    expect([0, 1, 2, 3, 4, 5].filter((index) => table.isLoaded(index))).toEqual([4, 5]);

    // Back the other way: what was let go is fetched again, and answers the same.
    for (let jd = 1060; jd >= 1000; jd -= 0.5) {
      expect(await frame(table, jd)).toEqual(answers.get(jd));
      expect(budget.bytes).toBeLessThanOrEqual(budget.limitBytes);
    }
    expect(requested).toEqual([0, 1, 2, 3, 4, 5, 3, 2, 1, 0]);
  });

  it('goes over it rather than drop the chunk a body is placed with', async () => {
    const { info, tables } = fixture(3);
    const budget = new ChunkBudget(1);
    const table = new ChunkedTable('probe', info, instantLoader(tables).load, undefined, budget);

    expect(await frame(table, 1005)).not.toBeNull();
    // Into the last quarter: the next chunk lands, and nothing may make room for it.
    await frame(table, 1008);
    expect([table.isLoaded(0), table.isLoaded(1)]).toEqual([true, true]);
    expect(budget.bytes).toBe(2 * CHUNK);

    // On into chunk 1 and towards chunk 2: now chunk 0 is no longer in use, and goes.
    await frame(table, 1015);
    await frame(table, 1018);
    expect([table.isLoaded(0), table.isLoaded(1), table.isLoaded(2)]).toEqual([false, true, true]);
    expect(table.stateAt(1015)).not.toBeNull();
  });

  it('counts a chunk read for a trail as in use', async () => {
    const { info, tables } = fixture(4);
    const budget = new ChunkBudget(3 * CHUNK);
    const table = new ChunkedTable('probe', info, instantLoader(tables).load, undefined, budget);
    for (const index of [0, 1, 2]) {
      await table.request(index);
    }

    // Chunk 0 arrived first, but has just been read; chunk 1 has not been since it came.
    expect(table.samplesIfLoaded(1001, 1002)).not.toBeNull();
    await table.request(3);
    expect([0, 1, 2, 3].filter((index) => table.isLoaded(index))).toEqual([0, 2, 3]);

    // And the same for a single instant, as the stretch at a craft samples it.
    expect(table.stateIfLoaded(1025)).not.toBeNull();
    await table.request(1);
    expect([0, 1, 2, 3].filter((index) => table.isLoaded(index))).toEqual([1, 2, 3]);
    expect(budget.bytes).toBe(3 * CHUNK);
  });

  it('is one budget for every table, the least recently read going first', async () => {
    const { info, tables } = fixture(2);
    const budget = new ChunkBudget(3 * CHUNK);
    const a = new ChunkedTable('a', info, instantLoader(tables).load, undefined, budget);
    const b = new ChunkedTable('b', info, instantLoader(tables).load, undefined, budget);

    // Both bodies start in chunk 0 and move on to chunk 1; a's first chunk was read last
    // before b's.
    await frame(a, 1005);
    await frame(b, 1005);
    await frame(a, 1015);
    await frame(b, 1015);
    expect([a.isLoaded(0), a.isLoaded(1), b.isLoaded(0), b.isLoaded(1)]).toEqual([
      false,
      true,
      true,
      true,
    ]);
    expect(budget.bytes).toBe(3 * CHUNK);
  });

  it('keeps everything without one', async () => {
    const { info, tables } = fixture(4);
    const table = new ChunkedTable('probe', info, instantLoader(tables).load);
    for (let jd = 1000; jd <= 1040; jd += 1) {
      await frame(table, jd);
    }
    expect([0, 1, 2, 3].every((index) => table.isLoaded(index))).toBe(true);
  });
});
