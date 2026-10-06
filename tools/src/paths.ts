import type { Discontinuity } from './horizons/refine.ts';
import { missAt } from './horizons/refine.ts';
import type { PathTable, Seam, VectorTable } from './types.ts';

/**
 * A spacecraft's trajectory, cut down to what drawing it needs.
 *
 * The full table is sampled for the craft's *position*, to a kilometre everywhere, and
 * that is far more than a line needs: Parker Solar Probe's is 93,000 samples in 63
 * files, four megabytes, of which the app only ever holds the one or two around the
 * instant it is showing. Its line, though, has to be there whole.
 *
 * So the line gets a table of its own: a subset of the same samples, unchanged, chosen
 * so that Hermite interpolation through the subset stays within a tolerance of the full
 * table everywhere -- checked at every dropped sample and half way between each pair.
 *
 * **The tolerance is an angle, not a distance.** A line is only ever looked at from
 * somewhere, and the camera here always stands at a body: framing one, or pulled back
 * from one. A stretch of path 50 million km from everything can be off by thousands of
 * kilometres and nobody will ever see it; the same stretch during an Earth flyby, 8,600
 * km up, must be off by a kilometre or two. Measuring the tolerance as the angle it
 * subtends from the nearest body gives both from one rule, and it is the rule that
 * makes the file small: Voyager 1's twenty years come out as two samples, Parker's as
 * 1,300, while every flyby keeps the detail a camera standing at that planet would see.
 *
 * The camera can stand somewhere else too -- at the craft itself. That one place is the
 * app's to handle: it draws the stretch around the craft from the full table, which it
 * has loaded anyway to put the craft there.
 */

const SECONDS_PER_DAY = 86_400;

type Position = readonly [number, number, number];

/** Where something is at an instant, or null when that is not known. */
export type PositionAt = (jd: number) => Position | null;

/** The tolerance at one point of a path, km; the point is in the path's own frame. */
export type ToleranceAt = (jd: number, position: Position) => number;

/** Hermite position at `jd` inside interval [a, b] of a table. */
function hermiteAt(table: VectorTable, a: number, b: number, jd: number): Position {
  const h = table.t[b]! - table.t[a]!;
  const s = (jd - table.t[a]!) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = (s3 - 2 * s2 + s) * h * SECONDS_PER_DAY;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = (s3 - s2) * h * SECONDS_PER_DAY;
  return [
    h00 * table.x[a]! + h10 * table.vx[a]! + h01 * table.x[b]! + h11 * table.vx[b]!,
    h00 * table.y[a]! + h10 * table.vy[a]! + h01 * table.y[b]! + h11 * table.vy[b]!,
    h00 * table.z[a]! + h10 * table.vz[a]! + h01 * table.z[b]! + h11 * table.vz[b]!,
  ];
}

/** A table's interpolated position at `jd`, or null outside it. */
export function positionAt(table: VectorTable, jd: number): Position | null {
  const last = table.count - 1;
  if (last < 1 || jd < table.t[0]! || jd > table.t[last]!) {
    return null;
  }
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (table.t[mid]! <= jd) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return hermiteAt(table, low, high, jd);
}

/**
 * The tolerance rule: `angular` radians as seen from the nearest reference body, and
 * never less than `floorKm`.
 *
 * `references` are in the barycentric frame; `frameOrigin` is where the path's own
 * frame sits in it -- the barycentre itself for a craft about the Sun, Earth for JWST.
 * A reference with no position at an instant is skipped; with none at all the floor
 * applies, which is the strict answer rather than the cheap one.
 */
export function nearestBodyTolerance(
  references: readonly PositionAt[],
  frameOrigin: PositionAt,
  angular: number,
  floorKm: number,
): ToleranceAt {
  return (jd, [x, y, z]) => {
    const origin = frameOrigin(jd);
    if (origin === null) {
      return floorKm;
    }
    const px = x + origin[0];
    const py = y + origin[1];
    const pz = z + origin[2];
    let nearest = Infinity;
    for (const reference of references) {
      const at = reference(jd);
      if (at !== null) {
        nearest = Math.min(nearest, Math.hypot(px - at[0], py - at[1], pz - at[2]));
      }
    }
    return Number.isFinite(nearest) ? Math.max(floorKm, angular * nearest) : floorKm;
  };
}

/**
 * How far sample `k + 1` sits from where sample `k` would have arrived at the two
 * samples' mean velocity, km.
 *
 * On a smooth path that is the trapezoid rule's own error, which over the one-minute
 * intervals a seam is found at is metres. Across a seam it is the jump.
 */
function jumpAcross(table: VectorTable, k: number): number {
  const h = (table.t[k + 1]! - table.t[k]!) * SECONDS_PER_DAY;
  return Math.hypot(
    table.x[k + 1]! - table.x[k]! - (h * (table.vx[k]! + table.vx[k + 1]!)) / 2,
    table.y[k + 1]! - table.y[k]! - (h * (table.vy[k]! + table.vy[k + 1]!)) / 2,
    table.z[k + 1]! - table.z[k]! - (h * (table.vz[k]! + table.vz[k + 1]!)) / 2,
  );
}

/** Index of the sample at exactly `jd`, or -1. The tables are sorted. */
function sampleIndex(table: VectorTable, jd: number): number {
  let low = 0;
  let high = table.count - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const value = table.t[mid]!;
    if (value === jd) {
      return mid;
    }
    if (value < jd) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return -1;
}

/**
 * The seams in a finished table: which interval each discontinuity the refinement
 * reported is actually in, and how big it is.
 *
 * The refinement can only say "near here": its estimate is shared between the two
 * intervals either side of a dropped sample, so it reports the first of the two. Which
 * of them holds the jump is read off the table, and so is the size -- measured directly,
 * where the refinement's own figure is inferred from a miss.
 */
