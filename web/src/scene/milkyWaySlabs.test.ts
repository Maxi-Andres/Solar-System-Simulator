import { describe, expect, it } from 'vitest';

import { sampleMilkyWay } from '../core/milkyWay.ts';
import { DEPTH_SLICES, GALAXY_DEPTH_PC, SLAB_BLEND } from './MilkyWay.tsx';
import { binIntoCubes, CUBE_PC, reaches, reorder, slabRanges, slabReach, slabSpan, SLABS_UNCHANGED, type SlabReach } from './milkyWaySlabs.ts';

/** The vertex shader's share of slab `k` for a point `distancePc` from the camera (MilkyWay.tsx). */
function share(distancePc: number, k: number, nearest: number, step: number): number {
  const u = (distancePc - nearest) / step;
  const clamp = (x: number): number => Math.min(1, Math.max(0, x));
  const below = k === 0 ? 1 : clamp((u - k + SLAB_BLEND) / (2 * SLAB_BLEND));
  const above = k === DEPTH_SLICES - 1 ? 0 : clamp((u - k - 1 + SLAB_BLEND) / (2 * SLAB_BLEND));
  return below - above;
}

const sample = sampleMilkyWay(40_000);
const positions = sample.positions;

describe('the Milky Way’s points binned into cubes', () => {
  const { order, cubes } = binIntoCubes(positions);

  it('reorders every point once, each cube’s in their own order, each inside its cube’s box', () => {
    const seen = new Uint8Array(order.length);
    for (const i of order) seen[i]! += 1;
    expect(seen.every((n) => n === 1)).toBe(true);
    const moved = reorder(positions, 3, order);
    for (let c = 0; c < cubes.start.length; c += 1) {
      const from = cubes.start[c]!;
      for (let j = from; j < from + cubes.count[c]!; j += 1) {
        if (j > from) expect(order[j]!).toBeGreaterThan(order[j - 1]!);
        for (let a = 0; a < 3; a += 1) {
          expect(moved[j * 3 + a]!).toBeGreaterThanOrEqual(cubes.box[c * 6 + a]!);
          expect(moved[j * 3 + a]!).toBeLessThanOrEqual(cubes.box[c * 6 + 3 + a]!);
        }
      }
      for (let a = 0; a < 3; a += 1) {
        expect(cubes.box[c * 6 + 3 + a]! - cubes.box[c * 6 + a]!).toBeLessThanOrEqual(CUBE_PC);
      }
    }
  }, 60_000);
});

