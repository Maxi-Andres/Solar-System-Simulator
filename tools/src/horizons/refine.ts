import type { VectorTable } from '../types.ts';
import { addMinutes } from './queries.ts';

/**
 * Adaptive sampling, for the bodies no single step can serve: spacecraft.
 *
 * A planet's path bends the same way all year, so one spacing measured once is right
 * everywhere along it. A spacecraft's does not. Juice cruises for months on a curve a
 * one-day step follows well inside a kilometre, then swings past Earth at 13 km/s 8,640 km up,
 * where the same step misses closest approach by 41,783 km.
 * Parker Solar Probe spends most of each 88-day orbit far from the Sun and a few days
 * of it at 190 km/s skimming it. Sampling everything at the step the worst hour needs
 * would be a million samples per craft, nearly all of them wasted.
 *
 * So the step is chosen where it is needed, by measuring rather than by knowing the
 * mission. Fetch at a coarse step; estimate the interpolation error of every interval
 * from the samples themselves; fetch the intervals that miss the tolerance again at a
 * finer step; repeat until none do.
 *
 * **The estimate.** Cubic Hermite's error grows as the fourth power of the spacing.
 * Drop every other sample and interpolate the dropped ones from their neighbours: the
 * miss at each dropped sample is the error at twice the spacing, so the error at the
 * spacing actually stored is that divided by 2^4 = 16. It needs no reference data and
 * no knowledge of what bent the path -- a flyby, a perihelion or a burn all show up the
 * same way, as samples the curve through their neighbours does not pass through.
 *
 * **The grid.** Every refined step divides the step it refines, so the finer samples
 * land on the coarse ones at both ends of a run and the two can be spliced without an
 * off-grid seam. All steps are whole minutes, the unit Horizons takes them in.
 */

/** Fetches samples from `start` to `stop` inclusive, `stepMinutes` apart. */
export type Sampler = (start: Date, stop: Date, stepMinutes: number) => Promise<VectorTable>;

export interface RefineOptions {
  /**
   * Largest interpolation error allowed, km: everywhere, or -- with `toleranceAt` --
   * wherever that asks for less.
   */
  readonly toleranceKm: number;
  /**
   * The tolerance at a point of the path, km, when it varies along it; the point is in
   * the path's own frame. Never taken below `toleranceKm`. See SPACECRAFT_ANGULAR_TOLERANCE.
   */
  readonly toleranceAt?: (jd: number, position: readonly [number, number, number]) => number;
  /**
   * How much larger the true error may be than the estimate, as a factor the estimate
   * is multiplied by before it is compared with the tolerance. See ESTIMATE_MARGIN.
   */
  readonly margin: number;
  /** Finest step the refinement may reach, minutes. */
  readonly minStepMinutes: number;
  /**
   * Samples one request can return. A flagged run that fits in one request at the
   * floor step is fetched at the floor straight away. Optional: without it the
   * refinement descends one fourth-power step at a time, as it first did.
   */
  readonly samplesPerRequest?: number;
}

/**
 * Where the true error can exceed the estimate, and by how much: measured.
 *
 * The fourth-power law holds for the interval as a whole, but at a flyby the fourth
 * derivative peaks sharply at closest approach, and a dropped sample rarely sits exactly
 * there. Against Horizons at one-minute spacing, refined to 1 km by the bare estimate:
 *
 *   encounter                         estimated   true      ratio
 *   Parker perihelion, 2025-12-12      0.980 km   0.967 km   0.99
 *   Juice at Earth, 2026-09-28         0.933 km   1.806 km   1.94
 *   Psyche at Mars, 2026-05-15         0.938 km   1.959 km   2.09
 *
 * Twice the worst ratio seen. It costs little, because the step needed scales as the
 * fourth root of the tolerance: four times stricter is 41% more samples, and only
 * inside the encounters.
 */
export const ESTIMATE_MARGIN = 4;

