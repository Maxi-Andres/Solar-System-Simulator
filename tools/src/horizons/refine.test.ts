import { describe, expect, it } from 'vitest';

import type { VectorTable } from '../types.ts';
import { lastWithData, parseCoverageLimit } from './coverage.ts';
import { splitTable } from './fetchVectors.ts';
import { thinTable } from '../paths.ts';
import {
  alignStop,
  estimateIntervalErrors,
  missAt,
  refinedStep,
  refineSamples,
  type Sampler,
} from './refine.ts';

const MS_PER_DAY = 86_400_000;
const START = new Date(Date.UTC(2026, 0, 1));
const toJd = (date: Date): number => date.getTime() / MS_PER_DAY + 2440587.5;

/**
 * A path with one sharp encounter: straight-line cruise, plus a Gaussian swerve of
 * `depthKm` lasting about `widthMinutes`, centred `centreDays` into the span. Position
 * and velocity both analytic, so the refinement is judged against the truth rather
 * than against itself.
 */
function encounter(centreDays: number, widthMinutes: number, depthKm: number, jumpKm = 0) {
  const t0 = toJd(START) + centreDays;
  const w = widthMinutes / 1440;
  const cruise = 20; // km/s
  return (jd: number) => {
    const u = (jd - t0) / w;
    const g = depthKm * Math.exp(-u * u);
    // A step in position, for a seam: JPL's path handing over between files.
    const seam = jumpKm !== 0 && jd >= t0 ? jumpKm : 0;
    return {
      x: cruise * (jd - toJd(START)) * 86_400,
      y: g + seam,
      z: 0,
      vx: cruise,
      // dg/dt in km/s: d/djd, then per day to per second.
      vy: (-2 * u * g) / w / 86_400,
      vz: 0,
    };
  };
}

function samplerFor(path: ReturnType<typeof encounter>): { sampler: Sampler; calls: () => number } {
  let calls = 0;
  const sampler: Sampler = async (from, to, step) => {
    calls += 1;
    const columns = { t: [] as number[], x: [] as number[], y: [] as number[], z: [] as number[] };
    const velocity = { vx: [] as number[], vy: [] as number[], vz: [] as number[] };
    for (let ms = from.getTime(); ms <= to.getTime(); ms += step * 60_000) {
      const jd = ms / MS_PER_DAY + 2440587.5;
      const state = path(jd);
      columns.t.push(jd);
      columns.x.push(state.x);
      columns.y.push(state.y);
      columns.z.push(state.z);
      velocity.vx.push(state.vx);
      velocity.vy.push(state.vy);
      velocity.vz.push(state.vz);
    }
    return {
      id: 'probe',
      horizonsId: '-1',
      center: '500@0',
      count: columns.t.length,
      ...columns,
      ...velocity,
    };
  };
  return { sampler, calls: () => calls };
}

/** Worst true error of a table against its path, checked every minute. */
function trueError(table: VectorTable, path: ReturnType<typeof encounter>): number {
  let worst = 0;
  let i = 0;
  const first = table.t[0]!;
  const last = table.t.at(-1)!;
  for (let jd = first; jd <= last; jd += 1 / 1440) {
    while (i < table.count - 2 && table.t[i + 1]! <= jd) {
      i += 1;
    }
    const probe: VectorTable = {
      ...table,
      count: 3,
      t: [table.t[i]!, jd, table.t[i + 1]!],
      x: [table.x[i]!, path(jd).x, table.x[i + 1]!],
      y: [table.y[i]!, path(jd).y, table.y[i + 1]!],
      z: [table.z[i]!, path(jd).z, table.z[i + 1]!],
      vx: [table.vx[i]!, 0, table.vx[i + 1]!],
      vy: [table.vy[i]!, 0, table.vy[i + 1]!],
      vz: [table.vz[i]!, 0, table.vz[i + 1]!],
    };
    worst = Math.max(worst, missAt(probe, 0, 1, 2));
  }
  return worst;
}

