import {
  COSMIC_WEB_ABS_V,
  COSMIC_WEB_BV,
  COSMIC_WEB_FILAMENT_CATALOGUES,
  COSMIC_WEB_FLAGS,
  COSMIC_WEB_GALAXY_BYTES,
  COSMIC_WEB_POSITION_UNIT_PC,
  type CosmicWebInfo,
} from '@sss/tools/types';

import type { BeltFetchers } from './belt.ts';
import { renderDemand } from './renderDemand.ts';
import { LazySource } from './satellites.ts';

/**
 * The cosmic web past Laniakea's catalogue (tools/src/cosmicWeb/): the filaments the galaxies are
 * strung along -- Tempel et al. 2014's in the SDSS main sample to z 0.155, Malavasi et al. 2020's
 * in BOSS to z 0.75 -- and the 1.8 million galaxies of the two SDSS redshift surveys, each at its
 * redshift's comoving distance in Laniakea's own cosmology (H0 74.6, Omega_m 0.3), so a cluster
 * G3 also holds is drawn once and the map has no seam. Drawn by scene/CosmicWeb.tsx.
 *
 * ## Fetched in pieces
 *
 * cosmic-web.json first (32 kB: what the rest hold), then filaments.bin (2.5 MB) as the camera
 * passes FILAMENTS_FROM_PC, and the galaxies' chunks (2.4 MB each, seven) from GALAXIES_FROM_PC,
 * one after another, the most luminous first -- each chunk the next quarter million down in
 * absolute V, across both surveys, so any number of them from the first is the surveys' most
 * luminous galaxies -- up to the device's budget (galaxyChunkBudget).
 *
 * ## When it is not published
 *
 * The data is built by a step of the deploy that may fail without failing the deploy (its hosts
 * turn GitHub's runners away more than most): a site can be published without it. The build
 * says whether it has it (vite.config.ts COSMIC_WEB_PUBLISHED), so a site without it asks for
 * nothing -- not a 404 in the console -- and the layers draw nothing. A run of the data cut
 * short leaves no cosmic-web.json (it is written last), which reads as no cosmic web too.
 */

/** Whether this build carries cosmic-web/ (vite.config.ts): read once, at build time. */
export const COSMIC_WEB_PUBLISHED: boolean = (import.meta.env as Record<string, unknown> | undefined)?.['VITE_COSMIC_WEB'] === '1';

/** The camera's distance from the Sun, pc, past which the filaments are fetched: 100 Mpc, the near edge of the SDSS main sample's filaments (35 Mpc) well inside. */
export const FILAMENTS_FROM_PC = 100e6;
/** And the galaxies: 300 Mpc, where the SDSS volume is a region seen from outside its nearest part. */
export const GALAXIES_FROM_PC = 300e6;

/**
 * The most chunks of galaxies a device is given: all seven where it says nothing of itself or
 * has 8 GB or more; four (a million galaxies, 12 MB on the GPU) with 4 GB; two with less, or
 * with a touch screen as its only pointer -- a phone or tablet, whose GPU fills a screen of
 * dots far more slowly. navigator.deviceMemory is Chromium's alone, rounded, capped at 8.
 */
export function galaxyChunkBudget(
  chunks: number,
  device: { readonly memoryGb?: number | undefined; readonly coarsePointer?: boolean | undefined } = {},
): number {
  let most = chunks;
  if (device.memoryGb !== undefined && device.memoryGb < 8) most = device.memoryGb >= 4 ? 4 : 2;
  if (device.coarsePointer === true) most = Math.min(most, 2);
  return Math.max(1, Math.min(chunks, most));
}

/** This browser's budget (galaxyChunkBudget). */
export function deviceChunkBudget(chunks: number): number {
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { deviceMemory?: number });
  const coarse =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches
      : false;
  return galaxyChunkBudget(chunks, { memoryGb: nav?.deviceMemory, coarsePointer: coarse });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** cosmic-web.json, checked to be what this app reads: the units and the record layout it was written with. */
