import type { TableInfo, VectorTable } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import { ChunkedTable, RETRY_AFTER_MS } from './chunkedTable.ts';

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