/**
 * A place the path itself jumps, rather than bends: found at the step floor, where the
 * miss is still over the tolerance and no finer step exists to try.
 *
 * Real, and in JPL's data rather than ours. Horizons stitches a spacecraft's path from
 * a sequence of trajectory files, and where one hands over to the next the two need not
 * agree -- Europa Clipper's navigation prediction gives way to its pre-launch reference
 * trajectory on 2026-12-12 with a 954 km step between them, and Psyche's path steps
 * 239,500 km in one minute on 2026-12-01. Interpolating across it
 * smears the step over one minute, which is the most faithful thing a continuous curve
 * can do with a discontinuity, and it is reported rather than hidden.
 */
export interface Discontinuity {
  /** Julian day (TDB) at the start of the interval the jump is in. */
  readonly jd: number;
  /**
   * Size of the jump, km: twice the miss at the step floor, because a curve through
   * both sides of a step passes half way up it. Measured against Horizons directly,
   * Europa Clipper's is 953.7 km and this reads 954.
   */
  readonly jumpKm: number;
}

/** One run of the table sampled at a single step: what the error estimate works on. */
interface Segment {
  readonly stepMinutes: number;
  readonly table: VectorTable;
}

export interface RefineResult {
  readonly table: VectorTable;
  /** Requests made, including the first coarse one. */
  readonly requests: number;
  /** Finest step actually used anywhere, minutes. */
  readonly finestStepMinutes: number;
  /**
   * Largest error estimated anywhere outside the discontinuities, km, margin included.
   * Under the tolerance by construction.
   */
  readonly worstEstimatedErrorKm: number;
  /** Where the floor was reached with the tolerance still missed. */
  readonly discontinuities: readonly Discontinuity[];
}

const MS_PER_DAY = 86_400_000;
const SECONDS_PER_DAY = 86_400;