describe('estimateIntervalErrors', () => {
  it('is zero for a cubic, which Hermite reproduces exactly', () => {
    const t = [0, 1, 2, 3, 4, 5, 6];
    const cubic = (s: number) => 3 * s ** 3 - 2 * s ** 2 + s;
    const slope = (s: number) => (9 * s ** 2 - 4 * s + 1) / 86_400;
    const table: VectorTable = {
      id: 'c',
      horizonsId: '0',
      center: '0',
      count: t.length,
      t,
      x: t.map(cubic),
      y: t.map(() => 0),
      z: t.map(() => 0),
      vx: t.map(slope),
      vy: t.map(() => 0),
      vz: t.map(() => 0),
    };
    for (const error of estimateIntervalErrors(table)) {
      expect(error).toBeLessThan(1e-9);
    }
  });

  it('has one entry per interval, even-length tables included', () => {
    const { sampler } = samplerFor(encounter(1, 60, 1000));
    return sampler(START, new Date(START.getTime() + 5 * MS_PER_DAY), 1440).then((table) => {
      expect(table.count).toBe(6);
      expect(estimateIntervalErrors(table)).toHaveLength(5);
    });
  });
});

describe('refinedStep', () => {
  it('lands on a whole divisor of the step, so the grids nest', () => {
    for (const error of [2, 10, 1e3, 1e6]) {
      const step = refinedStep(1440, error, 1, 1);
      expect(1440 % step, String(error)).toBe(0);
      expect(step).toBeLessThan(1440);
    }
  });

  it('follows the fourth-power law: sixteen times the error needs half the step', () => {
    expect(refinedStep(1440, 16, 1, 1)).toBe(720);
  });

  it('never goes below the floor', () => {
    expect(refinedStep(1440, 1e30, 1, 5)).toBe(5);
  });
});

describe('refineSamples', () => {
  it('meets the tolerance through an encounter, and spends samples only there', async () => {
    // A 300 km swerve lasting an hour, in the middle of twenty days of straight cruise.
    const path = encounter(10, 60, 300);
    const { sampler, calls } = samplerFor(path);
    const stop = new Date(START.getTime() + 20 * MS_PER_DAY);

    const result = await refineSamples(sampler, START, stop, 1440, {
      toleranceKm: 1,
      minStepMinutes: 1,
      margin: 4,
    });

    expect(trueError(result.table, path)).toBeLessThan(1);
    expect(result.worstEstimatedErrorKm).toBeLessThan(1);
    expect(result.discontinuities).toEqual([]);
    expect(result.requests).toBe(calls());
    expect(result.requests).toBeGreaterThan(1);
    // Uniform at the finest step would be 28,801 samples.
    expect(result.table.count).toBeLessThan(600);
    // The cruise either side keeps its one-day spacing.
    expect(result.table.t[1]! - result.table.t[0]!).toBeCloseTo(1, 9);
    expect(result.table.t.at(-1)! - result.table.t.at(-2)!).toBeCloseTo(1, 9);
  });

  it('keeps time strictly increasing across every splice', async () => {
    const path = encounter(3.3, 30, 5000);
    const { sampler } = samplerFor(path);
    const result = await refineSamples(sampler, START, new Date(START.getTime() + 8 * MS_PER_DAY), 1440, {
      toleranceKm: 0.1,
      minStepMinutes: 1,
      margin: 4,
    });
    for (let i = 1; i < result.table.count; i += 1) {
      expect(result.table.t[i]!).toBeGreaterThan(result.table.t[i - 1]!);
    }
  });

  it('leaves a path that needs nothing finer alone, in one request', async () => {
    const path = encounter(10, 60, 0);
    const { sampler } = samplerFor(path);
    const result = await refineSamples(sampler, START, new Date(START.getTime() + 20 * MS_PER_DAY), 1440, {
      toleranceKm: 1,
      minStepMinutes: 1,
      margin: 4,
    });
    expect(result.requests).toBe(1);
    expect(result.table.count).toBe(21);
  });

  it('reports a jump in the path once, where it is, instead of chasing it', async () => {
    // No swerve, just a 950 km step: Europa Clipper's 2026-12-12 hand-over, in miniature.
    const path = encounter(4.5, 60, 0, 950);
    const { sampler } = samplerFor(path);
    const result = await refineSamples(sampler, START, new Date(START.getTime() + 9 * MS_PER_DAY), 1440, {
      toleranceKm: 1,
      minStepMinutes: 1,
      margin: 4,
    });
    expect(result.discontinuities).toHaveLength(1);
    const seam = result.discontinuities[0]!;
    expect(Math.abs(seam.jd - (toJd(START) + 4.5)) * 1440).toBeLessThanOrEqual(2);
    expect(seam.jumpKm).toBeGreaterThan(900);
    expect(seam.jumpKm).toBeLessThan(1000);
    // And everywhere else is still inside the tolerance.
    expect(result.worstEstimatedErrorKm).toBeLessThan(1);
  });
});