export function parseCosmicWebInfo(raw: unknown): CosmicWebInfo {
  const galaxies = isRecord(raw) ? raw['galaxies'] : undefined;
  const filaments = isRecord(raw) ? raw['filaments'] : undefined;
  if (
    !isRecord(raw) ||
    raw['positionUnitPc'] !== COSMIC_WEB_POSITION_UNIT_PC ||
    !isRecord(galaxies) ||
    galaxies['bytesPerGalaxy'] !== COSMIC_WEB_GALAXY_BYTES ||
    !Array.isArray(galaxies['chunks']) ||
    !isRecord(filaments) ||
    typeof filaments['lines'] !== 'number' ||
    !Array.isArray(filaments['catalogues']) ||
    !isRecord(raw['footprints'])
  ) {
    throw new Error('cosmic-web.json is not the description of a cosmic web this app reads.');
  }
  const info = raw as unknown as CosmicWebInfo;
  for (const chunk of info.galaxies.chunks) {
    if (!/^[\w.-]+$/.test(chunk.file) || chunk.bytes !== chunk.count * COSMIC_WEB_GALAXY_BYTES) {
      throw new Error(`cosmic-web.json lists a chunk it cannot be: ${chunk.file}, ${chunk.bytes} bytes for ${chunk.count} galaxies.`);
    }
  }
  return info;
}

// ---------------------------------------------------------------------------------------
// The filaments

/** filaments.bin, read: its columns as typed arrays, positions in COSMIC_WEB_POSITION_UNIT_PC. */
export interface CosmicWebFilaments {
  readonly lines: number;
  readonly vertices: number;
  /** Each line's first vertex, and one past the last line's. */
  readonly starts: Uint32Array;
  /** x, y, z a vertex, scene frame, 0.1 Mpc. */
  readonly positions: Int16Array;
  /** The catalogue's value a vertex, a byte: info.filaments.catalogues[].vertexValue says what. */
  readonly values: Uint8Array;
  /** Each line's catalogue, COSMIC_WEB_FILAMENT_CATALOGUES. */
  readonly catalogues: Uint8Array;
}

export function parseFilaments(buffer: ArrayBuffer, info: CosmicWebInfo['filaments']): CosmicWebFilaments {
  const L = info.lines;
  const V = info.vertices;
  const expected = 4 * (L + 1) + 6 * V + 2 * L + 2 * L + V + L;
  if (buffer.byteLength !== expected) {
    throw new Error(`filaments.bin is ${buffer.byteLength} bytes, not the ${expected} cosmic-web.json says.`);
  }
  let at = 0;
  const starts = new Uint32Array(buffer.slice(at, (at += 4 * (L + 1))));
  if (starts[L] !== V) {
    throw new Error(`filaments.bin's lines end at vertex ${starts[L]}, not ${V}.`);
  }
  const positions = new Int16Array(buffer.slice(at, (at += 6 * V)));
  at += 4 * L; // each line's length and galaxy count: not drawn
  const bytes = new Uint8Array(buffer);
  const values = bytes.slice(at, (at += V));
  const catalogues = bytes.slice(at, at + L);
  return { lines: L, vertices: V, starts, positions, values, catalogues };
}

/**
 * A filament vertex's weight, 0 to 1, from its catalogue's value there: how sure the catalogue
 * is of it, and how strongly it is drawn.
 *
 * - Tempel et al.'s visit map, the share of the Bisous model's realisations with a filament
 *   there: FILAMENT_WEIGHT_LEAST at 0.05 (their catalogue's own threshold), whole from
 *   TEMPEL_VMAP_FULL. Its median is 0.26, its tenth percentile 0.08 and ninetieth 0.69.
 * - Malavasi et al.'s log10 of the galaxies' DTFE density on the ridge, in DisPerSE's own
 *   units: least at MALAVASI_LOG_DENSITY[0], whole at [1] -- their tenth and ninetieth
 *   percentiles here are -3.75 and -2.65.
 */
export const FILAMENT_WEIGHT_LEAST = 0.3;
export const TEMPEL_VMAP_FULL = 0.6;
export const MALAVASI_LOG_DENSITY: readonly [number, number] = [-3.9, -2.6];

export function filamentWeight(catalogue: number, value: number): number {
  const [from, to] =
    catalogue === COSMIC_WEB_FILAMENT_CATALOGUES.tempel2014 ? [0.05, TEMPEL_VMAP_FULL] : MALAVASI_LOG_DENSITY;
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return FILAMENT_WEIGHT_LEAST + (1 - FILAMENT_WEIGHT_LEAST) * t * t * (3 - 2 * t);
}