/** Hermite position at fraction `s` of an interval `h` days wide. Velocities km/s. */
function hermite(p0: number, v0: number, p1: number, v1: number, hDays: number, s: number): number {
  const m0 = v0 * SECONDS_PER_DAY * hDays;
  const m1 = v1 * SECONDS_PER_DAY * hDays;
  const s2 = s * s;
  const s3 = s2 * s;
  return (
    (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * m1
  );
}

/** Miss, km, at sample `k` when interpolated from samples `a` and `b` alone. */
export function missAt(table: VectorTable, a: number, k: number, b: number): number {
  const h = table.t[b]! - table.t[a]!;
  const s = (table.t[k]! - table.t[a]!) / h;
  const dx = hermite(table.x[a]!, table.vx[a]!, table.x[b]!, table.vx[b]!, h, s) - table.x[k]!;
  const dy = hermite(table.y[a]!, table.vy[a]!, table.y[b]!, table.vy[b]!, h, s) - table.y[k]!;
  const dz = hermite(table.z[a]!, table.vz[a]!, table.z[b]!, table.vz[b]!, h, s) - table.z[k]!;
  return Math.hypot(dx, dy, dz);
}

/**
 * Estimated interpolation error of every interval of a uniformly sampled table, km.
 *
 * Entry i is for the interval between samples i and i+1. Each odd sample is dropped and
 * interpolated from its neighbours, and that miss over sixteen is charged to both
 * intervals it sits between. The last interval of an even-length table has no odd
 * sample of its own, so it takes the estimate from the pair ending there.
 *
 * A table of two samples has nothing to drop and is reported as exact. That is only
 * reached at the end of coverage, one interval long.
 */
export function estimateIntervalErrors(table: VectorTable): number[] {
  const intervals = table.count - 1;
  const errors = new Array<number>(Math.max(0, intervals)).fill(0);
  if (table.count < 3) {
    return errors;
  }
  for (let k = 1; k + 1 < table.count; k += 2) {
    const estimate = missAt(table, k - 1, k, k + 1) / 16;
    errors[k - 1] = Math.max(errors[k - 1]!, estimate);
    errors[k] = Math.max(errors[k]!, estimate);
  }
  if (table.count % 2 === 0) {
    const last = table.count - 1;
    const estimate = missAt(table, last - 2, last - 1, last) / 16;
    errors[last - 2] = Math.max(errors[last - 2]!, estimate);
    errors[last - 1] = Math.max(errors[last - 1]!, estimate);
  }
  return errors;
}

/**
 * The step to refine an interval to: the largest whole divisor of `stepMinutes` whose
 * estimated error meets the tolerance, by the fourth-power law.
 *
 * Never less than the floor, and never the step itself -- a flagged interval always gets
 * finer, or the loop would not end.
 */
export function refinedStep(
  stepMinutes: number,
  errorKm: number,
  toleranceKm: number,
  minStepMinutes: number,
): number {
  const needed = stepMinutes * (toleranceKm / errorKm) ** 0.25;
  let best = 0;
  for (let divisor = 2; divisor <= stepMinutes; divisor += 1) {
    if (stepMinutes % divisor !== 0) {
      continue;
    }
    const candidate = stepMinutes / divisor;
    if (candidate < minStepMinutes) {
      break;
    }
    best = candidate;
    if (candidate <= needed) {
      break;
    }
  }
  return best === 0 ? stepMinutes : best;
}

/** A slice [from, to] of a table's samples, inclusive. */
function slice(table: VectorTable, from: number, to: number): VectorTable {
  return {
    ...table,
    count: to - from + 1,
    t: table.t.slice(from, to + 1),
    x: table.x.slice(from, to + 1),
    y: table.y.slice(from, to + 1),
    z: table.z.slice(from, to + 1),
    vx: table.vx.slice(from, to + 1),
    vy: table.vy.slice(from, to + 1),
    vz: table.vz.slice(from, to + 1),
  };
}

/** Joins tables that share their boundary samples. */
function join(parts: readonly VectorTable[]): VectorTable {
  const first = parts[0]!;
  const columns = { t: [] as number[], x: [] as number[], y: [] as number[], z: [] as number[] };
  const velocity = { vx: [] as number[], vy: [] as number[], vz: [] as number[] };
  for (const [index, part] of parts.entries()) {
    const from = index === 0 ? 0 : 1;
    for (let i = from; i < part.count; i += 1) {
      columns.t.push(part.t[i]!);
      columns.x.push(part.x[i]!);
      columns.y.push(part.y[i]!);
      columns.z.push(part.z[i]!);
      velocity.vx.push(part.vx[i]!);
      velocity.vy.push(part.vy[i]!);
      velocity.vz.push(part.vz[i]!);
    }
  }
  return { ...first, count: columns.t.length, ...columns, ...velocity };
}

/** Julian day (TDB, as Horizons labels it) back to the Date the sampler was asked with. */
function dateOf(jd: number): Date {
  // Rounded to the minute: every sample the refinement ever asks about is on a
  // whole-minute grid, and Horizons prints its instants to a tenth of a millisecond.
  const ms = (jd - 2440587.5) * MS_PER_DAY;
  return new Date(Math.round(ms / 60_000) * 60_000);
}

/**
 * Samples [start, stop] so that every interval's estimated error meets the tolerance.
 *
 * `start` to `stop` must be a whole number of `baseStepMinutes`. Runs of flagged
 * intervals are re-fetched as one request each, at the step the worst interval in the
 * run needs; the new run is then checked like any other, so a region that needed more
 * than the fourth-power law predicted is refined again.
 */
export async function refineSamples(
  sampler: Sampler,
  start: Date,
  stop: Date,
  baseStepMinutes: number,
  options: RefineOptions,
): Promise<RefineResult> {
  let requests = 1;
  let finest = baseStepMinutes;
  let worst = 0;
  const discontinuities: Discontinuity[] = [];

  const refine = async (segment: Segment): Promise<VectorTable> => {
    const errors = estimateIntervalErrors(segment.table).map((error) => error * options.margin);
    const tolerances = intervalTolerances(segment.table, options);
    const flagged = errors.map((error, k) => error > tolerances[k]!);
    const canRefine = segment.stepMinutes > options.minStepMinutes;

    const parts: VectorTable[] = [];
    let cursor = 0;
    let i = 0;
    while (i < flagged.length) {
      if (!flagged[i]) {
        worst = Math.max(worst, errors[i]!);
        i += 1;
        continue;
      }
      if (!canRefine) {
        // The estimate is spread over the two intervals either side of a dropped
        // sample; report the jump once, at the first of them.
        const jd = segment.table.t[i]!;
        const previous = discontinuities.at(-1);
        const pairDays = (2 * segment.stepMinutes) / 1440;
        if (previous === undefined || jd - previous.jd > pairDays + 1e-9) {
          // Back from the estimate to the miss itself, and from the miss to the jump.
          discontinuities.push({ jd, jumpKm: (errors[i]! / options.margin) * 16 * 2 });
        }
        i += 1;
        continue;
      }
      // One run of consecutive flagged intervals, re-fetched as a single request.
      // The worst run member as a multiple of its own tolerance, which is what the
      // fourth-power law is asked to bring down to one.
      let j = i;
      let runWorst = 0;
      while (j < flagged.length && flagged[j]) {
        runWorst = Math.max(runWorst, errors[j]! / tolerances[j]!);
        j += 1;
      }
      // Straight to the floor when the whole run fits in one request there. The
      // fourth-power law picks a step that should suffice, and for a smooth bend it
      // does; for a seam or a burn it never does, and the descent from a day to a
      // minute cost a request per level -- eleven for each of ACE's dozens of seams,
      // four hundred requests before it was stopped. One request at the floor costs no
      // more than one at any coarser step, and the surplus samples it brings are
      // thinned away afterwards (see `thinTable`).
      const runMinutes = Math.round(
        (segment.table.t[j]! - segment.table.t[i]!) * 1440,
      );
      const fitsAtFloor =
        options.samplesPerRequest !== undefined &&
        runMinutes / options.minStepMinutes + 1 <= options.samplesPerRequest;
      const step = fitsAtFloor
        ? options.minStepMinutes
        : refinedStep(segment.stepMinutes, runWorst, 1, options.minStepMinutes);
      if (cursor < i) {
        parts.push(slice(segment.table, cursor, i));
      }
      const fine = await sampler(dateOf(segment.table.t[i]!), dateOf(segment.table.t[j]!), step);
      requests += 1;
      finest = Math.min(finest, step);
      parts.push(await refine({ stepMinutes: step, table: fine }));
      cursor = j;
      i = j;
    }
    if (parts.length === 0) {
      return segment.table;
    }
    if (cursor < segment.table.count - 1) {
      parts.push(slice(segment.table, cursor, segment.table.count - 1));
    }
    return join(parts);
  };

  const base = await sampler(start, stop, baseStepMinutes);
  const table = await refine({ stepMinutes: baseStepMinutes, table: base });

  return {
    table,
    requests,
    finestStepMinutes: finest,
    worstEstimatedErrorKm: worst,
    discontinuities,
  };
}

/**
 * Each interval's tolerance, km: the fixed one, or the varying one taken at the
 * interval's middle, never below the fixed one.
 */
function intervalTolerances(table: VectorTable, options: RefineOptions): number[] {
  const intervals = Math.max(0, table.count - 1);
  const toleranceAt = options.toleranceAt;
  if (toleranceAt === undefined) {
    return new Array<number>(intervals).fill(options.toleranceKm);
  }
  const tolerances = new Array<number>(intervals);
  for (let k = 0; k < intervals; k += 1) {
    const middle: [number, number, number] = [
      (table.x[k]! + table.x[k + 1]!) / 2,
      (table.y[k]! + table.y[k + 1]!) / 2,
      (table.z[k]! + table.z[k + 1]!) / 2,
    ];
    tolerances[k] = Math.max(
      options.toleranceKm,
      toleranceAt((table.t[k]! + table.t[k + 1]!) / 2, middle),
    );
  }
  return tolerances;
}

/** Where the refinement's own samples must land for `stop - start` to be whole steps. */
export function alignStop(start: Date, stop: Date, stepMinutes: number): Date {
  const minutes = Math.floor((stop.getTime() - start.getTime()) / 60_000 / stepMinutes) * stepMinutes;
  return addMinutes(start, minutes);
}
