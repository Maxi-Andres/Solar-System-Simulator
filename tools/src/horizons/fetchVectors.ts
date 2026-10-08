import { MAX_SAMPLES_PER_REQUEST } from '../config.ts';
import { locateSeams, thinTable } from '../paths.ts';
import type { BodyDefinition, VectorTable } from '../types.ts';
import { callHorizons } from './client.ts';
import { parseVectors } from './parseVectors.ts';
import {
  addMinutes,
  fromJulianDay,
  MINUTES_PER_DAY,
  stepMinutes,
  toJulianDay,
  vectorQuery,
} from './queries.ts';
import { alignStop, refineSamples, type RefineOptions, type RefineResult, type Sampler } from './refine.ts';

/**
 * The tolerance thinning is held to, as a fraction of the refinement's: see
 * fetchMissionVectors.
 */
export const THINNING_FRACTION = 0.5;

/**
 * Fetches a body's state vectors, splitting the window when it would be too large.
 *
 * Mercury over twenty years at a one-day step is 7307 samples: a 1.4 MB response
 * taking three seconds, twenty-eight times the size of Neptune's. That single request
 * was reliably the first thing Horizons refused when busy — CI failed with four
 * consecutive 503s on Mercury while every other body succeeded.
 *
 * Splitting it into pieces of at most `MAX_SAMPLES_PER_REQUEST` makes each request
 * ordinary, and the pieces are stitched back together here. Chunk boundaries land on
 * the sampling grid, so the seams are indistinguishable from a single fetch — which
 * is asserted by a test.
 */

/**
 * Time spans to request, in order, covering [start, stop].
 *
 * Planned in whole minutes rather than days. A fifteen-minute step is 0.0104166...
 * days, and a boundary computed from that picks up float error in the last digit --
 * enough to land a millisecond off the grid, which Horizons would then round onto a
 * grid of its own.
 */
export function planChunks(
  start: Date,
  stop: Date,
  stepDays: number,
  maxSamples = MAX_SAMPLES_PER_REQUEST,
): { start: Date; stop: Date }[] {
  const step = stepMinutes(stepDays);
  const totalMinutes = (stop.getTime() - start.getTime()) / 60_000;
  const samples = Math.floor(totalMinutes / step) + 1;

  if (samples <= maxSamples) {
    return [{ start, stop }];
  }

  // Whole steps per chunk, so every boundary lands on the sampling grid and the
  // seams cannot introduce an off-grid sample.
  const stepsPerChunk = Math.max(1, maxSamples - 1);
  const chunkMinutes = stepsPerChunk * step;

  const chunks: { start: Date; stop: Date }[] = [];
  for (let offset = 0; offset < totalMinutes; offset += chunkMinutes) {
    const chunkStart = addMinutes(start, offset);
    const chunkStop = addMinutes(start, Math.min(offset + chunkMinutes, totalMinutes));
    chunks.push({ start: chunkStart, stop: chunkStop });
    if (chunkStop >= stop) {
      break;
    }
  }
  return chunks;
}

/** Joins consecutive tables, dropping the duplicated sample at each seam. */
export function concatTables(parts: readonly VectorTable[]): VectorTable {
  const first = parts[0];
  if (first === undefined) {
    throw new Error('Cannot concatenate an empty list of vector tables.');
  }
  if (parts.length === 1) {
    return first;
  }

  const t: number[] = [];
  const x: number[] = [];
  const y: number[] = [];
  const z: number[] = [];
  const vx: number[] = [];
  const vy: number[] = [];
  const vz: number[] = [];

  for (const part of parts) {
    for (let i = 0; i < part.count; i += 1) {
      const time = part.t[i]!;
      // Chunks share their boundary instant; keep it once. Compared with a tolerance
      // because Horizons rounds its Julian days.
      const previous = t[t.length - 1];
      if (previous !== undefined && Math.abs(time - previous) < 1e-6) {
        continue;
      }
      if (previous !== undefined && time < previous) {
        throw new Error(
          `Chunks for ${first.id} are out of order: ${time} follows ${previous}.`,
        );
      }
      t.push(time);
      x.push(part.x[i]!);
      y.push(part.y[i]!);
      z.push(part.z[i]!);
      vx.push(part.vx[i]!);
      vy.push(part.vy[i]!);
      vz.push(part.vz[i]!);
    }
  }

  return {
    id: first.id,
    horizonsId: first.horizonsId,
    center: first.center,
    count: t.length,
    t,
    x,
    y,
    z,
    vx,
    vy,
    vz,
  };
}

