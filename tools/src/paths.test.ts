import { describe, expect, it } from 'vitest';

import { refineSamples, type Sampler } from './horizons/refine.ts';
import {
  locateSeams,
  nearestBodyTolerance,
  positionAt,
  simplifyPath,
  type PositionAt,
  type ToleranceAt,
} from './paths.ts';
import type { PathTable, VectorTable } from './types.ts';

const SECONDS_PER_DAY = 86_400;
const START_JD = 2_461_041.5; // 2026-01-01

interface State {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
}

/** Samples an analytic path at whole-minute steps over [from, to] days after START_JD. */
function sampleTable(path: (jd: number) => State, fromDays: number, toDays: number, stepMinutes: number): VectorTable {
  const t: number[] = [];
  const columns: Record<'x' | 'y' | 'z' | 'vx' | 'vy' | 'vz', number[]> = {
    x: [], y: [], z: [], vx: [], vy: [], vz: [],
  };
  const steps = Math.round(((toDays - fromDays) * 1440) / stepMinutes);
  for (let i = 0; i <= steps; i += 1) {
    const jd = START_JD + fromDays + (i * stepMinutes) / 1440;
    const state = path(jd);
    t.push(jd);
    for (const key of Object.keys(columns) as (keyof typeof columns)[]) {
      columns[key].push(state[key]);
    }
  }
  return { id: 'probe', horizonsId: '-1', center: '500@0', count: t.length, t, ...columns };
}

/** A circular orbit of radius `r` km and period `periodDays`, in the xy plane. */
function circle(r: number, periodDays: number) {
  const n = (2 * Math.PI) / (periodDays * SECONDS_PER_DAY); // rad/s
  return (jd: number): State => {
    const angle = n * (jd - START_JD) * SECONDS_PER_DAY;
    return {
      x: r * Math.cos(angle),
      y: r * Math.sin(angle),
      z: 0,
      vx: -r * n * Math.sin(angle),
      vy: r * n * Math.cos(angle),
      vz: 0,
    };
  };
}

/** Largest miss of the path against the full table, at every sample and midpoint. */
function worstMiss(full: VectorTable, path: PathTable, tolerance: ToleranceAt): number {
  let worst = 0;
  const check = (jd: number, truth: readonly [number, number, number]) => {
    const drawn = positionAt(path, jd)!;
    const miss = Math.hypot(drawn[0] - truth[0], drawn[1] - truth[1], drawn[2] - truth[2]);
    worst = Math.max(worst, miss / tolerance(jd, truth));
  };
  for (let k = 0; k < full.count; k += 1) {
    check(full.t[k]!, [full.x[k]!, full.y[k]!, full.z[k]!]);
    if (k + 1 < full.count) {
      const mid = (full.t[k]! + full.t[k + 1]!) / 2;
      check(mid, positionAt(full, mid)!);
    }
  }
  return worst;
}

describe('simplifyPath', () => {
  const full = sampleTable(circle(1.5e8, 365.25), 0, 400, 1440);
  const flat: ToleranceAt = () => 100;
  const path = simplifyPath(full, [], flat);

  it('keeps only real samples, the first and the last among them', () => {
    expect(path.t[0]).toBe(full.t[0]);
    expect(path.t.at(-1)).toBe(full.t.at(-1));
    for (let i = 0; i < path.count; i += 1) {
      const k = full.t.indexOf(path.t[i]!);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(path.x[i]).toBe(full.x[k]);
      expect(path.vy[i]).toBe(full.vy[k]);
    }
  });

  it('stays within tolerance of the full table everywhere it was checked', () => {
    expect(worstMiss(full, path, flat)).toBeLessThanOrEqual(1);
  });

  it('drops most of a smooth path', () => {
    // Hermite error over an arc of angle theta is r * theta^4 / 384; for 100 km at
    // 1 AU that allows arcs of 0.126 rad, 7.3 days, so 400 days needs about 55.
    expect(path.count).toBeGreaterThan(50);
    expect(path.count).toBeLessThan(65);
    expect(path.toleranceKm).toHaveLength(path.count - 1);
    expect(path.gaps).toEqual([]);
  });

  it('follows a stricter tolerance with more samples', () => {
    const strict = simplifyPath(full, [], () => 1);
    expect(strict.count).toBeGreaterThan(path.count * 2);
    expect(worstMiss(full, strict, () => 1)).toBeLessThanOrEqual(1);
  });

  it('keeps the detail only where the tolerance asks for it', () => {
    // Strict for the first 50 days, loose after. By the fourth-root law the arcs are
    // 2.3 days long in the first stretch and 23 in the second.
    const split: ToleranceAt = (jd) => (jd < START_JD + 50 ? 1 : 1e4);
    const mixed = simplifyPath(full, [], split);
    const early = mixed.t.filter((jd) => jd < START_JD + 50).length;
    const perDayEarly = early / 50;
    const perDayLate = (mixed.count - early) / 350;
    expect(perDayEarly).toBeGreaterThan(perDayLate * 5);
    expect(worstMiss(full, mixed, split)).toBeLessThanOrEqual(1);
  });
});