describe('alignStop', () => {
  it('pulls the end back onto the grid', () => {
    const stop = alignStop(START, new Date(START.getTime() + 2.5 * MS_PER_DAY), 1440);
    expect(stop.getTime() - START.getTime()).toBe(2 * MS_PER_DAY);
  });
});

describe('splitTable', () => {
  it('cuts pieces that share their boundary sample and lose none', async () => {
    const { sampler } = samplerFor(encounter(1, 60, 0));
    const table = await sampler(START, new Date(START.getTime() + 10 * MS_PER_DAY), 1440);
    const pieces = splitTable(table, 4);
    expect(pieces.map((piece) => piece.count)).toEqual([4, 4, 4, 2]);
    for (let i = 1; i < pieces.length; i += 1) {
      expect(pieces[i]!.t[0]).toBe(pieces[i - 1]!.t.at(-1));
    }
    expect(pieces.at(-1)!.t.at(-1)).toBe(table.t.at(-1));
  });

  it('leaves a table that fits alone', async () => {
    const { sampler } = samplerFor(encounter(1, 60, 0));
    const table = await sampler(START, new Date(START.getTime() + 3 * MS_PER_DAY), 1440);
    expect(splitTable(table, 1500)).toEqual([table]);
  });
});

describe('parseCoverageLimit', () => {
  it("reads Horizons' refusal to the millisecond, and which edge it names", () => {
    expect(
      parseCoverageLimit(
        '\nNo ephemeris for target "Parker Solar Probe (spacecraft)" prior to A.D. ' +
          '2018-AUG-12 08:16:23.3431 TDB\n',
      ),
    ).toEqual({ side: 'start', date: new Date('2018-08-12T08:16:23.343Z') });
    expect(
      parseCoverageLimit(
        'No ephemeris for target "Voyager 1 (spacecraft)" after A.D. 2100-JAN-01 00:00:00.0000 TDB',
      ),
    ).toEqual({ side: 'stop', date: new Date('2100-01-01T00:00:00.000Z') });
  });

  it('returns null for anything else, rather than guessing', () => {
    expect(parseCoverageLimit('$$SOE\n2461000.5, ...\n$$EOE')).toBeNull();
    expect(parseCoverageLimit('No ephemeris for target "X" prior to A.D. 2018-XYZ-12 08:16:23 TDB')).toBeNull();
  });
});

describe('refineSamples, straight to the floor', () => {
  const options = { toleranceKm: 1, minStepMinutes: 1, margin: 4, samplesPerRequest: 1500 };

  it('finds a jump in two requests instead of descending to it', async () => {
    // The seam that cost eleven requests a level at a time: a run of a day or less at a
    // minute is one request, so the floor is reached at once.
    const path = encounter(4.5, 60, 0, 950);
    const levelled = await refineSamples(samplerFor(path).sampler, START, new Date(START.getTime() + 9 * MS_PER_DAY), 1440, {
      toleranceKm: 1,
      minStepMinutes: 1,
      margin: 4,
    });
    const direct = await refineSamples(samplerFor(path).sampler, START, new Date(START.getTime() + 9 * MS_PER_DAY), 1440, options);
    expect(direct.requests).toBeLessThan(levelled.requests);
    expect(direct.requests).toBeLessThanOrEqual(3);
    expect(direct.discontinuities).toHaveLength(1);
    expect(direct.discontinuities[0]!.jumpKm).toBeGreaterThan(900);
  });

  it('meets the tolerance through an encounter with no more requests', async () => {
    const path = encounter(10, 60, 300);
    const stop = new Date(START.getTime() + 20 * MS_PER_DAY);
    const levelled = await refineSamples(samplerFor(path).sampler, START, stop, 1440, {
      toleranceKm: 1,
      minStepMinutes: 1,
      margin: 4,
    });
    const direct = await refineSamples(samplerFor(path).sampler, START, stop, 1440, options);
    expect(direct.requests).toBeLessThanOrEqual(levelled.requests);
    expect(trueError(direct.table, path)).toBeLessThan(1);
  });

  it('is thinned back to what the curve needs, and still meets the tolerance', async () => {
    const path = encounter(10, 60, 300);
    const stop = new Date(START.getTime() + 20 * MS_PER_DAY);
    const direct = await refineSamples(samplerFor(path).sampler, START, stop, 1440, options);
    const thinned = thinTable(direct.table, [], 0.5);
    // The flagged run comes back at a minute -- hundreds of samples -- and the swerve
    // needs a small fraction of them.
    expect(direct.table.count).toBeGreaterThan(500);
    expect(thinned.count).toBeLessThan(direct.table.count / 4);
    expect(trueError(thinned, path)).toBeLessThan(1);
  });
});

