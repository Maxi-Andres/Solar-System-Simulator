import {
  QUASAR_ABS_V,
  QUASAR_BV,
  QUASAR_BYTES,
  QUASAR_POSITION_UNIT_PC,
  QUASARS_DIR,
  QUASARS_INFO_FILE,
  SZ_CLUSTER_BYTES,
  type QuasarsInfo,
} from '@sss/tools/quasars';

import { httpBeltFetchers, type BeltFetchers } from './belt.ts';
import { beginLoading } from './loading.ts';
import { renderDemand } from './renderDemand.ts';
import { LazySource } from './satellites.ts';

/**
 * The quasars of SDSS DR16Q (tools/src/quasars/): 750 thousand of them, every one with a
 * spectrum, out to z 7 -- 28 billion light years -- each at its redshift's comoving distance in
 * Planck 2018, the record-holders' and the last-scattering sphere's cosmology (planck.ts in the
 * tools says why not the cosmic web's). With them, the Planck SZ clusters: a thousand clusters
 * over the whole sky to z 1. Drawn by scene/Quasars.tsx.
 *
 * ## Fetched in pieces
 *
 * quasars.json first (what the rest hold), then the chunks, most luminous first -- each the next
 * 131,072 down in absolute V, so any number of them from the first is the catalogue's most
 * luminous quasars -- as the camera passes QUASARS_FROM_PC, or when the layer is switched on,
 * up to the device's budget (quasarChunkBudget); and sz-clusters.bin (22 kB) with the first.
 *
 * ## When it is not published
 *
 * As the cosmic web's (core/cosmicWeb.ts): the data is built by a deploy step that may fail
 * without failing the deploy, the build says whether it has it (vite.config.ts VITE_QUASARS),
 * and a site without it asks for nothing.
 */

/** Whether this build carries quasars/ (vite.config.ts): read once, at build time. */
export const QUASARS_PUBLISHED: boolean = (import.meta.env as Record<string, unknown> | undefined)?.['VITE_QUASARS'] === '1';

/** A light year, pc. */
const LIGHT_YEAR_PC = 0.30660139378555057;
/** The camera's distance from the Sun past which the quasars are fetched: a billion light years, past Laniakea's catalogue, where the nearest of them (z 0.1) begin. */
export const QUASARS_FROM_PC = 1e9 * LIGHT_YEAR_PC;

/**
 * The most chunks a device is given: all of them where it says nothing of itself or has 8 GB or
 * more; four (half a million) with 4 GB; two with less, or with a touch screen as its only
 * pointer. As the cosmic web's galaxies (cosmicWeb.ts galaxyChunkBudget).
 */
export function quasarChunkBudget(
  chunks: number,
  device: { readonly memoryGb?: number | undefined; readonly coarsePointer?: boolean | undefined } = {},
): number {
  let most = chunks;
  if (device.memoryGb !== undefined && device.memoryGb < 8) most = device.memoryGb >= 4 ? 4 : 2;
  if (device.coarsePointer === true) most = Math.min(most, 2);
  return Math.max(1, Math.min(chunks, most));
}

export function deviceQuasarBudget(chunks: number): number {
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { deviceMemory?: number });
  const coarse =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches
      : false;
  return quasarChunkBudget(chunks, { memoryGb: nav?.deviceMemory, coarsePointer: coarse });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** quasars.json, checked to be what this app reads: its units and record layout. */
export function parseQuasarsInfo(raw: unknown): QuasarsInfo {
  const quasars = isRecord(raw) ? raw['quasars'] : undefined;
  if (
    !isRecord(raw) ||
    raw['positionUnitPc'] !== QUASAR_POSITION_UNIT_PC ||
    !isRecord(quasars) ||
    quasars['bytesPerQuasar'] !== QUASAR_BYTES ||
    !Array.isArray(quasars['chunks']) ||
    !isRecord(raw['footprint'])
  ) {
    throw new Error('quasars.json is not the description of quasars this app reads.');
  }
  const info = raw as unknown as QuasarsInfo;
  for (const chunk of info.quasars.chunks) {
    if (!/^[\w.-]+$/.test(chunk.file) || chunk.bytes !== chunk.count * QUASAR_BYTES) {
      throw new Error(`quasars.json lists a chunk it cannot be: ${chunk.file}, ${chunk.bytes} bytes for ${chunk.count} quasars.`);
    }
  }
  const clusters = info.clusters;
  if (clusters !== null && (!/^[\w.-]+$/.test(clusters.file) || clusters.bytes !== clusters.count * SZ_CLUSTER_BYTES)) {
    throw new Error(`quasars.json lists SZ clusters it cannot be: ${clusters.file}, ${clusters.bytes} bytes for ${clusters.count}.`);
  }
  return info;
}

/** A chunk of quasars-<k>.bin: its columns as typed arrays (QUASAR_BYTES). */
export interface QuasarChunk {
  readonly count: number;
  /** x, y, z a quasar, scene frame, QUASAR_POSITION_UNIT_PC. */
  readonly positions: Int16Array;
  readonly absV: Uint8Array;
  readonly bv: Uint8Array;
  readonly flags: Uint8Array;
}

export function parseQuasarChunk(buffer: ArrayBuffer, count: number): QuasarChunk {
  if (buffer.byteLength !== count * QUASAR_BYTES) {
    throw new Error(`A quasar chunk is ${buffer.byteLength} bytes, not the ${count * QUASAR_BYTES} quasars.json says.`);
  }
  const bytes = new Uint8Array(buffer);
  return {
    count,
    positions: new Int16Array(buffer, 0, count * 3),
    absV: bytes.subarray(6 * count, 7 * count),
    bv: bytes.subarray(7 * count, 8 * count),
    flags: bytes.subarray(8 * count, 9 * count),
  };
}

