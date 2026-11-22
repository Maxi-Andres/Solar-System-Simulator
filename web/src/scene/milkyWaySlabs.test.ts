import { describe, expect, it } from 'vitest';

import { sampleMilkyWay } from '../core/milkyWay.ts';
import { DEPTH_SLICES, GALAXY_DEPTH_PC, SLAB_BLEND } from './MilkyWay.tsx';
import { binIntoCubes, CUBE_PC, reorder, slabRanges } from './milkyWaySlabs.ts';

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
  });
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
