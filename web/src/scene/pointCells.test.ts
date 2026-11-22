import { describe, expect, it } from 'vitest';

import { cellCandidates, pointCells } from './pointCells.ts';

/** The grid only narrows (pointCells.ts): every point within its reach is among those handed back. */

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('pointCells', () => {
  const next = random(5);
  const stride = 4;
  const count = 5000;
  const records = new Float32Array(count * stride);
  const weight = new Float32Array(count);
  for (let k = 0; k < count; k += 1) {
    // Clustered, as galaxies are: most near a few centres, some anywhere.
    const centre = next() < 0.7 ? [Math.floor(next() * 4) * 1e8 - 2e8, 0, 0] : [0, 0, 0];
    records[k * stride] = centre[0]! + (next() - 0.5) * 4e8;
    records[k * stride + 1] = (next() - 0.5) * 4e8;
    records[k * stride + 2] = (next() - 0.5) * 1e8;
    weight[k] = next() < 0.1 ? 0 : 1e3 + next() ** 4 * 1e5;
  }
  const subset = Array.from({ length: count }, (_, k) => k).filter((k) => k % 3 !== 0);
  const grid = pointCells(records, stride, subset, count, (k) => weight[k]!);

  it('holds each point once', () => {
    expect(grid.items.length).toBe(subset.length);
    expect([...grid.items].sort((a, b) => a - b)).toEqual(subset);
  });

  it('hands back every point within its weight times the reach, and only points it holds', () => {
    const out = new Int32Array(subset.length);
    for (let trial = 0; trial < 60; trial += 1) {
      const camera: [number, number, number] = [(next() - 0.5) * 5e8, (next() - 0.5) * 5e8, (next() - 0.5) * 2e8];
      const reachPerWeight = 10 ** (next() * 4);
      const n = cellCandidates(grid, camera, reachPerWeight, out);
      const found = new Set(out.subarray(0, n));
      expect(found.size).toBe(n);
      for (const k of subset) {
        const d = Math.hypot(records[k * stride]! - camera[0], records[k * stride + 1]! - camera[1], records[k * stride + 2]! - camera[2]);
        if (d < weight[k]! * reachPerWeight) expect(found.has(k)).toBe(true);
      }
      for (const k of found) expect(k % 3).not.toBe(0);
    }
  });

  it('keeps each cell ascending, as given', () => {
    for (let c = 0; c + 1 < grid.start.length; c += 1) {
      for (let i = grid.start[c]! + 1; i < grid.start[c + 1]!; i += 1) expect(grid.items[i]!).toBeGreaterThan(grid.items[i - 1]!);
    }
  });

  it('narrows nothing for a reach or a camera that is not a number', () => {
    const out = new Int32Array(subset.length);
    expect(cellCandidates(grid, [0, 0, 0], Number.NaN, out)).toBe(subset.length);
    expect(cellCandidates(grid, [Number.NaN, 0, 0], 1, out)).toBe(subset.length);
    expect(cellCandidates(grid, [0, 0, 0], Infinity, out)).toBe(subset.length);
  });

  it('hands back a point that is not a place to every question, for the caller to test', () => {
    const r = new Float32Array([0, 0, 0, 0, Number.NaN, 0, 0, 0, 1e9, 1e9, 1e9, 0]);
    const g = pointCells(r, 4, null, 3, () => 1);
    const out = new Int32Array(3);
    const n = cellCandidates(g, [1e9, 1e9, 1e9], 1, out);
    expect(Array.from(out.subarray(0, n)).sort()).toEqual([1, 2]);
  });
});