/** How many segments each of a line's is cut into, by catalogue: Malavasi et al.'s are 9 Mpc, splined. */
export const FILAMENT_SPLINE: Readonly<Record<number, number>> = {
  [COSMIC_WEB_FILAMENT_CATALOGUES.tempel2014]: 1,
  [COSMIC_WEB_FILAMENT_CATALOGUES.malavasi2020]: 4,
};

/**
 * The filaments as segments, an instance each (scene/CosmicWeb.tsx): `a` and `b` its ends, x, y,
 * z in 0.1 Mpc and a fourth number -- at `a` the weight there as a byte, at `b` the weight
 * plus 256 times the catalogue. Tempel et al.'s spines are points 0.67 Mpc apart and drawn as
 * they are; Malavasi et al.'s 9 Mpc steps would be drawn as kinks, and are a centripetal
 * Catmull-Rom spline through their points, FILAMENT_SPLINE segments to a step, as the flow lines
 * are (scene/Laniakea.tsx flowGeometry). Their length, pc, by catalogue, and each one's
 * distance from the Sun at its middle, for the crowding (scene/crowding.ts lineKept).
 */
export interface FilamentSegments {
  readonly count: number;
  readonly a: Int16Array;
  readonly b: Int16Array;
  /** The segments' length by catalogue, pc, and how far each half of it lies: the median distance from the Sun of its length. */
  readonly lengthPc: readonly number[];
  readonly halfLengthRadiusPc: readonly number[];
}

export function filamentSegments(filaments: CosmicWebFilaments, info: CosmicWebInfo['filaments']): FilamentSegments {
  const { lines, starts, positions, values, catalogues } = filaments;
  const steps = (catalogue: number) => FILAMENT_SPLINE[catalogue] ?? 1;
  let count = 0;
  for (let l = 0; l < lines; l += 1) {
    const n = starts[l + 1]! - starts[l]!;
    if (n >= 2) count += (n - 1) * steps(catalogues[l]!);
  }
  const a = new Int16Array(count * 4);
  const b = new Int16Array(count * 4);
  const kinds = info.catalogues.length;
  const lengthPc = new Array<number>(kinds).fill(0);
  // Each segment's length and distance, for the half-length radius.
  const segmentLength = new Float32Array(count);
  const segmentDistance = new Float32Array(count);
  const segmentKind = new Uint8Array(count);
  let s = 0;
  const p = [0, 0, 0];
  const q = [0, 0, 0];
  const P: [number[], number[], number[], number[]] = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let l = 0; l < lines; l += 1) {
    const first = starts[l]!;
    const n = starts[l + 1]! - first;
    if (n < 2) continue;
    const catalogue = catalogues[l]!;
    const k = steps(catalogue);
    const value = info.catalogues[catalogue]?.vertexValue ?? { min: 0, step: 1 };
    const weight = (v: number) => Math.round(255 * filamentWeight(catalogue, value.min + values[first + v]! * value.step));
    const point = (i: number, out: number[]) => {
      out[0] = positions[(first + i) * 3]!;
      out[1] = positions[(first + i) * 3 + 1]!;
      out[2] = positions[(first + i) * 3 + 2]!;
    };
    for (let i = 0; i < n - 1; i += 1) {
      const w0 = weight(i);
      const w1 = weight(i + 1);
      // Centripetal Catmull-Rom between vertices i and i + 1, the ends' tangents from their reflections.
      point(Math.max(0, i - 1), P[0]);
      point(i, P[1]);
      point(i + 1, P[2]);
      point(Math.min(n - 1, i + 2), P[3]);
      for (let d = 0; d < 3; d += 1) {
        if (i === 0) P[0][d] = 2 * P[1][d]! - P[2][d]!;
        if (i + 2 > n - 1) P[3][d] = 2 * P[2][d]! - P[1][d]!;
      }
      for (let j = 0; j < k; j += 1) {
        if (k === 1) {
          for (let d = 0; d < 3; d += 1) {
            p[d] = P[1][d]!;
            q[d] = P[2][d]!;
          }
        } else {
          catmullRom(P, j / k, p);
          catmullRom(P, (j + 1) / k, q);
        }
        const wa = Math.round(w0 + ((w1 - w0) * j) / k);
        const wb = Math.round(w0 + ((w1 - w0) * (j + 1)) / k);
        for (let d = 0; d < 3; d += 1) {
          a[s * 4 + d] = Math.round(p[d]!);
          b[s * 4 + d] = Math.round(q[d]!);
        }
        a[s * 4 + 3] = wa;
        b[s * 4 + 3] = wb + 256 * catalogue;
        const dx = q[0]! - p[0]!;
        const dy = q[1]! - p[1]!;
        const dz = q[2]! - p[2]!;
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz) * COSMIC_WEB_POSITION_UNIT_PC;
        const mx = p[0]! + q[0]!;
        const my = p[1]! + q[1]!;
        const mz = p[2]! + q[2]!;
        lengthPc[catalogue] = (lengthPc[catalogue] ?? 0) + length;
        segmentLength[s] = length;
        segmentDistance[s] = Math.sqrt(mx * mx + my * my + mz * mz) * 0.5 * COSMIC_WEB_POSITION_UNIT_PC;
        segmentKind[s] = catalogue;
        s += 1;
      }
    }
  }
  // Each catalogue's length counted in shells of a megaparsec from the Sun: where half of it is.
  const shellPc = 1e6;
  const shells = new Float64Array(kinds * 4096);
  for (let i = 0; i < count; i += 1) {
    shells[segmentKind[i]! * 4096 + Math.min(4095, Math.floor(segmentDistance[i]! / shellPc))]! += segmentLength[i]!;
  }
  const halfLengthRadiusPc = Array.from({ length: kinds }, (_, catalogue) => {
    let sum = 0;
    for (let k = 0; k < 4096; k += 1) {
      sum += shells[catalogue * 4096 + k]!;
      if (sum >= lengthPc[catalogue]! / 2) return (k + 0.5) * shellPc;
    }
    return 0;
  });
  return { count, a, b, lengthPc, halfLengthRadiusPc };
}

