import { describe, expect, it } from 'vitest';

import { STAR3D, STAR3D_FLOATS } from '../core/stars3d.ts';
import { linearToSrgb } from './shading.ts';
import { tierReach, tiersUnseen, UNSEEN_DISPLAY } from './Starfield.tsx';
import { mapDotPeak, peakLinear, star3dPeak } from './stars3dShader.ts';

const LIMIT = 8;
const COEFFICIENTS: [number, number] = [0.9, -0.1];

/** A tier of `stars`: [x, y, z pc, vx, vy, vz km/s, Mv]. */
function records(stars: readonly (readonly number[])[]): Float32Array {
  const out = new Float32Array(stars.length * STAR3D_FLOATS);
  stars.forEach(([x, y, z, vx, vy, vz, mv], i) => {
    const base = i * STAR3D_FLOATS;
    out[base + STAR3D.x] = x!;
    out[base + STAR3D.y] = y!;
    out[base + STAR3D.z] = z!;
    out[base + STAR3D.vx] = vx!;
    out[base + STAR3D.vy] = vy!;
    out[base + STAR3D.vz] = vz!;
    out[base + STAR3D.Mv] = mv!;
  });
  return out;
}

describe('the 3D stars where none of them can show', () => {
  const tier = records([
    [1.3, 0, 0, 20, 0, 0, 4.4],
    [-300, 50, 10, 0, 140, 0, -7.5],
    [0, 0, 1000, 0, 0, 0, 1],
  ]);
  const reach = tierReach(tier, new Float32Array([1, 0.9, 0.8, 0.7, 0.8, 1, 1, 1, 1]));

  it('knows its tier: the brightest, the farthest, the fastest, the brightest channel', () => {
    expect(reach.brightestAbsMag).toBeCloseTo(-7.5, 5);
    expect(reach.farthestPc).toBeCloseTo(1000, 3);
    expect(reach.fastestKmS).toBeCloseTo(140, 3);
    expect(reach.brightestChannel).toBe(1);
  });

  it('is drawn from near, and from where its brightest star is within the limit', () => {
    expect(tiersUnseen(reach, 500, 0, LIMIT, 0)).toBe(false);
    // -7.5 at 10 kpc is 7.5: in the limit.
    expect(tiersUnseen(reach, 11_000, 0, LIMIT, 0)).toBe(false);
  });

  it('is not drawn past it with no map, nor with a map crowded to nothing', () => {
    const far = 1.3e6;
    expect(tiersUnseen(reach, far, 0, LIMIT, 0)).toBe(true);
    const dot = mapDotPeak(234_635, far, 1158);
    expect(tiersUnseen(reach, far, 0, LIMIT, dot)).toBe(true);
    // And the shader agrees: the brightest star, at the nearest any star can be, is not drawn.
    const brightest = reach.brightestAbsMag + 5 * (Math.log10(far - reach.farthestPc) - 1);
    expect(star3dPeak(brightest, COEFFICIENTS, LIMIT, 0)).toBeNull();
  });

  it('is drawn while its map dot still adds a step to the canvas', () => {
    const far = 1.3e6;
    // A dot whose brightest fragment is just over the bound.
    let dot = 1e-4;
    while (linearToSrgb(peakLinear(dot)) < UNSEEN_DISPLAY) dot *= 1.01;
    expect(tiersUnseen(reach, far, 0, LIMIT, dot)).toBe(false);
    expect(tiersUnseen(reach, far, 0, LIMIT, dot / 1.02)).toBe(true);
  });

  it('counts the stars’ motion: the fastest, for the years since J2000, as near as it can come', () => {
    // From just past where the brightest reaches the limit, a motion that brings it nearer.
    const edge = 10 ** ((LIMIT + 0.02 - reach.brightestAbsMag) / 5 + 1) + reach.farthestPc;
    expect(tiersUnseen(reach, edge, 0, LIMIT, 0)).toBe(true);
    expect(tiersUnseen(reach, edge, 1000 / reach.fastestKmS, LIMIT, 0)).toBe(false);
  });
});
