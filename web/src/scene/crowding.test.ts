import { describe, expect, it } from 'vitest';

import { floorKept, halfCountRadiusPc, lineKept, lineSeparationPx } from './crowding.ts';

const LY_PC = 0.30660139378555057;
/** Pixels per radian of an 864 px tall view at 27 degrees. */
const PPR = 864 / (2 * Math.tan((13.5 * Math.PI) / 180));

describe('the faint-galaxy floor as a catalogue crowds', () => {
  it('finds the radius holding half of a catalogue', () => {
    const positions = [1, 0, 0, 0, 2, 0, 0, 0, 3, 4, 0, 0, 0, 0, 5];
    expect(halfCountRadiusPc(positions, 5)).toBe(3);
  });

  it('keeps every dot from inside a catalogue and from its own views', () => {
    // Laniakea's: 86,899 galaxies, half within about 150 Mpc.
    expect(floorKept(150e6, 86_899, 100e6, PPR)).toBe(1);
    expect(floorKept(150e6, 86_899, 1.5e9 * LY_PC, PPR)).toBe(1);
  });

  it('takes it away once the galaxies fall on the same pixels: none from the observable universe’s view', () => {
    expect(floorKept(150e6, 86_899, 250e9 * LY_PC, PPR)).toBe(0);
    expect(floorKept(150e6, 86_899, 20e9 * LY_PC, PPR)).toBe(0);
    // In between, only ever less as the camera goes out.
    let last = 1;
    for (let ly = 1e9; ly < 4e11; ly *= 1.2) {
      const kept = floorKept(150e6, 86_899, ly * LY_PC, PPR);
      expect(kept).toBeLessThanOrEqual(last + 1e-12);
      last = kept;
    }
  });
});

describe('the filaments as they crowd', () => {
  // Malavasi et al.'s as drawn: 584,000 Mpc of them, half within 1.7 Gpc, on 18% of the sky.
  const kept = (ly: number) => lineKept(1.715e9, 292e9, 0.181, ly * LY_PC, PPR);

  it('keeps every line from inside the half of them nearest the Sun', () => {
    expect(lineSeparationPx(1.715e9, 292e9, 0.181, 1e9, PPR)).toBe(Infinity);
    expect(kept(3e9)).toBe(1);
  });

  it('dims them as they close up, gradually, and drops them once a speck', () => {
    let last = 1;
    for (let ly = 6e9; ly < 4e11; ly *= 1.2) {
      const k = kept(ly);
      expect(k).toBeLessThanOrEqual(last + 1e-12);
      last = k;
    }
    expect(kept(10e9)).toBeGreaterThan(0.01);
    expect(kept(400e9)).toBe(0);
  });
});
