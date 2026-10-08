import type { BodyId, TableInfo, VectorTable } from '@sss/tools/types';

import { interpolateState } from './hermite.ts';
import type { StateVector } from './vec3.ts';

/**
 * A body's state vectors, split into files and fetched only when needed.
 *
 * The fast moons are why this exists. A year of Phobos alone is 35,000 samples, and a
 * year of every moon in the catalog is six times the entire twenty-year planetary set;
 * loading that up front would make the moons the heaviest thing on the site by far. Yet
 * any single instant needs one chunk per moon -- about 1500 samples, a couple of weeks
 * of Phobos or two years of Charon -- so that is all that is fetched.
 *
 * The cost is that a moon can be momentarily absent: the first frame that needs a chunk
 * asks for it and gets nothing back. That is the honest answer. The alternative, filling
 * in with Keplerian propagation while the file arrives, would put the moon somewhere
 * plausible and wrong, and then jump it to where it really is.
 *
 * Neighbouring chunks share their boundary sample (the generator writes them that way),
 * so any instant inside a chunk interpolates from that chunk alone.
 */

/**
 * The samples of `tables` -- consecutive pieces of one table, in time order -- from the
 * last at or before `startJd` to the first at or after `stopJd`, as one table.
 *
 * Neighbouring chunks share their boundary sample, and it is kept once. Where the
 * tables do not reach that far either way, they are taken to their end.
 */