/** An absolute V byte's magnitude (NaN: not known). */
export function quasarAbsVOf(code: number): number {
  return code === QUASAR_ABS_V.unknown ? Number.NaN : QUASAR_ABS_V.min + code * QUASAR_ABS_V.step;
}

/** A B-V byte's colour index (NaN: not known). */
export function quasarBvOf(code: number): number {
  return code === QUASAR_BV.unknown ? Number.NaN : QUASAR_BV.min + code * QUASAR_BV.step;
}

/**
 * A quasar's dot, 0 to 1, by its luminosity: the floor of a map, not its light (the light is
 * drawn too). Whole at the catalogue's 5th percentile of absolute V, DOT_LEAST at its 95th and
 * fainter; unknown, DOT_LEAST. So the map says which are the luminous ones -- and, the
 * catalogue being flux-limited, that the far ones all are.
 */
export const DOT_LEAST = 0.25;

export function quasarDot(absV: number, percentiles: { readonly p5: number; readonly p95: number }): number {
  if (!Number.isFinite(absV)) return DOT_LEAST;
  const t = Math.min(1, Math.max(0, (percentiles.p95 - absV) / (percentiles.p95 - percentiles.p5)));
  return DOT_LEAST + (1 - DOT_LEAST) * t;
}

/** sz-clusters.bin, read: places (pc, scene frame), redshifts and masses (10^14 solar masses, NaN unknown). */
export interface SzClusters {
  readonly count: number;
  readonly positions: Float32Array;
  readonly z: Float32Array;
  readonly mass: Float32Array;
}

export function parseSzClusters(buffer: ArrayBuffer, count: number): SzClusters {
  if (buffer.byteLength !== count * SZ_CLUSTER_BYTES) {
    throw new Error(`sz-clusters.bin is ${buffer.byteLength} bytes, not the ${count * SZ_CLUSTER_BYTES} quasars.json says.`);
  }
  return {
    count,
    positions: new Float32Array(buffer, 0, count * 3),
    z: new Float32Array(buffer, count * 12, count),
    mass: new Float32Array(buffer, count * 16, count),
  };
}

/** The quasars, a prefix of the chunks: request(n) fetches what of the first n is missing, one after another, each published as it lands. */
export class QuasarChunks {
  readonly #info: LazySource<QuasarsInfo>;
  readonly #fetchers: BeltFetchers;
  readonly #basePath: string;
  readonly #listeners = new Set<() => void>();
  #chunks: QuasarChunk[] = [];
  #wanted = 0;
  #loading = false;
  #failedAt = 0;

  constructor(info: LazySource<QuasarsInfo>, fetchers: BeltFetchers, basePath: string) {
    this.#info = info;
    this.#fetchers = fetchers;
    this.#basePath = basePath;
  }

  get chunks(): readonly QuasarChunk[] {
    return this.#chunks;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  request(chunks: number): void {
    this.#wanted = Math.max(this.#wanted, chunks);
    void this.#pump();
  }

  async #pump(): Promise<void> {
    if (this.#loading || Date.now() - this.#failedAt < 60_000) return;
    this.#loading = true;
    // Named on the loading line only while chunks come: quasars.json is a LazySource, named by itself.
    let end = (): void => {};
    try {
      await this.#info.request();
      const info = this.#info.value;
      if (info === null) return;
      const all = info.quasars.chunks;
      if (this.#chunks.length >= Math.min(this.#wanted, all.length)) return;
      end = beginLoading('the quasars');
      while (this.#chunks.length < Math.min(this.#wanted, all.length)) {
        const chunk = all[this.#chunks.length]!;
        const buffer = await this.#fetchers.binary(`${this.#basePath}data/${QUASARS_DIR}/${chunk.file}`, { expectedBytes: chunk.bytes });
        if (buffer === null) return;
        this.#chunks = [...this.#chunks, parseQuasarChunk(buffer, chunk.count)];
        for (const listener of this.#listeners) listener();
        renderDemand.request();
      }
    } catch (error: unknown) {
      this.#failedAt = Date.now();
      console.error('Could not load the quasars', error);
    } finally {
      end();
      this.#loading = false;
    }
  }
}

export interface QuasarSource {
  readonly info: LazySource<QuasarsInfo>;
  readonly quasars: QuasarChunks;
  readonly clusters: LazySource<SzClusters>;
}

export function quasarSource(fetchers: BeltFetchers, basePath = '/', published = QUASARS_PUBLISHED): QuasarSource {
  const info = new LazySource<QuasarsInfo>(async () => {
    if (!published) return null;
    const raw = await fetchers.json(`${basePath}data/${QUASARS_DIR}/${QUASARS_INFO_FILE}`);
    return raw === null ? null : parseQuasarsInfo(raw);
  }, 'the quasars');
  const clusters = new LazySource<SzClusters>(async () => {
    await info.request();
    const described = info.value?.clusters ?? null;
    if (described === null) return null;
    const buffer = await fetchers.binary(`${basePath}data/${QUASARS_DIR}/${described.file}`, { expectedBytes: described.bytes });
    return buffer === null ? null : parseSzClusters(buffer, described.count);
  }, 'the Planck SZ clusters');
  return { info, quasars: new QuasarChunks(info, fetchers, basePath), clusters };
}

let shared: QuasarSource | null = null;

/** The app's one source: made when first asked for, as the scene mounts -- it fetches nothing until the camera is far enough out. */
export function sharedQuasarSource(): QuasarSource {
  shared ??= quasarSource(httpBeltFetchers, import.meta.env.BASE_URL);
  return shared;
}