/** A centripetal (alpha 0.5) Catmull-Rom segment from P1 to P2 at t (Barry & Goldman's pyramid). */
function catmullRom(P: readonly [number[], number[], number[], number[]], t: number, out: number[]): void {
  const knot = (x: number[], y: number[]) => {
    const dx = y[0]! - x[0]!;
    const dy = y[1]! - x[1]!;
    const dz = y[2]! - x[2]!;
    // The square root of the distance: (dx^2 + dy^2 + dz^2)^(1/4). Math.hypot is slow.
    return Math.max(1e-6, Math.sqrt(Math.sqrt(dx * dx + dy * dy + dz * dz)));
  };
  const t0 = 0;
  const t1 = t0 + knot(P[0], P[1]);
  const t2 = t1 + knot(P[1], P[2]);
  const t3 = t2 + knot(P[2], P[3]);
  const u = t1 + (t2 - t1) * t;
  for (let d = 0; d < 3; d += 1) {
    const p0 = P[0][d]!;
    const p1 = P[1][d]!;
    const p2 = P[2][d]!;
    const p3 = P[3][d]!;
    const a1 = ((t1 - u) * p0 + (u - t0) * p1) / (t1 - t0);
    const a2 = ((t2 - u) * p1 + (u - t1) * p2) / (t2 - t1);
    const a3 = ((t3 - u) * p2 + (u - t2) * p3) / (t3 - t2);
    const b1 = ((t2 - u) * a1 + (u - t0) * a2) / (t2 - t0);
    const b2 = ((t3 - u) * a2 + (u - t1) * a3) / (t3 - t1);
    out[d] = ((t2 - u) * b1 + (u - t1) * b2) / (t2 - t1);
  }
}

// ---------------------------------------------------------------------------------------
// The galaxies

/** A chunk of galaxies-<k>.bin: its columns as typed arrays (COSMIC_WEB_GALAXY_BYTES). */
export interface CosmicWebChunk {
  readonly count: number;
  /** x, y, z a galaxy, scene frame, 0.1 Mpc. */
  readonly positions: Int16Array;
  readonly absV: Uint8Array;
  readonly bv: Uint8Array;
  readonly flags: Uint8Array;
}