/**
 * Fetches one body's vectors over the window, chunking if necessary.
 *
 * Returns the stitched table and the pieces it was stitched from. The pieces are what
 * a short-window moon ships as: already a sensible size, already on the grid, and each
 * already carrying both of its boundary samples.
 */
export async function fetchVectors(
  body: BodyDefinition,
  start: Date,
  stop: Date,
): Promise<{
  table: VectorTable;
  parts: readonly VectorTable[];
  sourceVersion: string;
  chunks: number;
}> {
  // One extra step past the window, applied once to the whole span before it is
  // divided. Horizons stops at the last whole step before STOP_TIME, so without this
  // a 32-day step left the giants eight days short of the advertised window, where
  // they silently fell back to propagation.
  //
  // It has to be added here rather than inside the query builder: doing it per
  // request made every chunk overrun into the next one, and the stitched series went
  // backwards in time at each seam.
  const paddedStop = addMinutes(stop, stepMinutes(body.stepDays));
  const chunks = planChunks(start, paddedStop, body.stepDays);

  const parts: VectorTable[] = [];
  let sourceVersion = 'unknown';

  // Sequential within a body: the point of chunking is to reduce the load a single
  // body puts on the service, which firing all its pieces at once would undo.
  for (const [index, chunk] of chunks.entries()) {
    const label =
      chunks.length === 1
        ? `${body.name} vectors`
        : `${body.name} vectors ${index + 1}/${chunks.length}`;

    const response = await callHorizons(vectorQuery(body, chunk.start, chunk.stop), label);
    parts.push(parseVectors(response.result, body));
    sourceVersion = response.signature.version;
  }

  return { table: concatTables(parts), parts, sourceVersion, chunks: chunks.length };
}

/**
 * Splits a table into pieces of at most `maxSamples`, neighbours sharing their boundary
 * sample -- the layout a chunked table ships in, where any instant inside a piece must
 * be answerable from that piece alone.
 *
 * A moon's chunks are simply the requests it was fetched in. A spacecraft's cannot be:
 * its requests are one coarse sweep and dozens of short refinements, so they are cut
 * afresh from the finished table.
 */
export function splitTable(table: VectorTable, maxSamples: number): VectorTable[] {
  if (maxSamples < 2) {
    throw new Error('A chunk needs at least two samples to interpolate between.');
  }
  if (table.count <= maxSamples) {
    return [table];
  }
  const pieces: VectorTable[] = [];
  for (let from = 0; from < table.count - 1; from += maxSamples - 1) {
    const to = Math.min(from + maxSamples - 1, table.count - 1);
    pieces.push({
      ...table,
      count: to - from + 1,
      t: table.t.slice(from, to + 1),
      x: table.x.slice(from, to + 1),
      y: table.y.slice(from, to + 1),
      z: table.z.slice(from, to + 1),
      vx: table.vx.slice(from, to + 1),
      vy: table.vy.slice(from, to + 1),
      vz: table.vz.slice(from, to + 1),
    });
  }
  return pieces;
}

/**
 * The contiguous run of real samples in a table, as indices; null when there is none.
 *
 * A real state is never exactly zero in all six components -- that would be a craft at
 * rest at the centre of what it is measured from -- so a sample that is, is Horizons
 * filling a hole. Holes at either end are trimmed by the caller. One in the middle is
 * not something to trim around silently, and fails loudly instead.
 */