describe('refineSamples, with a tolerance that varies along the path', () => {
  it('leaves a seam smaller than the local tolerance alone, and finds one larger', async () => {
    // A 30 km step, as ACE's trajectory files meet: chased at a fixed kilometre, let be
    // where the tolerance is 50 km, found again where it is 3. A seam is published once
    // it is about eight times the tolerance; see SPACECRAFT_ANGULAR_TOLERANCE.
    const path = encounter(4.5, 60, 0, 30);
    const stop = new Date(START.getTime() + 9 * MS_PER_DAY);
    const base = { toleranceKm: 1, minStepMinutes: 1, margin: 4, samplesPerRequest: 1500 };

    const fixed = await refineSamples(samplerFor(path).sampler, START, stop, 1440, base);
    const loose = await refineSamples(samplerFor(path).sampler, START, stop, 1440, {
      ...base,
      toleranceAt: () => 50,
    });
    const tight = await refineSamples(samplerFor(path).sampler, START, stop, 1440, {
      ...base,
      toleranceAt: () => 3,
    });

    expect(fixed.discontinuities).toHaveLength(1);
    expect(loose.requests).toBe(1);
    expect(loose.discontinuities).toEqual([]);
    expect(tight.discontinuities).toHaveLength(1);
  });

  it('never goes below the fixed tolerance, whatever the varying one asks', async () => {
    const path = encounter(10, 60, 300);
    const stop = new Date(START.getTime() + 20 * MS_PER_DAY);
    const options = { toleranceKm: 1, minStepMinutes: 1, margin: 4, samplesPerRequest: 1500 };
    const plain = await refineSamples(samplerFor(path).sampler, START, stop, 1440, options);
    const asksLess = await refineSamples(samplerFor(path).sampler, START, stop, 1440, {
      ...options,
      toleranceAt: () => 0.001,
    });
    expect(asksLess.table.count).toBe(plain.table.count);
  });
});

describe('lastWithData', () => {
  const start = new Date(Date.UTC(2021, 10, 24));
  const stated = new Date(Date.UTC(2031, 0, 1));
  const impact = new Date(Date.UTC(2022, 8, 26, 23, 14));
  const probe = (calls: { n: number }) => async (at: Date) => {
    calls.n += 1;
    return at.getTime() <= impact.getTime();
  };

  it('keeps a stated end that has data, in one question', async () => {
    const calls = { n: 0 };
    expect(await lastWithData(start, impact, probe(calls))).toEqual(impact);
    expect(calls.n).toBe(1);
  });

  it('finds where the data really stops, to a day, in a dozen questions', async () => {
    // DART: Horizons states years past the impact; the data stops at it.
    const calls = { n: 0 };
    const end = await lastWithData(start, stated, probe(calls));
    expect(end.getTime()).toBeLessThanOrEqual(impact.getTime());
    expect(impact.getTime() - end.getTime()).toBeLessThan(86_400_000);
    expect(calls.n).toBeLessThan(16);
  });

  it('refuses a span with no data even at its start', async () => {
    await expect(lastWithData(start, stated, async () => false)).rejects.toThrow(/No data/);
  });
});
