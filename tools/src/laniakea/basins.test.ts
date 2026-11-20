import { describe, expect, it } from 'vitest';

import { basinLandmarks, drawnBasinLandmarkName } from './landmarks.ts';
import {
  basinStats,
  cropBasins,
  MIN_BASIN_VOXELS,
  meanVoxelMassSun,
  nameBasin,
  NAME_NEAR_PC,
  NAME_WITHIN_PC,
  selectBasins,
  sgMpcHToScenePc,
  type WatershedGrid,
} from './watersheds.ts';

/** A labelled N^3 cube, x fastest. */
function cube(n: number, value: (i: number, j: number, k: number) => number): { size: number; values: Float64Array } {
  const values = new Float64Array(n ** 3);
  for (let k = 0; k < n; k += 1) for (let j = 0; j < n; j += 1) for (let i = 0; i < n; i += 1) values[i + n * (j + n * k)] = value(i, j, k);
  return { size: n, values };
}

const within = (lo: [number, number, number], hi: [number, number, number]) => (i: number, j: number, k: number) =>
  i >= lo[0] && j >= lo[1] && k >= lo[2] && i <= hi[0] && j <= hi[1] && k <= hi[2];

describe('every basin of attraction', () => {
  const n = 16;
  const cell = 1000 / n;
  // Laniakea's (1, Table A.1), an SDSS basin (7), a small one (20), one more (21: 7 x 7 x 6
  // voxels, its densest voxel at 3, 11, 5) and one where the field is unconstrained (22).
  const inLaniakea = within([7, 7, 7], [8, 8, 8]);
  const inSdss = within([14, 14, 14], [15, 15, 15]);
  const inSmall = within([0, 0, 15], [1, 1, 15]);
  const inMore = within([0, 8, 0], [6, 14, 5]);
  const inUnconstrained = within([9, 0, 0], [15, 6, 5]);
  const peak: [number, number, number] = [3, 11, 5];
  const galaxies = cube(n, (i, j, k) =>
    inLaniakea(i, j, k) ? 1 : inSdss(i, j, k) ? 7 : inSmall(i, j, k) ? 20 : inMore(i, j, k) ? 21 : inUnconstrained(i, j, k) ? 22 : 0,
  );
  const groups = cube(n, (i, j, k) => (within([6, 6, 6], [9, 9, 9])(i, j, k) ? 4 : 0));
  const cubes: Record<WatershedGrid, { size: number; values: Float64Array }> = {
    galaxiesAttraction: galaxies,
    galaxiesRepulsion: cube(n, () => 0),
    groupsAttraction: groups,
  };
  const density = cube(n, (i, j, k) => (i === peak[0] && j === peak[1] && k === peak[2] ? 2 : 0));
  // The velocity's error, on a coarser grid as the published one is: 50 km/s, 200 over basin 22.
  const error = cube(8, (i, j, k) => (i >= 5 && j <= 3 && k <= 2 ? 200 : 50));
  const peakSg: [number, number, number] = [(peak[0] - n / 2) * cell, (peak[1] - n / 2) * cell, (peak[2] - n / 2) * cell];
  const [x, y, z] = sgMpcHToScenePc(peakSg);
  const places = [
    { name: 'Coma Supercluster', x: x + 10e6, y, z },
    { name: 'Far Cluster', x: x + 500e6, y, z },
  ];

  it('counts each basin\'s voxels, box and densest voxel', () => {
    const stats = basinStats(galaxies, density);
    expect([...stats.keys()].sort((a, b) => a - b)).toEqual([1, 7, 20, 21, 22]);
    const more = stats.get(21)!;
    expect(more.voxels).toBe(7 * 7 * 6);
    expect(more.lo).toEqual([0, 8, 0]);
    expect(more.hi).toEqual([6, 14, 5]);
    expect(more.peak).toEqual(peak);
    expect(more.meanDensityVoxels).toBe(7 * 7 * 6 + 2);
  });

  it('draws Table A.1\'s, cuts the SDSS, small and unconstrained ones, and names one more for the structure at its attractor', () => {
    const { drawn, cuts } = selectBasins({ cubes, density, error, places });
    expect(drawn.map((d) => [d.grid, d.label, d.name, d.naming])).toEqual([
      ['galaxiesAttraction', 1, 'Laniakea', 'paper'],
      ['galaxiesAttraction', 21, 'Coma basin', 'nearby'],
      ['groupsAttraction', 4, 'Shapley', 'paper'],
    ]);
    expect(cuts.map((c) => [c.label, c.name, c.why])).toEqual([
      [7, 'SDSS-1a', 'sdss'],
      [20, null, 'small'],
      [22, null, 'unconstrained'],
    ]);
    expect(MIN_BASIN_VOXELS).toBeGreaterThan(4);
    const more = drawn.find((d) => d.label === 21)!;
    expect(more.attractorSgMpcH).toEqual(peakSg);
    expect(more.extentMpcH).toEqual([7 * cell, 7 * cell, 6 * cell]);
    expect(Math.abs(more.massSun / ((7 * 7 * 6 + 2) * meanVoxelMassSun(n)) - 1)).toBeLessThan(0.05);
    // The paper's attractor, not the grid's densest voxel, for Table A.1's.
    expect(drawn[0]!.attractorSgMpcH).toEqual([-62, -8, 39]);
  });

  it('places an attractor where the flow from the densest voxel comes to rest, if that is in its basin', () => {
    const rest: [number, number, number] = [1, 9, 1];
    const { drawn } = selectBasins({ cubes, density, error, places, settle: (grid) => (grid === 'galaxiesAttraction' ? rest : null) });
    expect(drawn.find((d) => d.label === 21)!.attractorSgMpcH).toEqual([(1 - 8) * cell, (9 - 8) * cell, (1 - 8) * cell]);
    // Out of its basin: the densest voxel instead.
    const { drawn: elsewhere } = selectBasins({ cubes, density, error, places, settle: () => [8, 8, 8] });
    expect(elsewhere.find((d) => d.label === 21)!.attractorSgMpcH).toEqual(peakSg);
  });

  it('cuts every basin Table A.1 does not name when there is no error to judge it by', () => {
    const { drawn } = selectBasins({ cubes, density, error: null, places });
    expect(drawn.map((d) => d.label)).toEqual([1, 4]);
  });

  it('names a basin for the nearest structure, one near it, or none -- never a name taken', () => {
    const at: [number, number, number] = [0, 0, 0];
    const place = (name: string, d: number) => ({ name, x: d, y: 0, z: 0 });
    expect(nameBasin(at, [place('Hercules Supercluster', NAME_WITHIN_PC - 1)], 'x')).toEqual({ name: 'Hercules basin', naming: 'nearby' });
    expect(nameBasin(at, [place('Coma Cluster', NAME_WITHIN_PC + 1)], 'x')).toEqual({ name: 'Basin near Coma Cluster', naming: 'near' });
    expect(nameBasin(at, [place('Coma Cluster', NAME_NEAR_PC + 1)], 'Unnamed basin (CF4 galaxies, 9)')).toEqual({ name: 'Unnamed basin (CF4 galaxies, 9)', naming: 'unnamed' });
    expect(nameBasin(at, [place('Hercules Supercluster', 1)], 'x', new Set(['Hercules basin']))).toEqual({ name: 'Basin near Hercules Supercluster', naming: 'near' });
  });

  it('keeps the basins drawn in basins.bin and makes each a structure with its box and estimated mass', () => {
    const { drawn } = selectBasins({ cubes, density, error, places });
    const crop = cropBasins(cubes, drawn);
    expect(crop.voxels.galaxiesAttraction[21]).toBe(7 * 7 * 6);
    expect(crop.voxels.galaxiesAttraction[22]).toBeUndefined();
    expect([...crop.grids.galaxiesAttraction].some((v) => v === 22 || v === 7 || v === 20)).toBe(false);
    const landmarks = basinLandmarks({ basinVoxels: crop.voxels, basinVoxelSize: n, drawn });
    const more = landmarks.find((l) => l.name === drawnBasinLandmarkName(drawn.find((d) => d.label === 21)!))!;
    expect(more.kind).toBe('basin');
    expect(more.basin).toEqual([{ grid: 'galaxiesAttraction', label: 21 }]);
    expect(more.massNote).toMatch(/Estimated/);
    expect(more.extentPc![2]).toBeCloseTo(((6 * cell) / 0.746) * 1e6, -1);
    // Laniakea keeps Tully et al.'s mass; Shapley, whose galaxies' basin this grid lacks, has none.
    expect(landmarks.find((l) => l.name === 'Laniakea Supercluster')!.massSun).toBe(1e17);
    const shapley = landmarks.find((l) => l.name === 'Shapley basin')!;
    expect(shapley.massSun).toBeNull();
  });
});
