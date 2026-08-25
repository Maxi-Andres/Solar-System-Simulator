import { MAX_SAMPLES_PER_REQUEST } from '../config.ts';
import type { BodyDefinition, VectorTable } from '../types.ts';
import { callHorizons } from './client.ts';
import { parseVectors } from './parseVectors.ts';
import { addDays, vectorQuery } from './queries.ts';

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

/** Time spans to request, in order, covering [start, stop]. */
export function planChunks(
  start: Date,
  stop: Date,
  stepDays: number,
  maxSamples = MAX_SAMPLES_PER_REQUEST,
): { start: Date; stop: Date }[] {
  const totalDays = (stop.getTime() - start.getTime()) / 86_400_000;
  const samples = Math.floor(totalDays / stepDays) + 1;

  if (samples <= maxSamples) {
    return [{ start, stop }];
  }

  // Whole steps per chunk, so every boundary lands on the sampling grid and the
  // seams cannot introduce an off-grid sample.
  const stepsPerChunk = Math.max(1, maxSamples - 1);
  const chunkDays = stepsPerChunk * stepDays;

  const chunks: { start: Date; stop: Date }[] = [];
  for (let offset = 0; offset < totalDays; offset += chunkDays) {
    const chunkStart = addDays(start, offset);
    const chunkStop = addDays(start, Math.min(offset + chunkDays, totalDays));
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

/** Fetches one body's vectors over the window, chunking if necessary. */
export async function fetchVectors(
  body: BodyDefinition,
  start: Date,
  stop: Date,
): Promise<{ table: VectorTable; sourceVersion: string; chunks: number }> {
  // One extra step past the window, applied once to the whole span before it is
  // divided. Horizons stops at the last whole step before STOP_TIME, so without this
  // a 32-day step left the giants eight days short of the advertised window, where
  // they silently fell back to propagation.
  //
  // It has to be added here rather than inside the query builder: doing it per
  // request made every chunk overrun into the next one, and the stitched series went
  // backwards in time at each seam.
  const paddedStop = addDays(stop, body.stepDays);
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

  return { table: concatTables(parts), sourceVersion, chunks: chunks.length };
}