export function validRun(table: VectorTable): { first: number; last: number } | null {
  const zero = (i: number): boolean =>
    table.x[i] === 0 &&
    table.y[i] === 0 &&
    table.z[i] === 0 &&
    table.vx[i] === 0 &&
    table.vy[i] === 0 &&
    table.vz[i] === 0;
  let first = 0;
  while (first < table.count && zero(first)) {
    first += 1;
  }
  if (first === table.count) {
    return null;
  }
  let last = table.count - 1;
  while (zero(last)) {
    last -= 1;
  }
  for (let i = first; i <= last; i += 1) {
    if (zero(i)) {
      throw new Error(
        `${table.id}: Horizons returned zero vectors at JD ${table.t[i]}, between real ones.`,
      );
    }
  }
  return { first, last };
}

/**
 * The step for the tail of a path: the finest whole number of minutes that divides it
 * exactly -- so the last sample lands on the coverage edge -- with the samples still
 * fitting one request. Finest, because the refinement judges a run by its own samples,
 * and a tail of two would have nothing to judge; the surplus is thinned away after. A
 * tail is under one coarse step: at most a day for most craft, 32 days for the Voyagers.
 */
export function tailStep(minutes: number, samplesPerRequest: number): number {
  for (let step = Math.max(1, Math.ceil(minutes / (samplesPerRequest - 1))); step < minutes; step += 1) {
    if (minutes % step === 0) {
      return step;
    }
  }
  return minutes;
}

/** Two tables where the second starts on the first's last sample. */
function joinTables(head: VectorTable, tail: VectorTable): VectorTable {
  const rest = <K extends keyof VectorTable>(key: K) =>
    [...(head[key] as readonly number[]), ...(tail[key] as readonly number[]).slice(1)];
  return {
    ...head,
    count: head.count + tail.count - 1,
    t: rest('t'),
    x: rest('x'),
    y: rest('y'),
    z: rest('z'),
    vx: rest('vx'),
    vy: rest('vy'),
    vz: rest('vz'),
  };
}

/** Rounds a date to the nearest whole minute. */
function nearestMinute(date: Date): Date {
  return new Date(Math.round(date.getTime() / 60_000) * 60_000);
}

/** Rounds a date up, or down, onto a whole minute. */
function toMinute(date: Date, direction: 'up' | 'down'): Date {
  const minutes = date.getTime() / 60_000;
  return new Date((direction === 'up' ? Math.ceil(minutes) : Math.floor(minutes)) * 60_000);
}

/**
 * Fetches a spacecraft's vectors: the window cut to JPL's coverage, sampled adaptively.
 *
 * The span is the requested window where JPL covers all of it, and JPL's edge where it
 * does not -- rounded inwards to the minute, so the first and last requests are never
 * refused. The coarse grid stops at its last whole step before that edge, and the
 * remainder -- under a step -- is sampled on its own and spliced on: see `tailStep`.
 * Without it a craft lost up to a day at the end of its path, which for DART was the
 * last sixteen hours before it struck Dimorphos.
 */
