import { describe, expect, it } from 'vitest';

import { degPerDayToRadPerSec, pixelsPerRadian, solarSystemRate, surfaceRate, swarmRate, transverseRate } from './screenMotion.ts';

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

  it('bounds everything the Sun holds from outside its reach, and gives up within it', () => {
    const SUN_MU = 1.327_124_400_18e11;
    const PARSEC_KM = 3.085_677_581e13;
    // From Laniakea's scale, a hundred megaparsecs: not a millionth of a pixel a year.
    const laniakea = solarSystemRate(1e8 * PARSEC_KM, SUN_MU, 0) * pixelsPerRadian(1620, 50);
    expect(laniakea * 3.156e7).toBeLessThan(1e-6);
    // From the Milky Way's, 30 kpc, the Sun on its orbit about the camera: not a ten-thousandth.
    expect(solarSystemRate(3e4 * PARSEC_KM, SUN_MU, 250) * pixelsPerRadian(1620, 50) * 3.156e7).toBeLessThan(1e-4);
    // Never less than the fastest it could be: the Sun's surface escape speed over the gap.
    const twoPc = solarSystemRate(2 * PARSEC_KM, SUN_MU, 0);
    expect(twoPc).toBeGreaterThan(Math.sqrt((2 * SUN_MU) / 696_000) / (2 * PARSEC_KM));
    // Within the Oort cloud, and among the planets, a comet may pass at any distance.
    expect(solarSystemRate(1e12, SUN_MU, 0)).toBe(Infinity);
    expect(solarSystemRate(1.5e8, SUN_MU, 30)).toBe(Infinity);
  });
});