export function parseGalaxyChunk(buffer: ArrayBuffer, count: number): CosmicWebChunk {
  if (buffer.byteLength !== count * COSMIC_WEB_GALAXY_BYTES) {
    throw new Error(`A cosmic-web galaxy chunk is ${buffer.byteLength} bytes, not the ${count * COSMIC_WEB_GALAXY_BYTES} cosmic-web.json says.`);
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
export function absVOf(code: number): number {
  return code === COSMIC_WEB_ABS_V.unknown ? Number.NaN : COSMIC_WEB_ABS_V.min + code * COSMIC_WEB_ABS_V.step;
}

/** A B-V byte's colour index (NaN: not known). */
export function bvOf(code: number): number {
  return code === COSMIC_WEB_BV.unknown ? Number.NaN : COSMIC_WEB_BV.min + code * COSMIC_WEB_BV.step;
}

/** Which survey a galaxy's flags say: 0 the SDSS main sample, 1 BOSS. */
export function surveyOf(flags: number): 0 | 1 {
  return flags & COSMIC_WEB_FLAGS.SDSS_MAIN ? 0 : 1;
}

/**
 * The galaxies, a prefix of the chunks: request(n) fetches what of the first n is missing, one
 * after another, the most luminous first, each published as it lands.
 */
export class CosmicWebGalaxies {
  readonly #info: LazySource<CosmicWebInfo>;
  readonly #fetchers: BeltFetchers;
  readonly #basePath: string;
  readonly #listeners = new Set<() => void>();
  #chunks: CosmicWebChunk[] = [];
  #wanted = 0;
  #loading = false;
  #failedAt = 0;

  constructor(info: LazySource<CosmicWebInfo>, fetchers: BeltFetchers, basePath: string) {
    this.#info = info;
    this.#fetchers = fetchers;
    this.#basePath = basePath;
  }

  /** The chunks that have landed, in order. */
  get chunks(): readonly CosmicWebChunk[] {
    return this.#chunks;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  /** Asks for the first `chunks` chunks. */
  request(chunks: number): void {
    this.#wanted = Math.max(this.#wanted, chunks);
    void this.#pump();
  }

  async #pump(): Promise<void> {
    // A failure is tried again after a minute, as a LazySource's is.
    if (this.#loading || Date.now() - this.#failedAt < 60_000) return;
    this.#loading = true;
    try {
      await this.#info.request();
      const info = this.#info.value;
      if (info === null) return;
      const all = info.galaxies.chunks;
      while (this.#chunks.length < Math.min(this.#wanted, all.length)) {
        const chunk = all[this.#chunks.length]!;
        const buffer = await this.#fetchers.binary(`${this.#basePath}data/cosmic-web/${chunk.file}`, { expectedBytes: chunk.bytes });
        if (buffer === null) return;
        this.#chunks = [...this.#chunks, parseGalaxyChunk(buffer, chunk.count)];
        for (const listener of this.#listeners) listener();
        renderDemand.request();
      }
    } catch (error: unknown) {
      this.#failedAt = Date.now();
      console.error('Could not load the cosmic web’s galaxies', error);
    } finally {
      this.#loading = false;
    }
  }
}

/** All of it: the description, the filaments and the galaxies, each fetched when first asked for. */
export interface CosmicWebSource {
  readonly info: LazySource<CosmicWebInfo>;
  readonly filaments: LazySource<CosmicWebFilaments>;
  readonly galaxies: CosmicWebGalaxies;
}

export function cosmicWebSource(fetchers: BeltFetchers, basePath = '/', published = COSMIC_WEB_PUBLISHED): CosmicWebSource {
  const info = new LazySource<CosmicWebInfo>(async () => {
    if (!published) return null;
    const raw = await fetchers.json(`${basePath}data/cosmic-web/cosmic-web.json`);
    return raw === null ? null : parseCosmicWebInfo(raw);
  }, 'the cosmic web');
  const filaments = new LazySource<CosmicWebFilaments>(async () => {
    await info.request();
    const described = info.value;
    if (described === null) return null;
    const buffer = await fetchers.binary(`${basePath}data/cosmic-web/${described.filaments.file}`, {
      expectedBytes: described.filaments.bytes,
    });
    return buffer === null ? null : parseFilaments(buffer, described.filaments);
  }, 'the cosmic web’s filaments');
  return { info, filaments, galaxies: new CosmicWebGalaxies(info, fetchers, basePath) };
}
