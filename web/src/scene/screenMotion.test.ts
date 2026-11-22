import { describe, expect, it } from 'vitest';

import { degPerDayToRadPerSec, pixelsPerRadian, surfaceRate, swarmRate, transverseRate } from './screenMotion.ts';

const EARTH_MU = 398_600.4418;

describe('screen motion', () => {
  it('counts only the part of a velocity across the line of sight', () => {
    // 10 km/s across, 1000 km away: a hundredth of a radian a second.
    expect(transverseRate(1000, 0, 0, 0, 10, 0)).toBeCloseTo(0.01, 12);
    // Straight at the camera: nothing.
    expect(transverseRate(1000, 0, 0, -10, 0, 0)).toBe(0);
    // At the camera itself: nothing to see.
    expect(transverseRate(0, 0, 0, 1, 1, 1)).toBe(0);
  });

  it('puts the ISS from the default view of Earth at a third of a pixel a second', () => {
    // Eight Earth radii out; the ISS at 7.66 km/s, across the view.
    const rate = transverseRate(51_000, 0, 0, 0, 7.66, 0);
    expect(rate * pixelsPerRadian(1080, 27)).toBeGreaterThan(0.3);
    expect(rate * pixelsPerRadian(1080, 27)).toBeLessThan(0.4);
  });

  it('turns a surface at its equator, seen from its nearest point', () => {
    const omega = degPerDayToRadPerSec(360.9856);
    expect(omega).toBeCloseTo(7.292e-5, 8);
    // Earth's equator, 465 m/s, from 45,000 km above it.
    expect(surfaceRate(omega * 6378, 6378, 51_378)).toBeCloseTo(0.465 / 45_000, 7);
    // Standing on it, floored at a thousandth of the radius rather than infinite.
    expect(Number.isFinite(surfaceRate(0.465, 6378, 6378))).toBe(true);
  });

  it('bounds a satellite swarm from outside it, and gives up inside it', () => {
    // From a million and a half km, the fastest is low Earth orbit's escape speed over the gap.
    const far = swarmRate(1.5e6, EARTH_MU);
    expect(far).toBeGreaterThan(Math.sqrt((2 * EARTH_MU) / 6500) / 1.5e6);
    expect(far).toBeLessThan(1e-5);
    // Among the satellites, one may pass at any distance.
    expect(swarmRate(30_000, EARTH_MU)).toBe(Infinity);
  });
});