describe('each slab’s pass handed only the points that can fall in it', () => {
  const { order, cubes } = binIntoCubes(positions);
  const moved = reorder(positions, 3, order);
  const centre = [8122, 0, 20.8];

  for (const [name, camera] of [
    ['from the breadcrumb’s Milky Way, 30 kpc above', [8122, 9000, 28000]],
    ['from inside the disc, at the Sun', [0, 0, 0]],
    ['from the Local Group, 1.3 Mpc out', [-7e5, 3e5, 1.05e6]],
    ['from beside the centre', [8122, 300, 500]],
  ] as const) {
    it(`misses no point with a share of its slab, ${name}`, () => {
      const toCentre = Math.hypot(centre[0]! - camera[0], centre[1]! - camera[1], centre[2]! - camera[2]);
      const nearest = Math.max(0, toCentre - GALAXY_DEPTH_PC);
      const step = (toCentre + GALAXY_DEPTH_PC - nearest) / DEPTH_SLICES;
      const index = new Uint32Array(order.length * 3);
      const ranges = new Int32Array(2 * DEPTH_SLICES);
      const written = slabRanges(cubes, camera, nearest, step, DEPTH_SLICES, SLAB_BLEND, index, ranges);
      let shared = 0;
      for (let k = 0; k < DEPTH_SLICES; k += 1) {
        const handed = new Set(index.subarray(ranges[2 * k]!, ranges[2 * k]! + ranges[2 * k + 1]!));
        for (let i = 0; i < order.length; i += 1) {
          const d = Math.hypot(moved[i * 3]! - camera[0], moved[i * 3 + 1]! - camera[1], moved[i * 3 + 2]! - camera[2]);
          if (share(d, k, nearest, step) > 0) {
            shared += 1;
            expect(handed.has(i)).toBe(true);
          }
        }
      }
      // A point is handed to a slab or two, not six: at most twice as many as have a share.
      expect(written).toBeGreaterThanOrEqual(shared);
      expect(written).toBeLessThan(2 * order.length);
    });
  }

  it('writes nothing again while what it wrote still serves, and what it writes misses nothing', () => {
    const fill = (camera: readonly [number, number, number], index: Uint32Array, ranges: Int32Array, reach?: SlabReach) => {
      const toCentre = Math.hypot(centre[0]! - camera[0], centre[1]! - camera[1], centre[2]! - camera[2]);
      const nearest = Math.max(0, toCentre - GALAXY_DEPTH_PC);
      const step = (toCentre + GALAXY_DEPTH_PC - nearest) / DEPTH_SLICES;
      return slabRanges(cubes, camera, nearest, step, DEPTH_SLICES, SLAB_BLEND, index, ranges, reach);
    };
    const index = new Uint32Array(order.length * 3);
    const ranges = new Int32Array(2 * DEPTH_SLICES);
    const reach = slabReach(cubes);
    const camera: [number, number, number] = [8122, 9000, 28000];
    const written = fill(camera, index, ranges, reach);
    expect(written).toBeGreaterThan(0);
    // A hair along, and a step of the camera's turn: what was written still serves.
    expect(fill([8122.001, 9000, 28000], index, ranges, reach)).toBe(SLABS_UNCHANGED);
    expect(fill([8300, 9000, 27950], index, ranges, reach)).toBe(SLABS_UNCHANGED);
    // Far along, written again: every cube a fill that keeps no record hands each slab, and
    // only a few more.
    for (const moved of [[-7e5, 3e5, 1.05e6], [8122, 300, 500], [8122, 9000, 28000]] as const) {
      const again = fill(moved, index, ranges, reach);
      expect(again).toBeGreaterThan(0);
      const plainIndex = new Uint32Array(order.length * 3);
      const plainRanges = new Int32Array(2 * DEPTH_SLICES);
      const plain = fill(moved, plainIndex, plainRanges);
      expect(again).toBeLessThan(1.5 * plain);
      let missed = 0;
      for (let k = 0; k < DEPTH_SLICES; k += 1) {
        const handed = new Uint8Array(order.length);
        for (const point of index.subarray(ranges[2 * k]!, ranges[2 * k]! + ranges[2 * k + 1]!)) handed[point] = 1;
        for (const point of plainIndex.subarray(plainRanges[2 * k]!, plainRanges[2 * k]! + plainRanges[2 * k + 1]!)) {
          missed += handed[point] === 1 ? 0 : 1;
        }
      }
      expect(missed).toBe(0);
    }
  });

  it('misses nothing all along a turn of the camera, written or not', () => {
    const index = new Uint32Array(order.length * 3);
    const ranges = new Int32Array(2 * DEPTH_SLICES);
    const record = slabReach(cubes);
    const plainIndex = new Uint32Array(order.length * 3);
    const plainRanges = new Int32Array(2 * DEPTH_SLICES);
    let missed = 0;
    let unchanged = 0;
    for (let f = 0; f < 60; f += 1) {
      const a = f * 0.01;
      const camera: [number, number, number] = [8122 + 30_000 * Math.cos(a), 9000 + 20 * f, 30_000 * Math.sin(a)];
      const toCentre = Math.hypot(centre[0]! - camera[0], centre[1]! - camera[1], centre[2]! - camera[2]);
      const nearest = Math.max(0, toCentre - GALAXY_DEPTH_PC);
      const step = (toCentre + GALAXY_DEPTH_PC - nearest) / DEPTH_SLICES;
      if (slabRanges(cubes, camera, nearest, step, DEPTH_SLICES, SLAB_BLEND, index, ranges, record) === SLABS_UNCHANGED) unchanged += 1;
      slabRanges(cubes, camera, nearest, step, DEPTH_SLICES, SLAB_BLEND, plainIndex, plainRanges);
      for (let k = 0; k < DEPTH_SLICES; k += 1) {
        const handed = new Uint8Array(order.length);
        for (const point of index.subarray(ranges[2 * k]!, ranges[2 * k]! + ranges[2 * k + 1]!)) handed[point] = 1;
        for (const point of plainIndex.subarray(plainRanges[2 * k]!, plainRanges[2 * k]! + plainRanges[2 * k + 1]!)) {
          missed += handed[point] === 1 ? 0 : 1;
        }
      }
    }
    expect(missed).toBe(0);
    // And most frames wrote nothing.
    expect(unchanged).toBeGreaterThan(40);
  });

  it('finds a cube’s slabs as a run, the same ones asking slab by slab finds', () => {
    const span = new Int32Array(2);
    let mismatches = 0;
    for (let n = 0; n < 20_000; n += 1) {
      const near = Math.random() * 8 - 1;
      const far = near + Math.random() * 3;
      for (const extra of [0, 0.1, 0.3]) {
        slabSpan(near, far, DEPTH_SLICES, SLAB_BLEND, extra, span);
        for (let k = 0; k < DEPTH_SLICES; k += 1) {
          const inSpan = k >= span[0]! && k <= span[1]!;
          if (inSpan !== reaches(near, far, k, 0, 1, DEPTH_SLICES, SLAB_BLEND, extra)) mismatches += 1;
        }
      }
    }
    expect(mismatches).toBe(0);
  });

  it('hands every slab every point if the index cannot hold the cubes', () => {
    const index = new Uint32Array(order.length);
    const ranges = new Int32Array(2 * DEPTH_SLICES);
    const written = slabRanges(cubes, [0, 0, 0], 0, 3500, DEPTH_SLICES, SLAB_BLEND, index, ranges);
    expect(written).toBe(order.length);
    for (let k = 0; k < DEPTH_SLICES; k += 1) {
      expect(ranges[2 * k]).toBe(0);
      expect(ranges[2 * k + 1]).toBe(order.length);
    }
    expect(index[123]).toBe(123);
  });
});
