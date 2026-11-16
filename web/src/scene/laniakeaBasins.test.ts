import { describe, expect, it } from 'vitest';

import { labelVolume } from './isosurface.ts';
import { basinGeometry, basinParts, basinPartsGeometry, type BasinRequest } from './laniakeaBasins.ts';

/** A ball of label 2 in a grid of 1s, voxels 1000 pc, the grid's corner at (-5000, 0, 3000) pc. */
function request(): BasinRequest {
  const n = 16;
  const labels = new Uint8Array(n * n * n).fill(1);
  for (let k = 0; k < n; k += 1)
    for (let j = 0; j < n; j += 1)
      for (let i = 0; i < n; i += 1) if (Math.hypot(i - 7.5, j - 7.5, k - 7.5) < 5) labels[i + n * (j + n * k)] = 2;
  const voxelToScene = [1000, 0, 0, 0, 0, 1000, 0, 0, 0, 0, 1000, 0, -5000, 0, 3000, 1];
  return { labels, size: [n, n, n], label: 2, voxelToScene };
}

describe('a basin made in the worker', () => {
  it('is the geometry and field made here, array for array', () => {
    const r = request();
    const parts = basinParts(r)!;
    const here = basinGeometry(r.labels, r.size, r.label, r.voxelToScene)!;
    const there = basinPartsGeometry(parts);
    for (const name of ['position', 'normal']) {
      expect(there.getAttribute(name).itemSize).toBe(3);
      expect(Array.from(there.getAttribute(name).array)).toEqual(Array.from(here.getAttribute(name).array));
    }
    expect(Array.from(there.getIndex()!.array)).toEqual(Array.from(here.getIndex()!.array));
    const volume = labelVolume(r.labels, r.size, r.label)!;
    expect(parts.volume.size).toEqual(volume.size);
    expect(parts.volume.origin).toEqual(volume.origin);
    expect(Array.from(parts.volume.data)).toEqual(Array.from(volume.data));
  });

  it('is null for a label the grid does not have', () => {
    expect(basinParts({ ...request(), label: 9 })).toBeNull();
  });
});
