import type { VectorTable } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import { covers, findInterval, interpolateState } from './hermite.ts';

/**
 * A body on a circular orbit, sampled daily. Analytic, so the interpolator can be
 * checked against a known curve rather than against itself.
 */
function circularOrbit(radiusKm: number, periodDays: number, samples: number): VectorTable {
  const omega = (2 * Math.PI) / (periodDays * 86_400); // rad/s
  const t: number[] = [];
  const x: number[] = [];
  const y: number[] = [];
  const z: number[] = [];
  const vx: number[] = [];
  const vy: number[] = [];
  const vz: number[] = [];

  for (let i = 0; i < samples; i += 1) {
    const jd = 2461000.5 + i;
    const angle = omega * (i * 86_400);
    t.push(jd);
    x.push(radiusKm * Math.cos(angle));
    y.push(radiusKm * Math.sin(angle));
    z.push(0);
    vx.push(-radiusKm * omega * Math.sin(angle));
    vy.push(radiusKm * omega * Math.cos(angle));
    vz.push(0);
  }

  return { id: 'test', horizonsId: '0', center: '500@0', count: samples, t, x, y, z, vx, vy, vz };
}

const ORBIT = circularOrbit(149_597_870.7, 365.25, 40);

describe('findInterval', () => {
  it('locates the bracketing interval', () => {
    expect(findInterval(ORBIT.t, 2461000.5)).toBe(0);
    // Samples sit at .5, so 2461001.25 falls inside interval 0, not 1.
    expect(findInterval(ORBIT.t, 2461001.25)).toBe(0);
    expect(findInterval(ORBIT.t, 2461001.5)).toBe(1);
    expect(findInterval(ORBIT.t, 2461010.0)).toBe(9);
  });

  it('assigns the final sample to the last interval, not a new one', () => {
    const last = ORBIT.t[ORBIT.t.length - 1]!;
    expect(findInterval(ORBIT.t, last)).toBe(ORBIT.t.length - 2);
  });

  it('rejects instants outside the table', () => {
    expect(findInterval(ORBIT.t, 2461000.4)).toBe(-1);
    expect(findInterval(ORBIT.t, 2461999)).toBe(-1);
  });

  it('rejects tables too short to interpolate', () => {
    expect(findInterval([], 1)).toBe(-1);
    expect(findInterval([2461000.5], 2461000.5)).toBe(-1);
  });
});

describe('interpolateState', () => {
  it('reproduces the samples exactly at the sample times', () => {
    for (const i of [0, 1, 17, ORBIT.count - 1]) {
      const state = interpolateState(ORBIT, ORBIT.t[i]!);

      expect(state).not.toBeNull();
      expect(state!.position.x).toBeCloseTo(ORBIT.x[i]!, 6);
      expect(state!.position.y).toBeCloseTo(ORBIT.y[i]!, 6);
      expect(state!.velocity.x).toBeCloseTo(ORBIT.vx[i]!, 9);
      expect(state!.velocity.y).toBeCloseTo(ORBIT.vy[i]!, 9);
    }
  });

  it('stays on the circle between samples', () => {
    const radius = 149_597_870.7;
    let worstError = 0;

    for (let jd = ORBIT.t[0]!; jd < ORBIT.t[30]!; jd += 0.05) {
      const state = interpolateState(ORBIT, jd)!;
      const r = Math.hypot(state.position.x, state.position.y, state.position.z);
      worstError = Math.max(worstError, Math.abs(r - radius));
    }

    // A day is ~1/365 of the orbit, so cubic Hermite tracks the arc to metres.
    expect(worstError).toBeLessThan(1);
  });

  it('returns a real interpolated velocity, not a finite difference', () => {
    // On a circular orbit the speed is constant, so any midpoint must match it.
    const expectedSpeed = Math.hypot(ORBIT.vx[0]!, ORBIT.vy[0]!);

    for (const jd of [2461000.9, 2461005.3, 2461012.5]) {
      const state = interpolateState(ORBIT, jd)!;
      const speed = Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z);

      expect(speed).toBeCloseTo(expectedSpeed, 6);
    }
  });

  it('keeps velocity consistent with the position it reports', () => {
    // Differentiate the reported positions numerically and compare with the
    // reported velocity: they must agree, or the two halves disagree about motion.
    //
    // The step cannot be arbitrarily small. A Julian day of ~2.46e6 has a float64
    // ulp of 5.5e-10 days, so h = 1e-6 leaves only ~1800 representable steps and the
    // central difference carries ~5e-4 relative noise. h = 1e-3 days (86 s) gives
    // ~5e-7 noise while keeping the O(h^2) truncation error negligible.
    const jd = 2461007.4;
    const h = 1e-3;
    const before = interpolateState(ORBIT, jd - h)!;
    const after = interpolateState(ORBIT, jd + h)!;
    const state = interpolateState(ORBIT, jd)!;

    const numericVx = (after.position.x - before.position.x) / (2 * h * 86_400);
    const numericVy = (after.position.y - before.position.y) / (2 * h * 86_400);

    expect(state.velocity.x / numericVx).toBeCloseTo(1, 5);
    expect(state.velocity.y / numericVy).toBeCloseTo(1, 5);
  });

  it('beats linear interpolation by orders of magnitude', () => {
    // The claim that justifies shipping velocities alongside positions.
    const jd = 2461000.5 + 0.5;
    const hermiteState = interpolateState(ORBIT, jd)!;
    const linearX = (ORBIT.x[0]! + ORBIT.x[1]!) / 2;
    const linearY = (ORBIT.y[0]! + ORBIT.y[1]!) / 2;

    const radius = 149_597_870.7;
    const hermiteError = Math.abs(Math.hypot(hermiteState.position.x, hermiteState.position.y) - radius);
    const linearError = Math.abs(Math.hypot(linearX, linearY) - radius);

    expect(hermiteError * 1000).toBeLessThan(linearError);
  });

  it('returns null outside the table so the caller can fall back', () => {
    expect(interpolateState(ORBIT, 2460000)).toBeNull();
    expect(interpolateState(ORBIT, 2462000)).toBeNull();
  });
});

describe('covers', () => {
  it('reports whether an instant is inside the table', () => {
    expect(covers(ORBIT, 2461005)).toBe(true);
    expect(covers(ORBIT, 2460000)).toBe(false);
  });
});