export function locateSeams(table: VectorTable, discontinuities: readonly Discontinuity[]): Seam[] {
  const seams: Seam[] = [];
  for (const discontinuity of discontinuities) {
    const first = sampleIndex(table, discontinuity.jd);
    if (first < 0) {
      throw new Error(
        `${table.id}: a discontinuity was reported at JD ${discontinuity.jd}, which is not a sample.`,
      );
    }
    let k = first;
    if (first + 2 < table.count && jumpAcross(table, first + 1) > jumpAcross(table, first)) {
      k = first + 1;
    }
    if (seams.at(-1)?.startJd === table.t[k]) {
      continue;
    }
    seams.push({ startJd: table.t[k]!, stopJd: table.t[k + 1]!, jumpKm: jumpAcross(table, k) });
  }
  return seams;
}

/**
 * The path: the fewest samples, greedily, through which Hermite stays within tolerance.
 *
 * From each kept sample the next one is pushed as far as it will go -- doubling, then
 * bisecting back -- and a candidate is only accepted once every sample it would drop,
 * and every midpoint between them, has been checked against the full table. The search
 * can skip a span that would have passed; it cannot accept one that fails.
 *
 * A seam is never interpolated across. Both of its samples are kept, and the interval
 * between them is listed in `gaps`.
 */
export function simplifyPath(
  table: VectorTable,
  seams: readonly Seam[],
  toleranceAt: ToleranceAt,
): PathTable {
  const n = table.count;
  if (n < 2) {
    throw new Error(`${table.id}: a path needs at least two samples.`);
  }

  const seamAt = new Set<number>();
  for (const seam of seams) {
    const k = sampleIndex(table, seam.startJd);
    if (k < 0 || k + 1 >= n || table.t[k + 1] !== seam.stopJd) {
      throw new Error(`${table.id}: the seam at JD ${seam.startJd} is not one of its intervals.`);
    }
    seamAt.add(k);
  }

  // Every tolerance up front: the search below asks about each point many times.
  const sampleTolerance = new Float64Array(n);
  const midTolerance = new Float64Array(n - 1);
  const midTruth = new Array<Position>(n - 1);
  for (let k = 0; k < n; k += 1) {
    sampleTolerance[k] = toleranceAt(table.t[k]!, [table.x[k]!, table.y[k]!, table.z[k]!]);
  }
  for (let k = 0; k + 1 < n; k += 1) {
    const jd = (table.t[k]! + table.t[k + 1]!) / 2;
    midTruth[k] = hermiteAt(table, k, k + 1, jd);
    midTolerance[k] = toleranceAt(jd, midTruth[k]!);
  }

  /** True when [a, c] interpolates every sample and midpoint inside it well enough. */
  const fits = (a: number, c: number): boolean => {
    for (let k = a + 1; k < c; k += 1) {
      if (missAt(table, a, k, c) > sampleTolerance[k]!) {
        return false;
      }
    }
    for (let k = a; k < c; k += 1) {
      const jd = (table.t[k]! + table.t[k + 1]!) / 2;
      const [x, y, z] = hermiteAt(table, a, c, jd);
      const [tx, ty, tz] = midTruth[k]!;
      if (Math.hypot(x - tx, y - ty, z - tz) > midTolerance[k]!) {
        return false;
      }
    }
    return true;
  };

  /** The strictest tolerance inside [a, c]: what that interval is held to. */
  const strictest = (a: number, c: number): number => {
    let value = Infinity;
    for (let k = a + 1; k < c; k += 1) {
      value = Math.min(value, sampleTolerance[k]!);
    }
    for (let k = a; k < c; k += 1) {
      value = Math.min(value, midTolerance[k]!);
    }
    return value;
  };

  const seamStarts = [...seamAt].sort((p, q) => p - q);
  const kept = [0];
  const tolerances: number[] = [];
  const gaps: number[] = [];
  let a = 0;
  let nextSeam = 0;
  while (a < n - 1) {
    while (nextSeam < seamStarts.length && seamStarts[nextSeam]! < a) {
      nextSeam += 1;
    }
    if (seamStarts[nextSeam] === a) {
      gaps.push(kept.length - 1);
      tolerances.push(0);
      kept.push(a + 1);
      a += 1;
      continue;
    }
    // Never past the start of the next seam.
    const limit = nextSeam < seamStarts.length ? seamStarts[nextSeam]! : n - 1;

    // One interval of the full table is the full table: it always fits.
    let good = a + 1;
    let bad = -1;
    let stride = 1;
    while (good < limit) {
      const candidate = Math.min(good + stride, limit);
      if (fits(a, candidate)) {
        good = candidate;
        stride *= 2;
      } else {
        bad = candidate;
        break;
      }
    }
    if (bad > 0) {
      while (bad - good > 1) {
        const middle = (good + bad) >> 1;
        if (fits(a, middle)) {
          good = middle;
        } else {
          bad = middle;
        }
      }
    }

    tolerances.push(strictest(a, good));
    kept.push(good);
    a = good;
  }

  const pick = (column: readonly number[]): number[] => kept.map((k) => column[k]!);
  return {
    id: table.id,
    horizonsId: table.horizonsId,
    center: table.center,
    count: kept.length,
    t: pick(table.t),
    x: pick(table.x),
    y: pick(table.y),
    z: pick(table.z),
    vx: pick(table.vx),
    vy: pick(table.vy),
    vz: pick(table.vz),
    toleranceKm: tolerances,
    gaps,
  };
}
