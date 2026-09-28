import { MAX_SAMPLES_PER_REQUEST } from '../config.ts';
import type { BodyDefinition, VectorTable } from '../types.ts';
import { callHorizons } from './client.ts';
import { parseVectors } from './parseVectors.ts';
import { addMinutes, MINUTES_PER_DAY, stepMinutes, toJulianDay, vectorQuery } from './queries.ts';
import { alignStop, refineSamples, type RefineOptions, type RefineResult, type Sampler } from './refine.ts';

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
 * refused. The end is then pulled back onto the coarse grid, which can drop up to one
 * coarse step at the end of coverage: a day, for a craft whose trajectory stops inside
 * the window, and it is where its prediction ends anyway.
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

  const result = await refineSamples(sampler, start, stop, base, options);
  return { table: result.table, sourceVersion, result };
}
