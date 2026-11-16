import { describe, expect, it } from 'vitest';

import { CELL_PX, CROWDED_SEPARATION_PX, crowdingGrid, measureCrowding } from './screenCrowding.ts';

// A camera at the origin looking down -z, unrotated; a 90 degree square view.
const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const W = 960;
const H = 960;

function sample(count: number, spread: number): Float32Array {
  const out = new Float32Array(count * 3);
  for (let k = 0; k < count; k += 1) {
    out[k * 3] = ((k * 0.618) % 1 - 0.5) * spread;
    out[k * 3 + 1] = ((k * 0.754) % 1 - 0.5) * spread;
    out[k * 3 + 2] = -100;
  }
  return out;
}

describe('where on the screen the faint dots crowd', () => {
  it('keeps every dot where they are far apart', () => {
    const grid = crowdingGrid(W, H);
    expect(grid.cols).toBe(Math.ceil(W / CELL_PX));
    measureCrowding(grid, sample(1000, 200), 1000, 1, { x: 0, y: 0, z: 0 }, IDENTITY, 1, 1, W, H);
    expect(Math.min(...grid.kept)).toBe(255);
  });

  it('dims each where they crowd, so a cell holds no more light than at the crowded separation', () => {
    const grid = crowdingGrid(W, H);
    // 1000 samples standing for 4,000 each over the screen: 4.3 dots a pixel.
    measureCrowding(grid, sample(1000, 200), 1000, 4000, { x: 0, y: 0, z: 0 }, IDENTITY, 1, 1, W, H);
    const middle = grid.kept[Math.floor(grid.rows / 2) * grid.cols + Math.floor(grid.cols / 2)]! / 255;
    const density = (1000 * 4000) / (W * H);
    expect(middle).toBeCloseTo(1 / (density * CROWDED_SEPARATION_PX ** 2), 1);
  });

  it('counts nothing behind the camera', () => {
    const grid = crowdingGrid(W, H);
    const behind = sample(1000, 200).map((v, i) => (i % 3 === 2 ? 100 : v));
    measureCrowding(grid, behind, 1000, 1e6, { x: 0, y: 0, z: 0 }, IDENTITY, 1, 1, W, H);
    expect(Math.min(...grid.kept)).toBe(255);
  });
});