export function samplesBetween(
  tables: readonly VectorTable[],
  startJd: number,
  stopJd: number,
): VectorTable | null {
  const first = tables[0];
  if (first === undefined) {
    return null;
  }
  const t: number[] = [];
  const x: number[] = [];
  const y: number[] = [];
  const z: number[] = [];
  const vx: number[] = [];
  const vy: number[] = [];
  const vz: number[] = [];
  for (const table of tables) {
    for (let k = 0; k < table.count; k += 1) {
      const time = table.t[k]!;
      const next = table.t[k + 1];
      const previousKept = t.at(-1);
      // Before the start, unless the next sample is past it; after the stop, once one
      // sample past it is kept; and the boundary sample a second time.
      if (next !== undefined && next <= startJd && time < startJd) {
        continue;
      }
      if (previousKept !== undefined && (time <= previousKept || previousKept >= stopJd)) {
        continue;
      }
      t.push(time);
      x.push(table.x[k]!);
      y.push(table.y[k]!);
      z.push(table.z[k]!);
      vx.push(table.vx[k]!);
      vy.push(table.vy[k]!);
      vz.push(table.vz[k]!);
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

/** Fetches chunk `index` of a body's table. */
export type ChunkLoader = (id: BodyId, index: number) => Promise<VectorTable>;

/**
 * How far into a chunk, as a fraction of its span, before the next one is fetched.
 *
 * Past three quarters the next chunk is asked for, and before one quarter the previous
 * one, so a clock running in either direction finds its next file already there. Not
 * both at once from the middle: a visitor watching LIVE never leaves the chunk they
 * started in, and would pay three times the bytes for nothing.
 */
export const PREFETCH_MARGIN = 0.25;

/** How long a failed chunk waits before it may be asked for again, in ms. */
export const RETRY_AFTER_MS = 10_000;

export class ChunkedTable {
  readonly id: BodyId;
  readonly #info: TableInfo & { readonly chunks: NonNullable<TableInfo['chunks']> };
  readonly #tables: (VectorTable | undefined)[];
  readonly #pending = new Map<number, Promise<void>>();
  readonly #failedAt = new Map<number, number>();
  readonly #load: ChunkLoader | null;
  readonly #now: () => number;

  constructor(id: BodyId, info: TableInfo, load: ChunkLoader | null, now = () => Date.now()) {
    const chunks = info.chunks;
    if (chunks === null || chunks.length === 0) {
      throw new Error(`${id} is not a chunked table.`);
    }
    this.id = id;
    this.#info = { ...info, chunks };
    this.#tables = new Array<VectorTable | undefined>(chunks.length);
    this.#load = load;
    this.#now = now;
  }

  get startJd(): number {
    return this.#info.startJd;
  }

  get stopJd(): number {
    return this.#info.stopJd;
  }

  get chunkCount(): number {
    return this.#info.chunks.length;
  }

  /** True when `jd` is inside the table's span, whether or not its chunk is here. */
  covers(jd: number): boolean {
    return jd >= this.#info.startJd && jd <= this.#info.stopJd;
  }

  /** Index of the chunk covering `jd`, or -1 outside the table. */
  indexAt(jd: number): number {
    if (!this.covers(jd)) {
      return -1;
    }
    // Last chunk starting at or before jd. A boundary instant belongs to both
    // neighbours; taking the later one is as good as the earlier.
    const chunks = this.#info.chunks;
    let low = 0;
    let high = chunks.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (chunks[mid]!.startJd <= jd) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    return low;
  }

  /** True once chunk `index` has arrived. */
  isLoaded(index: number): boolean {
    return this.#tables[index] !== undefined;
  }

  /**
   * The interpolated state at `jd`, or null when it cannot be answered yet.
   *
   * Null inside the span means the chunk is on its way: it has been asked for, and a
   * later frame will get an answer. Outside the span it means what it always means, and
   * the caller falls back to the osculating elements.
   */
  stateAt(jd: number): StateVector | null {
    const index = this.indexAt(jd);
    if (index < 0) {
      return null;
    }

    const table = this.#tables[index];
    if (table === undefined) {
      this.request(index);
      return null;
    }

    const chunk = this.#info.chunks[index]!;
    const progress = (jd - chunk.startJd) / (chunk.stopJd - chunk.startJd);
    if (progress > 1 - PREFETCH_MARGIN) {
      this.request(index + 1);
    } else if (progress < PREFETCH_MARGIN) {
      this.request(index - 1);
    }

    return interpolateState(table, jd);
  }

  /**
   * The interpolated state at `jd` if its chunk is already here, and nothing asked for
   * if it is not.
   *
   * For drawing a stretch of path rather than a point: a trajectory line samples its
   * craft at many instants, and fetching every chunk one of them landed in would pull
   * most of a mission's data for a line that has its own table to fall back on.
   */
  stateIfLoaded(jd: number): StateVector | null {
    const index = this.indexAt(jd);
    const table = index < 0 ? undefined : this.#tables[index];
    return table === undefined ? null : interpolateState(table, jd);
  }

  /**
   * The table's own samples spanning `startJd` to `stopJd` (see samplesBetween), if
   * every chunk they are in is here; null if one is not, and nothing asked for.
   *
   * For a trail drawn from the table itself: one turn of a close orbiter's orbit is a few
   * hours, inside the chunk the craft is being placed with, or the neighbour the clock
   * has already prefetched.
   */
  samplesIfLoaded(startJd: number, stopJd: number): VectorTable | null {
    const first = this.indexAt(Math.max(startJd, this.startJd));
    const last = this.indexAt(Math.min(stopJd, this.stopJd));
    if (first < 0 || last < 0 || last < first) {
      return null;
    }
    const tables: VectorTable[] = [];
    for (let index = first; index <= last; index += 1) {
      const table = this.#tables[index];
      if (table === undefined) {
        return null;
      }
      tables.push(table);
    }
    return samplesBetween(tables, startJd, stopJd);
  }

  /**
   * Asks for chunk `index`, once. Resolves when it has arrived or has failed.
   *
   * A failure is logged and the chunk is left alone for a while rather than asked for
   * again on the next frame -- sixty requests a second at a missing file is not a retry
   * policy. It does get asked for again, because a dropped connection is not permanent.
   */
  request(index: number): Promise<void> {
    if (index < 0 || index >= this.#tables.length || this.#tables[index] !== undefined) {
      return Promise.resolve();
    }
    const pending = this.#pending.get(index);
    if (pending !== undefined) {
      return pending;
    }
    const failedAt = this.#failedAt.get(index);
    if (failedAt !== undefined && this.#now() - failedAt < RETRY_AFTER_MS) {
      return Promise.resolve();
    }
    if (this.#load === null) {
      return Promise.resolve();
    }

    const promise = this.#load(this.id, index)
      .then((table) => {
        this.#tables[index] = table;
        this.#failedAt.delete(index);
      })
      .catch((error: unknown) => {
        this.#failedAt.set(index, this.#now());
        console.error(`Could not load vectors for ${this.id}, chunk ${index}`, error);
      })
      .finally(() => {
        this.#pending.delete(index);
      });
    this.#pending.set(index, promise);
    return promise;
  }

  /** Resolves once the chunk covering `jd` is here, or immediately outside the span. */
  whenLoadedAt(jd: number): Promise<void> {
    const index = this.indexAt(jd);
    return index < 0 ? Promise.resolve() : this.request(index);
  }
}
