import { describe, expect, it } from 'vitest';

import { decodeMapChannel } from '../core/localGroup.ts';
import { faceOnLevels } from './faceOnTexture.ts';
import { balmerColour } from './LocalGroup.tsx';

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

  it('has no glowing gas without a map of it', () => {
    const levels = faceOnLevels(rgba, map, [1, 1, 1]);
    for (const level of levels) expect(level.data.filter((_, i) => i % 4 === 3).every((a) => a === 0)).toBe(true);
    // Its pixels without bounds to read them by are none too.
    const [base] = faceOnLevels(rgba, map, [1, 1, 1], new Uint8ClampedArray(4 * 4 * 4).fill(200));
    expect(base!.data[3]).toBe(0);
  });

  it('puts the glowing gas in alpha, as it is: a grey PNG’s red, through its bounds', () => {
    const withGas = { ...map, nebula: { bounds: [-4, 2] } } as const;
    const grey = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < 16; i += 1) grey.set([i * 16, i * 16, i * 16, 255], i * 4);
    const levels = faceOnLevels(rgba, withGas, [2, 3, 5], grey);
    expect(levels[0]!.data[5 * 4 + 3]).toBeCloseTo(decodeMapChannel(80, withGas.nebula.bounds), 5);
    expect(levels[0]!.data[3]).toBe(0);
    // The stars' channels as without it.
    expect(levels[0]!.data[5 * 4]).toBeCloseTo(decodeMapChannel(80, map.bounds.old) * 2, 5);
    const mean = levels[0]!.data.filter((_, i) => i % 4 === 3).reduce((a, b) => a + b, 0) / 16;
    expect(levels[2]!.data[3]).toBeCloseTo(mean, 5);
    expect(() => faceOnLevels(rgba, withGas, [1, 1, 1], new Uint8ClampedArray(8 * 8 * 4))).toThrow();
  });
});

/** The Balmer lines' light on the starlight's exposure (LocalGroup.tsx). */
describe('the glowing gas’s colour', () => {
  it('is as bright as starlight for the same V-band luminosity, and pink', () => {
    const [r, g, b] = balmerColour();
    expect(0.2126 * r + 0.7152 * g + 0.0722 * b).toBeCloseTo(1, 12);
    expect(r).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(g);
  });
});
