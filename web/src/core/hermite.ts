import type { VectorTable } from '@sss/tools/types';

import { SECONDS_PER_DAY } from './time.ts';
import type { StateVector } from './vec3.ts';

/**
 * Cubic Hermite interpolation of the state vector tables.
 *
 * The tables hold a sample per day. At 60 fps we need a position for arbitrary
 * instants in between, and the choice of interpolant matters more than it looks:
 * measured against JPL at 1-hour resolution, plain linear interpolation misplaces
 * Mercury by 44,884 km, while cubic Hermite — which uses the velocity stored at each
 * sample as the curve's slope — misplaces it by 9.7 km. Four orders of magnitude,
 * for the cost of shipping velocities we already had.
 *
 * Residual error, worst case over the v1 catalog: Earth 32 m, Pluto 5.1 km,
 * Mercury 9.7 km. See the plan's freshness notes for the measurement.
 */

/**
 * Finds i such that t[i] <= jd < t[i+1], or -1 if jd is outside the table.
 *
 * Binary search rather than a scan: the tables are ~2200 samples and this runs for
 * every body on every frame.
 */
export function findInterval(t: readonly number[], jd: number): number {
  const last = t.length - 1;
  if (t.length < 2) {
    return -1;
  }
  const first = t[0];
  const final = t[last];
  if (first === undefined || final === undefined || jd < first || jd > final) {
    return -1;
  }
  // The final sample belongs to the last interval rather than starting a new one.
  if (jd === final) {
    return last - 1;
  }

  let low = 0;
  let high = last;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    const midValue = t[mid];
    if (midValue === undefined) {
      return -1;
    }
    if (midValue <= jd) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return low;
}

/**
 * Evaluates the Hermite basis for one component, returning position and its time
 * derivative.
 *
 * `h` is the interval width in days, and the velocities are km/s, so they are scaled
 * by seconds-per-day to become the curve's slope in km/day. The derivative is scaled
 * back at the end, which is what makes the returned velocity a real interpolated
 * velocity rather than a finite difference.
 */
function hermiteComponent(
  p0: number,
  v0: number,
  p1: number,
  v1: number,
  h: number,
  s: number,
): { value: number; derivative: number } {
  const m0 = v0 * SECONDS_PER_DAY;
  const m1 = v1 * SECONDS_PER_DAY;

  const s2 = s * s;
  const s3 = s2 * s;

  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;

  // Derivatives of the basis functions with respect to s.
  const d00 = 6 * s2 - 6 * s;
  const d10 = 3 * s2 - 4 * s + 1;
  const d01 = -6 * s2 + 6 * s;
  const d11 = 3 * s2 - 2 * s;

  return {
    value: h00 * p0 + h10 * h * m0 + h01 * p1 + h11 * h * m1,
    // d/dt = (d/ds) / h, then km/day back to km/s.
    derivative: (d00 * p0 + d10 * h * m0 + d01 * p1 + d11 * h * m1) / h / SECONDS_PER_DAY,
  };
}

/**
 * Interpolates a body's state at a TDB Julian day.
 *
 * Returns null when `jd` falls outside the table, which is the signal for the store
 * to fall back to Keplerian propagation and flag the result as approximate.
 */
export function interpolateState(table: VectorTable, jd: number): StateVector | null {
  const i = findInterval(table.t, jd);
  if (i < 0) {
    return null;
  }

  const t0 = table.t[i];
  const t1 = table.t[i + 1];
  if (t0 === undefined || t1 === undefined) {
    return null;
  }

  const h = t1 - t0;
  const s = (jd - t0) / h;

  const x = hermiteComponent(table.x[i]!, table.vx[i]!, table.x[i + 1]!, table.vx[i + 1]!, h, s);
  const y = hermiteComponent(table.y[i]!, table.vy[i]!, table.y[i + 1]!, table.vy[i + 1]!, h, s);
  const z = hermiteComponent(table.z[i]!, table.vz[i]!, table.z[i + 1]!, table.vz[i + 1]!, h, s);

  return {
    position: { x: x.value, y: y.value, z: z.value },
    velocity: { x: x.derivative, y: y.derivative, z: z.derivative },
  };
}

/** True when a table can answer for this instant without falling back. */
export function covers(table: VectorTable, jd: number): boolean {
  return findInterval(table.t, jd) >= 0;
}