describe('seams', () => {
  /** Straight-line cruise at 20 km/s with a 5,000 km step in y at day 3. */
  const seamDay = 3;
  const jumpKm = 5000;
  const cruise = (jd: number): State => ({
    x: 20 * (jd - START_JD) * SECONDS_PER_DAY,
    y: jd >= START_JD + seamDay ? jumpKm : 0,
    z: 0,
    vx: 20,
    vy: 0,
    vz: 0,
  });

  /** The same refinement the generator runs, on the analytic path. */
  async function refined() {
    const sampler: Sampler = async (from, to, step) => {
      const fromDays = (from.getTime() / 86_400_000 + 2440587.5) - START_JD;
      const toDays = (to.getTime() / 86_400_000 + 2440587.5) - START_JD;
      return sampleTable(cruise, fromDays, toDays, step);
    };
    const start = new Date(Date.UTC(2026, 0, 1));
    const stop = new Date(Date.UTC(2026, 0, 7));
    return refineSamples(sampler, start, stop, 1440, {
      toleranceKm: 1,
      margin: 4,
      minStepMinutes: 1,
    });
  }

  it('finds the interval the jump is in, and measures it', async () => {
    const result = await refined();
    expect(result.discontinuities.length).toBeGreaterThan(0);
    const seams = locateSeams(result.table, result.discontinuities);
    expect(seams).toHaveLength(1);
    const [seam] = seams;
    // One minute wide, straddling the step.
    expect((seam!.stopJd - seam!.startJd) * 1440).toBeCloseTo(1, 6);
    expect(seam!.startJd).toBeLessThan(START_JD + seamDay);
    expect(seam!.stopJd).toBeGreaterThanOrEqual(START_JD + seamDay);
    expect(seam!.jumpKm).toBeCloseTo(jumpKm, 3);
  });

  it('picks the later interval when the refinement reports the one before', () => {
    const table = sampleTable(cruise, seamDay - 3 / 1440, seamDay + 3 / 1440, 1);
    const step = table.y.findIndex((y) => y > 0) - 1;
    // Report the interval before the one the step is in.
    const seams = locateSeams(table, [{ jd: table.t[step - 1]!, jumpKm: 0 }]);
    expect(seams[0]!.startJd).toBe(table.t[step]);
    expect(seams[0]!.jumpKm).toBeCloseTo(jumpKm, 3);
  });

  it('refuses a report that is not a sample', () => {
    const table = sampleTable(cruise, 0, 1, 60);
    expect(() => locateSeams(table, [{ jd: START_JD + 0.01, jumpKm: 1 }])).toThrow(/not a sample/);
  });

  it('is never interpolated across', async () => {
    const result = await refined();
    const seams = locateSeams(result.table, result.discontinuities);
    // A tolerance so loose that, without the seam, the whole week would be two samples.
    const path = simplifyPath(result.table, seams, () => 1e7);
    expect(path.gaps).toHaveLength(1);
    const gap = path.gaps[0]!;
    expect(path.t[gap]).toBe(seams[0]!.startJd);
    expect(path.t[gap + 1]).toBe(seams[0]!.stopJd);
    // Both sides are where the craft really was.
    expect(path.y[gap]).toBe(0);
    expect(path.y[gap + 1]).toBe(jumpKm);
    expect(path.count).toBe(4);
  });
});

describe('nearestBodyTolerance', () => {
  const sun: PositionAt = () => [0, 0, 0];
  const planet: PositionAt = () => [1e8, 0, 0];

  it('is the angle seen from the nearest body', () => {
    const tolerance = nearestBodyTolerance([sun, planet], () => [0, 0, 0], 1e-4, 1);
    expect(tolerance(0, [5e7, 0, 0])).toBeCloseTo(5000, 6);
    expect(tolerance(0, [1e8 + 2e6, 0, 0])).toBeCloseTo(200, 6);
  });

  it('never goes below the floor', () => {
    const tolerance = nearestBodyTolerance([sun, planet], () => [0, 0, 0], 1e-4, 1);
    expect(tolerance(0, [1e8 + 100, 0, 0])).toBe(1);
  });

  it('measures from where the path frame really is', () => {
    // A path relative to the planet, as JWST's is to Earth.
    const tolerance = nearestBodyTolerance([sun, planet], planet, 1e-4, 1);
    expect(tolerance(0, [1.5e6, 0, 0])).toBeCloseTo(150, 6);
  });

  it('falls back to the floor when nothing has a position', () => {
    const tolerance = nearestBodyTolerance([() => null], () => [0, 0, 0], 1e-4, 1);
    expect(tolerance(0, [1e9, 0, 0])).toBe(1);
  });
});
