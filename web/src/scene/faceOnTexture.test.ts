import { describe, expect, it } from 'vitest';

import { decodeMapChannel } from '../core/localGroup.ts';
import { faceOnLevels } from './faceOnTexture.ts';

/** A face-on map decoded once, linear, and averaged down its mipmaps (faceOnTexture.ts). */
describe('a disc’s face-on map, decoded', () => {
  const map = { size: 4, halfPc: 100, bounds: { old: [-3, 1], sfr: [-6, -2], dust: [-2, 1] }, oldSum: 1, sfrSum: 1 } as const;
  const rgba = new Uint8ClampedArray(4 * 4 * 4);
  for (let i = 0; i < 16; i += 1) rgba.set([i * 16, 255 - i * 16, i % 2 === 0 ? 0 : 200, 255], i * 4);

  it('turns each code into what it stands for, times its scale', () => {
    const [base] = faceOnLevels(rgba, map, [2, 3, 5]);
    expect(base!.data[5 * 4]).toBeCloseTo(decodeMapChannel(80, map.bounds.old) * 2, 5);
    expect(base!.data[5 * 4 + 1]).toBeCloseTo(decodeMapChannel(175, map.bounds.sfr) * 3, 9);
    expect(base!.data[5 * 4 + 2]).toBeCloseTo(decodeMapChannel(200, map.bounds.dust) * 5, 5);
    // Code 0 is none.
    expect(base!.data[0]).toBe(0);
  });

  it('averages the light itself down to one texel', () => {
    const levels = faceOnLevels(rgba, map, [1, 1, 1]);
    expect(levels.map((level) => level.width)).toEqual([4, 2, 1]);
    const mean = (c: number) => levels[0]!.data.filter((_, i) => i % 4 === c).reduce((a, b) => a + b, 0) / 16;
    for (const c of [0, 1, 2]) expect(levels[2]!.data[c]).toBeCloseTo(mean(c), 6);
  });
});
