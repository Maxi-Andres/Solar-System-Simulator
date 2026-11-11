import { describe, expect, it } from 'vitest';

import { SPRITE_FLOOR, spriteRadiusSigmas } from './gaussianSprite.ts';
import { SPRITE_KERNEL } from './MilkyWay.tsx';

/**
 * A light drawn as a Gaussian (gaussianSprite.ts) goes out to where it falls below the floor,
 * however far past white its centre is: no square edge.
 */

describe('a Gaussian sprite', () => {
  it('reaches four sigma for a peak at white, five a hundred times past it, six and a half a million', () => {
    expect(spriteRadiusSigmas(1)).toBeCloseTo(Math.sqrt(2 * Math.log(2000)), 10);
    expect(spriteRadiusSigmas(1)).toBeCloseTo(3.9, 1);
    expect(spriteRadiusSigmas(100)).toBeCloseTo(4.94, 2);
    expect(spriteRadiusSigmas(1e6)).toBeCloseTo(6.54, 2);
  });

  it('is cut where its light, through the shoulder, is the floor: the edge is below a display step', () => {
    for (const peak of [0.01, 1, 30, 1e4, 1e8]) {
      const r = spriteRadiusSigmas(peak);
      const x = peak * Math.exp(-0.5 * r * r);
      expect(x).toBeCloseTo(SPRITE_FLOOR, 12);
      expect(1 - Math.exp(-x)).toBeLessThan(0.5 / 255);
    }
  });

  it('draws nothing for a light that never reaches the floor', () => {
    expect(spriteRadiusSigmas(SPRITE_FLOOR)).toBe(0);
    expect(spriteRadiusSigmas(1e-6)).toBe(0);
    expect(spriteRadiusSigmas(0)).toBe(0);
  });

  it('grows with its peak, slowly: a square six sigma across was cut for any peak past e^4.5 of the floor', () => {
    let last = 0;
    for (let peak = 1e-3; peak < 1e9; peak *= 3) {
      const r = spriteRadiusSigmas(peak);
      expect(r).toBeGreaterThan(last);
      last = r;
    }
    expect(spriteRadiusSigmas(SPRITE_FLOOR * Math.exp(4.5))).toBeCloseTo(3, 10);
  });
});

describe('the Milky Way’s sprites', () => {
  it('fall to nothing at the circle their square holds, and hold the light the cut Gaussian held', () => {
    expect(SPRITE_KERNEL.edge).toBeCloseTo(Math.exp(-3.125), 12);
    // Summed over the sprite, in its fifths: the new profile times its scale against the old.
    const n = 400;
    let before = 0;
    let after = 0;
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        const u = (i + 0.5) / n - 0.5;
        const v = (j + 0.5) / n - 0.5;
        const r2 = (u * u + v * v) * 25;
        before += Math.exp(-0.5 * r2);
        after += Math.max(Math.exp(-0.5 * r2) - SPRITE_KERNEL.edge, 0) * SPRITE_KERNEL.scale;
      }
    }
    expect(after / before).toBeCloseTo(1, 3);
    // At the sprite's edge, mid-side, nothing.
    expect(Math.max(Math.exp(-0.5 * 0.25 * 25) - SPRITE_KERNEL.edge, 0)).toBe(0);
  });
});
