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
