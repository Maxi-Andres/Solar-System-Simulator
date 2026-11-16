import { describe, expect, it } from 'vitest';

import { collinearDistanceFraction, collinearPoints, lagrangeState, massRatio } from './lagrange.ts';
import { cross, dot, length, subtract } from './vec3.ts';

// JPL DE440 GMs, km^3/s^2.
const GM_SUN = 132712440041.279419;
const GM_EARTH = 398600.435507;
const GM_MOON = 4902.800118;

describe('collinear Lagrange points', () => {
  it('balance gravity and the rotating frame exactly', () => {
    for (const mu of [3.0404e-6, 0.0121506, 0.1, 0.5]) {
      const { l1, l2, l3 } = collinearPoints(mu);
      for (const x of [l1, l2, l3]) {
        const a = x + mu;
        const b = x - 1 + mu;
        const f = x - ((1 - mu) * a) / Math.abs(a) ** 3 - (mu * b) / Math.abs(b) ** 3;
        expect(Math.abs(f)).toBeLessThan(1e-9);
      }
      expect(l3).toBeLessThan(-mu);
      expect(l1).toBeGreaterThan(-mu);
      expect(l1).toBeLessThan(1 - mu);
      expect(l2).toBeGreaterThan(1 - mu);
    }
  });

  it('puts the Earth-Moon points where the textbooks do', () => {
    const mu = massRatio(GM_EARTH, GM_MOON);
    expect(mu).toBeCloseTo(0.0121506, 6);
    // Szebehely 1967 / Koon et al. 2011: gamma1 0.1509, gamma2 0.1678, L3 0.9929 from Earth.
    expect(collinearDistanceFraction(mu, 1)).toBeCloseTo(0.15093, 4);
    expect(collinearDistanceFraction(mu, 2)).toBeCloseTo(0.16783, 4);
    expect(collinearDistanceFraction(mu, 3)).toBeCloseTo(1 - (7 / 12) * mu, 4);
  });

  // Against the series gamma = h (1 -+ h / 3 - h^2 / 9), h = (mu / 3)^(1/3) (Szebehely 1967): with
  // Earth and Moon together 1.4976 and 1.5077 million km; Earth alone would give 1.4911.
  it('puts Sun-Earth L1 and L2 1.5 million km from the Earth-Moon barycentre', () => {
    const mu = massRatio(GM_SUN, GM_EARTH + GM_MOON);
    const au = 149_597_870.7;
    expect(collinearDistanceFraction(mu, 1) * au).toBeCloseTo(1.4976e6, -3);
    expect(collinearDistanceFraction(mu, 2) * au).toBeCloseTo(1.5077e6, -3);
    // L1 nearer than L2, both near the Hill radius (mu/3)^(1/3).
    const hill = Math.cbrt(mu / 3);
    expect(collinearDistanceFraction(mu, 1)).toBeLessThan(hill);
    expect(collinearDistanceFraction(mu, 2)).toBeGreaterThan(hill);
  });
});

describe('lagrangeState', () => {
  const secondary = {
    position: { x: 384_400, y: 0, z: 0 },
    velocity: { x: 0, y: 1.022, z: 0 },
  };
  const mu = massRatio(GM_EARTH, GM_MOON);

  it('makes L4 and L5 equilateral with both primaries, ahead and behind', () => {
    for (const index of [4, 5] as const) {
      const point = lagrangeState(secondary, mu, index);
      expect(length(point.position)).toBeCloseTo(384_400, 6);
      expect(length(subtract(point.position, secondary.position))).toBeCloseTo(384_400, 6);
      // In the orbit's plane, and on the side of the motion for L4.
      expect(point.position.z).toBeCloseTo(0, 9);
      const side = dot(cross(secondary.position, point.position), cross(secondary.position, secondary.velocity));
      expect(Math.sign(side)).toBe(index === 4 ? 1 : -1);
    }
  });

  it('puts L1 between the primaries and L2, L3 outside', () => {
    const l1 = lagrangeState(secondary, mu, 1).position.x;
    const l2 = lagrangeState(secondary, mu, 2).position.x;
    const l3 = lagrangeState(secondary, mu, 3).position.x;
    expect(l1).toBeGreaterThan(300_000);
    expect(l1).toBeLessThan(384_400);
    expect(l2).toBeGreaterThan(384_400);
    expect(l3).toBeLessThan(0);
  });
});
