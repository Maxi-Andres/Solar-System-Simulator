import { describe, expect, it } from 'vitest';

import { conicPosition, ellipticPosition, stumpff, universalAnomaly, type PerifocalState } from './conic.ts';
import { SECONDS_PER_DAY } from './time.ts';

/**
 * The universal-variable propagator against each conic's own classical solution, solved
 * independently, and against the two quantities a two-body orbit conserves.
 */

const MU = 1.32712440041e11; // km^3/s^2, the Sun
const AU = 149_597_870.7;

const state = (): PerifocalState => ({ x: 0, y: 0, vx: 0, vy: 0 });

/** Bisection, which cannot fail on a monotonic function. */
function bisect(f: (x: number) => number, low: number, high: number): number {
  for (let k = 0; k < 300; k += 1) {
    const mid = (low + high) / 2;
    if (f(mid) < 0) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

/** The hyperbola the classical way: e sinh F - F = M, by bisection. */
function hyperbolic(q: number, e: number, days: number): { x: number; y: number } {
  const a = q / (e - 1);
  const M = Math.sqrt(MU / (a * a * a)) * days * SECONDS_PER_DAY;
  const F = bisect((x) => e * Math.sinh(x) - x - M, -50, 50);
  return { x: a * (e - Math.cosh(F)), y: a * Math.sqrt(e * e - 1) * Math.sinh(F) };
}

/** The parabola: Barker's equation in closed form. */
function parabolic(q: number, days: number): { x: number; y: number } {
  const B = days * SECONDS_PER_DAY * Math.sqrt(MU / (2 * q * q * q));
  const s = bisect((x) => x + (x * x * x) / 3 - B, -1e6, 1e6);
  return { x: q * (1 - s * s), y: 2 * q * s };
}

const DAYS = [-36_525, -3652.5, -365.25, -30, -1, -0.01, 0, 0.01, 1, 30, 365.25, 3652.5, 36_525];

describe('stumpff', () => {
  it('agrees with the closed forms where the series takes over from them', () => {
    // Just inside the series' range, against the closed forms at the same z.
    for (const z of [0.0999999, -0.0999999]) {
      const series = stumpff(z);
      const s = Math.sqrt(Math.abs(z));
      const C = z > 0 ? (1 - Math.cos(s)) / z : (Math.cosh(s) - 1) / -z;
      const S = z > 0 ? (s - Math.sin(s)) / (s * s * s) : (Math.sinh(s) - s) / (s * s * s);
      expect(Math.abs(series.C - C)).toBeLessThan(1e-14);
      expect(Math.abs(series.S - S)).toBeLessThan(1e-13);
    }
    expect(stumpff(0)).toEqual({ C: 0.5, S: 1 / 6 });
  });
});

describe('conicPosition', () => {
  const q = 0.6 * AU;

  it('is Kepler’s ellipse, down to e = 0.999', () => {
    for (const e of [0, 0.2, 0.9, 0.99, 0.999]) {
      for (const days of DAYS) {
        const got = conicPosition(q, e, days, MU, state());
        const want = ellipticPosition(q, e, days, MU);
        // Relative to where the body is: it is at q near perihelion and far out after.
        const r = Math.hypot(want.x, want.y);
        expect(Math.hypot(got.x - want.x, got.y - want.y) / r, `e ${e}, ${days} d`).toBeLessThan(1e-9);
      }
    }
  });

  it('is Barker’s parabola at e = 1 exactly', () => {
    for (const days of DAYS) {
      const got = conicPosition(q, 1, days, MU, state());
      const want = parabolic(q, days);
      expect(Math.hypot(got.x - want.x, got.y - want.y) / Math.hypot(want.x, want.y)).toBeLessThan(1e-10);
    }
  });

  it('is the hyperbola, from e = 1.001 to 3I/ATLAS’s 6.14', () => {
    for (const [qAu, e] of [[0.6, 1.001], [0.6, 1.5], [1.36, 6.14]] as const) {
      for (const days of DAYS) {
        const got = conicPosition(qAu * AU, e, days, MU, state());
        const want = hyperbolic(qAu * AU, e, days);
        expect(
          Math.hypot(got.x - want.x, got.y - want.y) / Math.hypot(want.x, want.y),
          `e ${e}, ${days} d`,
        ).toBeLessThan(1e-9);
      }
    }
  });

  it('goes smoothly through e = 1: no seam between ellipse, parabola and hyperbola', () => {
    // Two nanoths either side of the parabola, a year from perihelion: the three curves
    // must be the same place to within what that change in e moves it -- metres.
    for (const days of [-365.25, 1, 365.25]) {
      const parabola = conicPosition(q, 1, days, MU, state());
      for (const e of [1 - 2e-9, 1 + 2e-9]) {
        const near = conicPosition(q, e, days, MU, state());
        expect(Math.hypot(near.x - parabola.x, near.y - parabola.y)).toBeLessThan(10);
      }
    }
  });

  it('conserves energy and angular momentum on every conic', () => {
    for (const e of [0.5, 0.999, 1, 1.001, 6.14]) {
      for (const days of DAYS) {
        const s = conicPosition(q, e, days, MU, state());
        const r = Math.hypot(s.x, s.y);
        const v2 = s.vx * s.vx + s.vy * s.vy;
        // Specific energy -mu (1 - e) / 2q, and h = sqrt(mu q (1 + e)).
        const energy = v2 / 2 - MU / r;
        const expected = (-MU * (1 - e)) / (2 * q);
        expect(Math.abs(energy - expected) / (MU / q)).toBeLessThan(1e-9);
        const h = s.x * s.vy - s.y * s.vx;
        expect(h / Math.sqrt(MU * q * (1 + e))).toBeCloseTo(1, 9);
      }
    }
  });

  it('brings an ellipse back after whole periods', () => {
    const e = 0.967;
    const a = q / (1 - e);
    const periodDays = (2 * Math.PI * Math.sqrt((a * a * a) / MU)) / SECONDS_PER_DAY;
    const once = conicPosition(q, e, 40, MU, state());
    const later = conicPosition(q, e, 40 + 12 * periodDays, MU, state());
    expect(Math.hypot(later.x - once.x, later.y - once.y) / q).toBeLessThan(1e-7);
  });
});

describe('universalAnomaly', () => {
  it('solves the universal equation to float64 across conics and times', () => {
    const q = 1.2 * AU;
    for (const e of [0, 0.3, 0.97, 0.9999, 1, 1.0001, 2, 6.14]) {
      for (const days of [-500, -2, 0.001, 3, 77, 900]) {
        const t = days * SECONDS_PER_DAY;
        const chi = universalAnomaly(q, e, t, MU);
        const alpha = (1 - e) / q;
        const { S } = stumpff(alpha * chi * chi);
        const lhs = e * chi * chi * chi * S + q * chi;
        expect(Math.abs(lhs - Math.sqrt(MU) * t) / Math.max(1, Math.abs(lhs))).toBeLessThan(1e-12);
      }
    }
  });
});
