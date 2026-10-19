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
 *
 * What is fetched is not kept forever: every table's chunks share one budget (see
 * ChunkBudget), and the ones least recently read are let go once it is full. A chunk let
 * go is fetched again, the same way, if the clock comes back to it.
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
  let previousKept = -Infinity;
  for (const table of tables) {
    // Straight to the last sample at or before the start, rather than past every one
    // before it: a table trail asks for a couple of hours out of two chunks of 1500
    // samples, every frame the clock outruns it.
    for (let k = lastAtOrBefore(table.t, startJd); k < table.count; k += 1) {
      const time = table.t[k]!;
      // Once one sample past the stop is kept, nothing later is.
      if (previousKept >= stopJd) {
        break;
      }
      // The boundary sample a second time.
      if (time <= previousKept) {
        continue;
      }
      previousKept = time;
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

/** Index of the last of `t` at or before `jd`; the first if none is. `t` is sorted. */
function lastAtOrBefore(t: readonly number[], jd: number): number {
  let low = 0;
  let high = t.length;
  // First sample after jd...
  while (low < high) {
    const mid = (low + high) >> 1;
    if (t[mid]! > jd) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  // ...and the one before it.
  return Math.max(low - 1, 0);
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

/**
 * What one sample of a chunk holds once parsed, in bytes: seven float64 columns -- t, x,
 * y, z, vx, vy, vz -- which V8 keeps unboxed in an array of doubles. A full chunk of
 * 1500 is 84 KB, from 121 KB of JSON.
 */
export const BYTES_PER_SAMPLE = 7 * 8;

/**
 * How much chunk data is kept, in bytes: 16 MiB.
 *
 * Measured on the generated data: 1,155 chunks over 506 tables -- the 70 of the manifest
 * and the 436 small moons -- 62 MB parsed if all of them were here. Before this every one
 * the clock passed stayed: the moons' two years at a week a second, under two minutes, is
 * all 138 chunks of the manifest's 20 fast moons, 11 MB, and the craft and the small
 * moons add the rest the same way. What a view reads is far less: the chunk each body is
 * placed with, and its neighbour while the clock is near a seam, is 6.9 MB for the
 * manifest's 70, plus 3.9 MB inside Saturn's system for its 283 small moons, the largest.
 * 16 MiB is half again that worst view, so what a frame reads never pushes out what the
 * same frame read; the rest is a cache for scrubbing back, at a quarter of the whole.
 */
export const CHUNK_BUDGET_BYTES = 16 * 1024 * 1024;

/**
 * Every table's chunks, held to one budget.
 *
 * The chunk read least recently goes first, and only when a new one arrives that would
 * take the total past the budget: nothing runs on a timer, and a paused clock frees
 * nothing. "Recently" is a counter, not the wall clock -- stamping a read is one
 * increment, where Date.now() thousands of times a frame would not be free, and a tab
 * left in the background does not age what it was showing.
 *
 * What is never let go: the chunk each body was last placed with (see ChunkedTable's
 * stateAt) -- one per body, 4.1 MB at most for the manifest's 70. Everything else a frame
 * reads -- the neighbour fetched ahead, the stretch a trail is drawn from -- is stamped as
 * it is read, so it is the newest there is, and goes only if a single frame read more
 * than the whole budget.
 */
export class ChunkBudget {
  readonly limitBytes: number;
  readonly #tables = new Set<ChunkedTable>();
  #bytes = 0;
  #clock = 0;

  constructor(limitBytes = CHUNK_BUDGET_BYTES) {
    this.limitBytes = limitBytes;
  }

  /** Chunk data held right now, bytes. */
  get bytes(): number {
    return this.#bytes;
  }

  /** A stamp later than every one before it. */
  stamp(): number {
    this.#clock += 1;
    return this.#clock;
  }

  /**
   * Makes room for `bytes` more of `table`'s, then counts them in.
   *
   * Called before the new chunk is in its table, so it is never what makes the room. A
   * scan of every table for the oldest, per chunk let go: about a thousand comparisons,
   * once per arrival, against the fetch and the JSON parse that came before it.
   */
  admit(table: ChunkedTable, bytes: number): void {
    this.#tables.add(table);
    while (this.#bytes + bytes > this.limitBytes) {
      let oldest: ChunkedTable | null = null;
      let oldestIndex = -1;
      let oldestStamp = Infinity;
      for (const candidate of this.#tables) {
        const index = candidate.leastRecentlyRead();
        if (index >= 0 && candidate.lastRead(index) < oldestStamp) {
          oldest = candidate;
          oldestIndex = index;
          oldestStamp = candidate.lastRead(index);
        }
      }
      if (oldest === null) {
        // All of it in use: over the budget rather than drop what is on screen.
        break;
      }
      this.#bytes -= oldest.evict(oldestIndex);
    }
    this.#bytes += bytes;
  }
}

export class ChunkedTable {
  readonly id: BodyId;
  readonly #info: TableInfo & { readonly chunks: NonNullable<TableInfo['chunks']> };
  readonly #tables: (VectorTable | undefined)[];
  readonly #pending = new Map<number, Promise<void>>();
  /** At most one entry per chunk, and cleared when it arrives. */
  readonly #failedAt = new Map<number, number>();
  readonly #load: ChunkLoader | null;
  readonly #now: () => number;
  /** Null for a table that keeps every chunk it fetches. */
  readonly #budget: ChunkBudget | null;
  /** The budget's stamp of each chunk's last read. */
  readonly #lastRead: Float64Array;
  /** The chunk the body was last placed with, which is never let go; -1 for none yet. */
  #current = -1;

  constructor(
    id: BodyId,
    info: TableInfo,
    load: ChunkLoader | null,
    now = () => Date.now(),
    budget: ChunkBudget | null = null,
  ) {
    const chunks = info.chunks;
    if (chunks === null || chunks.length === 0) {
      throw new Error(`${id} is not a chunked table.`);
    }
    this.id = id;
    this.#info = { ...info, chunks };
    this.#tables = new Array<VectorTable | undefined>(chunks.length);
    this.#load = load;
    this.#now = now;
    this.#budget = budget;
    this.#lastRead = new Float64Array(chunks.length);
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

    this.#current = index;
    const table = this.#tables[index];
    if (table === undefined) {
      this.request(index);
      return null;
    }
    this.#read(index);

    const chunk = this.#info.chunks[index]!;
    const progress = (jd - chunk.startJd) / (chunk.stopJd - chunk.startJd);
    if (progress > 1 - PREFETCH_MARGIN) {
      this.#want(index + 1);
    } else if (progress < PREFETCH_MARGIN) {
      this.#want(index - 1);
    }

    return interpolateState(table, jd);
  }

  /**
   * The neighbour the clock is heading for: asked for if it is not here, and counted as
   * read if it is, so it is not let go just before the clock gets there.
   */
  #want(index: number): void {
    if (this.#tables[index] !== undefined) {
      this.#read(index);
    } else {
      this.request(index);
    }
  }

  #read(index: number): void {
    if (this.#budget !== null) {
      this.#lastRead[index] = this.#budget.stamp();
    }
  }

  /** The budget's stamp of chunk `index`'s last read; for the budget. */
  lastRead(index: number): number {
    return this.#lastRead[index] ?? 0;
  }

  /**
   * The chunk here that was read longest ago and may be let go, or -1 if none may: the
   * one the body was last placed with may not. For the budget.
   */
  leastRecentlyRead(): number {
    let oldest = -1;
    for (let index = 0; index < this.#tables.length; index += 1) {
      if (
        this.#tables[index] !== undefined &&
        index !== this.#current &&
        (oldest < 0 || this.#lastRead[index]! < this.#lastRead[oldest]!)
      ) {
        oldest = index;
      }
    }
    return oldest;
  }

  /**
   * Lets chunk `index` go and returns the bytes that frees; for the budget.
   *
   * Nothing else holds on to it: every answer drawn from a chunk is a copy -- a state, or
   * samplesBetween's own arrays -- so the next read of that stretch simply finds it
   * missing, and asks for it again as it did the first time.
   */
  evict(index: number): number {
    const table = this.#tables[index];
    if (table === undefined) {
      return 0;
    }
    this.#tables[index] = undefined;
    return table.count * BYTES_PER_SAMPLE;
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
    if (table === undefined) {
      return null;
    }
    this.#read(index);
    return interpolateState(table, jd);
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
    for (let index = first; index <= last; index += 1) {
      this.#read(index);
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
        // Room first, so the arrival is not what is let go; then stamped, as the newest.
        this.#budget?.admit(this, table.count * BYTES_PER_SAMPLE);
        this.#tables[index] = table;
        this.#read(index);
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