export async function fetchMissionVectors(
  body: BodyDefinition,
  windowStart: Date,
  windowStop: Date,
  coverage: { readonly start: Date; readonly stop: Date },
  options: RefineOptions,
): Promise<{ table: VectorTable; sourceVersion: string; result: RefineResult }> {
  const start = toMinute(new Date(Math.max(windowStart.getTime(), coverage.start.getTime())), 'up');
  const end = toMinute(new Date(Math.min(windowStop.getTime(), coverage.stop.getTime())), 'down');
  const base = stepMinutes(body.stepDays);
  const stop = alignStop(start, end, base);
  if (stop.getTime() <= start.getTime()) {
    throw new Error(`${body.name} has no coverage inside the window.`);
  }

  let sourceVersion = 'unknown';
  let calls = 0;
  const sampler: Sampler = async (from, to, step) => {
    const parts: VectorTable[] = [];
    for (const chunk of planChunks(from, to, step / MINUTES_PER_DAY)) {
      calls += 1;
      const response = await callHorizons(
        vectorQuery({ ...body, stepDays: step / MINUTES_PER_DAY }, chunk.start, chunk.stop),
        `${body.name} vectors ${calls} (${step} min)`,
      );
      parts.push(parseVectors(response.result, body));
      sourceVersion = response.signature.version;
    }
    const table = concatTables(parts);
    // The refinement splices by index, so a request that came back off its grid -- a
    // sample missing at either end -- would splice the wrong samples together.
    const first = table.t[0];
    const last = table.t.at(-1);
    if (
      first === undefined ||
      last === undefined ||
      Math.abs(first - toJulianDay(from)) > 1e-6 ||
      Math.abs(last - toJulianDay(to)) > 1e-6
    ) {
      throw new Error(
        `${body.name}: asked for ${from.toISOString()} .. ${to.toISOString()} and got ` +
          `JD ${String(first)} .. ${String(last)}.`,
      );
    }
    return table;
  };

  // Where Horizons' trajectory files have a hole, it does not refuse the request as it
  // does outside coverage: it answers with zero vectors. Wind's ends in one -- from
  // 2026-12-12 to the coverage edge it reports, four days later, every state is
  // exactly zero, which would put the craft at Earth's centre. So the span is cut to
  // the samples that are real, from the coarse pass, before anything is refined.
  const coarse = await sampler(start, stop, base);
  const run = validRun(coarse);
  if (run === null) {
    throw new Error(`${body.name}: Horizons returned only zero vectors inside its coverage.`);
  }
  // To the nearest minute: these are samples on the grid already, and a Julian day read
  // back to a date can land a hair either side of its minute -- rounding down turned
  // Parker's 08:17 into 08:16 and broke the grid.
  const validStart = nearestMinute(fromJulianDay(coarse.t[run.first]!));
  const validStop = nearestMinute(fromJulianDay(coarse.t[run.last]!));
  if (run.first > 0 || run.last < coarse.count - 1) {
    console.log(
      `[fetch-data]   ${body.name}: Horizons returns zero vectors outside ` +
        `${validStart.toISOString().slice(0, 10)} .. ${validStop.toISOString().slice(0, 10)} ` +
        `inside its stated coverage; cut to the real samples`,
    );
  }

  const main = await refineSamples(sampler, validStart, validStop, base, options);
  // The tail past the last whole step, where the path really ends there -- not where
  // Horizons' zeros cut it, whose edge is only known to the coarse step.
  let result = main;
  const tailMinutes = Math.round((end.getTime() - stop.getTime()) / 60_000);
  if (run.last === coarse.count - 1 && tailMinutes > 0) {
    const step = tailStep(tailMinutes, options.samplesPerRequest ?? MAX_SAMPLES_PER_REQUEST);
    const tail = await refineSamples(sampler, stop, end, step, options);
    result = {
      table: joinTables(main.table, tail.table),
      requests: main.requests + tail.requests,
      finestStepMinutes: Math.min(main.finestStepMinutes, tail.finestStepMinutes),
      worstEstimatedErrorKm: Math.max(main.worstEstimatedErrorKm, tail.worstEstimatedErrorKm),
      discontinuities: [...main.discontinuities, ...tail.discontinuities],
    };
  }
  // Thinned to half the tolerance, so a sample dropped here and the estimate the
  // refinement stopped at cannot add up to more than one and a half times it.
  const seams = locateSeams(result.table, result.discontinuities);
  const table = thinTable(result.table, seams, (jd, position) =>
    THINNING_FRACTION *
    Math.max(options.toleranceKm, options.toleranceAt?.(jd, position) ?? options.toleranceKm),
  );
  return {
    table,
    sourceVersion,
    result: {
      ...result,
      table,
      // Rewritten to the seams' own first samples, which thinning always keeps.
      discontinuities: seams.map((seam) => ({ jd: seam.startJd, jumpKm: seam.jumpKm })),
    },
  };
}
