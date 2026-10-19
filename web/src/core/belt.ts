import type { BeltClass, BeltInfo, BeltTier } from '@sss/tools/types';

import { RETRY_AFTER_MS } from './chunkedTable.ts';
import { renderDemand } from './renderDemand.ts';

/**
 * The asteroid belt: loading it, checking it, and holding it while it is wanted.
 *
 * Unlike everything else in the data directory, the belt is orbital elements rather than
 * positions: nine float32s per asteroid (see BELT_RECORD_FLOATS in tools/src/types.ts),
 * and the GPU works out where each one is, every frame, by solving Kepler's equation in
 * the vertex shader (see scene/beltShader.ts). That is the only way a million and a half
 * of them move at sixty frames a second with the CPU doing nothing per asteroid. Vectors
 * would be gigabytes; elements are 57 MB, and the brightest 84,000 are 3.
 *
 * **In tiers, brightest first** (step B2b). The catalogue is split by absolute magnitude
 * into files of one layout, and the app holds a prefix of them: the first alone unless
 * the viewer asks for more in the Layers panel, then each next one in order, each drawn
 * the moment it lands. So the largest asteroids never wait on the smallest, and a viewer
 * who never asks for the whole catalogue never downloads it. Data from before the tiers
 * is one tier, its `file` and `count` -- see beltTiers.
 *
 * **Lazy, and optional.** Nothing here is fetched at startup: the belt is asked for once
 * the ephemerides are in and only while the Asteroids layer is on, so the first view is
 * not waiting on megabytes it may never show. And data generated before the belt simply
 * has no belt -- said once on the console, never an error screen: everything else in
 * such a data directory is still good.
 */

/**
 * Floats per asteroid: BELT_RECORD_FLOATS, restated. The web app does not import the
 * generator's values, only its types; a test holds the two equal.
 */
export const RECORD_FLOATS = 9;

/** Bytes per asteroid: RECORD_FLOATS float32s. */
export const RECORD_BYTES = RECORD_FLOATS * Float32Array.BYTES_PER_ELEMENT;

/** Where each element sits in a record. The order is the file's; see BELT_RECORD_FLOATS. */
export const RECORD = {
  a: 0,
  e: 1,
  i: 2,
  node: 3,
  peri: 4,
  M: 5,
  n: 6,
  H: 7,
  class: 8,
} as const;

/** One tier, fetched: its elements, and what is in it. */
export interface LoadedTier {
  /** Its place in the catalogue's tiers; they are only ever held as a prefix, 0 up. */
  readonly index: number;
  readonly tier: BeltTier;
  /** RECORD_FLOATS per asteroid, in the file's order, brightest first. */
  readonly records: Float32Array;
  /** How many of each class, counted from the records themselves: see countClasses. */
  readonly classCounts: Readonly<Partial<Record<BeltClass, number>>>;
}

/** Where loading stands, for the belt as a whole. */
export type BeltState = 'idle' | 'loading' | 'ready' | 'absent' | 'failed';

/**
 * What the scene and the About text draw from. Replaced, never changed in place, so it
 * can be handed to React as a snapshot.
 */
export interface BeltView {
  readonly state: BeltState;
  readonly info: BeltInfo | null;
  /** The tiers in hand: a prefix of the catalogue's, brightest first. */
  readonly tiers: readonly LoadedTier[];
}

/**
 * How far the asked-for tiers have come, for the Layers panel's progress line. Replaced
 * rather than changed too, and more often than the view: every quarter megabyte of a
 * tier on its way.
 */
export interface BeltProgress {
  /** Tiers asked for, clamped to the catalogue's once belt.json is in. */
  readonly wanted: number;
  readonly loaded: number;
  /** Bytes of the tiers asked for; zero until belt.json says. */
  readonly bytesWanted: number;
  /** Bytes in hand: the loaded tiers whole, and as much of the next as has arrived. */
  readonly bytesLoaded: number;
  readonly failed: boolean;
}

/** What a binary fetch may be told: when to stop, how big to expect, and to report. */
export interface BinaryFetchOptions {
  readonly signal?: AbortSignal;
  /** The file's size from belt.json, so the download can go straight into one buffer. */
  readonly expectedBytes?: number;
  /** Called with the bytes received so far, as they arrive. */
  readonly onProgress?: (receivedBytes: number) => void;
}

/**
 * Fetches for the belt, injected so the loader is testable without a browser.
 *
 * Each resolves to null when the file is not there -- which for `belt.json` means there
 * is no belt, and is not an error -- and rejects for anything else.
 */
export interface BeltFetchers {
  readonly json: (path: string) => Promise<unknown>;
  readonly binary: (path: string, options?: BinaryFetchOptions) => Promise<ArrayBuffer | null>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** A bare file name: the binaries live beside belt.json, and nothing else may be reached. */
function isBareFileName(file: unknown): file is string {
  return typeof file === 'string' && /^[\w.-]+$/.test(file) && !file.startsWith('.');
}

/**
 * Checks `belt.json` is the shape the renderer expects.
 *
 * Loud rather than forgiving, as the star catalogue is. A record length the renderer
 * does not expect would read every asteroid's eccentricity out of its neighbour's
 * inclination, and draw something that looks like a belt and is not one.
 */
export function parseBeltInfo(raw: unknown): BeltInfo {
  if (!isRecord(raw)) {
    throw new Error('belt.json did not contain an object.');
  }
  if (raw['recordFloats'] !== RECORD_FLOATS) {
    throw new Error(
      `belt.json has ${String(raw['recordFloats'])} floats per asteroid; this app reads ${RECORD_FLOATS}. Regenerate the data, or update the app.`,
    );
  }
  const count = raw['count'];
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    throw new Error('belt.json has no usable asteroid count.');
  }
  if (!isBareFileName(raw['file'])) {
    throw new Error('belt.json does not name its elements file.');
  }
  const referenceJd = raw['referenceJd'];
  if (typeof referenceJd !== 'number' || !Number.isFinite(referenceJd)) {
    throw new Error('belt.json does not say when its mean anomalies are given.');
  }
  if (typeof raw['magnitudeLimit'] !== 'number') {
    throw new Error('belt.json does not say what magnitude it is complete to.');
  }
  if (raw['tiers'] !== undefined) {
    checkTiers(raw['tiers'], count);
  }
  return raw as unknown as BeltInfo;
}

/**
 * The tiers must add up to the belt, and each must state its own size truthfully: a
 * tier's `bytes` is what the progress line counts and what its download is read into.
 */
function checkTiers(tiers: unknown, count: number): void {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    throw new Error('belt.json has a tier list with no tiers in it.');
  }
  let total = 0;
  for (const [index, tier] of tiers.entries()) {
    if (!isRecord(tier) || !isBareFileName(tier['file'])) {
      throw new Error(`belt.json: tier ${index} does not name its elements file.`);
    }
    const tierCount = tier['count'];
    if (typeof tierCount !== 'number' || !Number.isInteger(tierCount) || tierCount < 0) {
      throw new Error(`belt.json: tier ${index} has no usable asteroid count.`);
    }
    if (tier['bytes'] !== tierCount * RECORD_BYTES) {
      throw new Error(
        `belt.json: tier ${index} says ${String(tier['bytes'])} bytes; ${tierCount} asteroids at ${RECORD_BYTES} each is ${tierCount * RECORD_BYTES}.`,
      );
    }
    for (const bound of ['brightestH', 'faintestH']) {
      if (tier[bound] !== null && typeof tier[bound] !== 'number') {
        throw new Error(`belt.json: tier ${index} has no usable ${bound}.`);
      }
    }
    total += tierCount;
  }
  if (total !== count) {
    throw new Error(`belt.json: its tiers hold ${total} asteroids, and it says ${count}.`);
  }
}

/**
 * The belt's tiers, brightest first. Data from before the tiers -- B2a's -- is one: its
 * `file`, everything brighter than its `magnitudeLimit`.
 */
export function beltTiers(info: BeltInfo): readonly BeltTier[] {
  return (
    info.tiers ?? [
      {
        file: info.file,
        count: info.count,
        bytes: info.count * RECORD_BYTES,
        brightestH: null,
        faintestH: info.magnitudeLimit,
      },
    ]
  );
}

/** One choice of how much of the catalogue to load: its first `tiers` tiers. */
export interface BeltDensity {
  readonly tiers: number;
  readonly count: number;
  readonly bytes: number;
  /** Everything brighter than this is in it; null when the last, open tier is. */
  readonly faintestH: number | null;
}

/**
 * Every prefix of the tiers: the choices the Layers panel offers, worked out from
 * belt.json's own counts and sizes, so a regenerated catalogue relabels itself.
 */
export function beltDensities(info: BeltInfo): readonly BeltDensity[] {
  let count = 0;
  let bytes = 0;
  return beltTiers(info).map((tier, index) => {
    count += tier.count;
    bytes += tier.bytes;
    return { tiers: index + 1, count, bytes, faintestH: tier.faintestH };
  });
}

/** True on every machine a browser runs on today; checked rather than assumed. */
const HOST_IS_LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

/**
 * An elements file as float32s: `count` records, little-endian.
 *
 * On a little-endian host -- every one in practice -- the bytes are already float32s in
 * the right order, and the array is a view on the downloaded buffer with no copy. The
 * other path reads each float through a DataView; it exists so the file's byte order
 * is a property of the format and not an accident of the machine that wrote it.
 *
 * The length is checked to the byte: a truncated download would otherwise draw every
 * asteroid after the cut from garbage.
 */
export function decodeBeltRecords(
  buffer: ArrayBuffer,
  count: number,
  littleEndianHost = HOST_IS_LITTLE_ENDIAN,
): Float32Array {
  if (buffer.byteLength !== count * RECORD_BYTES) {
    throw new Error(
      `The belt's elements file is ${buffer.byteLength} bytes; ${count} asteroids at ${RECORD_BYTES} each is ${count * RECORD_BYTES}.`,
    );
  }
  if (littleEndianHost) {
    return new Float32Array(buffer);
  }
  const view = new DataView(buffer);
  const records = new Float32Array(count * RECORD_FLOATS);
  for (let k = 0; k < records.length; k += 1) {
    records[k] = view.getFloat32(k * 4, true);
  }
  return records;
}

/**
 * Checks every record is an ellipse the shader can solve.
 *
 * One pass over a tier's floats as it lands -- 5.7 million for the faintest, ten
 * milliseconds or so. What it catches is what would otherwise be silent: a NaN draws
 * nothing, and an eccentricity of 1 or more puts a parabola through an equation that only
 * has an answer for ellipses.
 */
export function checkBeltRecords(records: Float32Array): void {
  for (let k = 0; k < records.length; k += 1) {
    if (!Number.isFinite(records[k]!)) {
      throw new Error(`Belt asteroid ${Math.floor(k / RECORD_FLOATS)} has a non-finite element.`);
    }
  }
  for (let base = 0; base < records.length; base += RECORD_FLOATS) {
    const a = records[base + RECORD.a]!;
    const e = records[base + RECORD.e]!;
    if (!(a > 0) || !(e >= 0 && e < 1)) {
      throw new Error(
        `Belt asteroid ${base / RECORD_FLOATS} is not on an ellipse: a = ${a} km, e = ${e}.`,
      );
    }
  }
}

/**
 * How many of each class a tier holds, from its records' class codes.
 *
 * Counted here rather than read from belt.json, whose `classCounts` are the whole
 * catalogue's: the About text describes what is loaded, and with the first tier alone
 * that is 84,000 asteroids, not 1.6 million.
 */
export function countClasses(
  records: Float32Array,
  classes: readonly BeltClass[],
): Partial<Record<BeltClass, number>> {
  const counts = new Array<number>(classes.length).fill(0);
  for (let base = RECORD.class; base < records.length; base += RECORD_FLOATS) {
    const code = records[base]!;
    if (code >= 0 && code < counts.length) {
      counts[code] = counts[code]! + 1;
    }
  }
  const named: Partial<Record<BeltClass, number>> = {};
  classes.forEach((name, code) => {
    const count = counts[code]!;
    if (count > 0) {
      named[name] = count;
    }
  });
  return named;
}

/**
 * Reads belt.json, or resolves to null when the data has no belt.
 *
 * `basePath` must end in a slash; in the app it is `import.meta.env.BASE_URL`, as for
 * everything else.
 */
export async function loadBeltInfo(fetchers: BeltFetchers, basePath = '/'): Promise<BeltInfo | null> {
  const raw = await fetchers.json(`${basePath}data/belt/belt.json`);
  if (raw === null) {
    console.info('The published data has no asteroid belt. Regenerate it to draw one.');
    return null;
  }
  return parseBeltInfo(raw);
}

/**
 * Reads one tier's elements, checked. Rejects when the file is missing: belt.json says it
 * is there, so that is a broken publish rather than an old one.
 */
export async function loadBeltTier(
  fetchers: BeltFetchers,
  tier: BeltTier,
  basePath = '/',
  options: Omit<BinaryFetchOptions, 'expectedBytes'> = {},
): Promise<Float32Array> {
  const buffer = await fetchers.binary(`${basePath}data/belt/${tier.file}`, {
    ...options,
    expectedBytes: tier.bytes,
  });
  if (buffer === null) {
    throw new Error(`belt.json names ${tier.file}, which is not there.`);
  }
  const records = decodeBeltRecords(buffer, tier.count);
  checkBeltRecords(records);
  return records;
}

/**
 * True for a response that means "no such file".
 *
 * A 404 on the published site. The dev server and `vite preview` answer a missing file
 * differently: as a single-page app, with index.html and a 200 -- for any request whose
 * Accept header admits HTML, which a bare `fetch` does with its `*\/*`. The fetches below
 * ask for exactly their own type so the server says 404 instead; an HTML answer is still
 * read as missing, in case something between here and the file falls back anyway.
 */
function isMissing(response: Response): boolean {
  return (
    response.status === 404 || (response.headers.get('content-type') ?? '').includes('text/html')
  );
}

async function httpGet(path: string, accept: string, signal?: AbortSignal): Promise<Response | null> {
  const response = await fetch(path, { headers: { Accept: accept }, signal: signal ?? null });
  if (isMissing(response)) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: HTTP ${response.status}`);
  }
  return response;
}

/**
 * A response body read into one buffer of the size belt.json gave it, reporting as it
 * goes. One buffer, not a list of chunks joined at the end: the faintest tier is 23 MB,
 * and joining would hold it twice at the moment it is largest.
 */
async function readInto(
  response: Response,
  path: string,
  expectedBytes: number,
  onProgress: ((receivedBytes: number) => void) | undefined,
): Promise<ArrayBuffer> {
  const reader = response.body?.getReader();
  if (reader === undefined) {
    return response.arrayBuffer();
  }
  const bytes = new Uint8Array(expectedBytes);
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (received + value.byteLength > expectedBytes) {
      await reader.cancel();
      throw new Error(`${path} is longer than the ${expectedBytes} bytes belt.json gives it.`);
    }
    bytes.set(value, received);
    received += value.byteLength;
    onProgress?.(received);
  }
  // Short, it fails decodeBeltRecords's length check, which says by how much.
  return received === expectedBytes ? bytes.buffer : bytes.buffer.slice(0, received);
}

/**
 * The browser's fetches. They do not ask for frames themselves, as the other fetchers in
 * the app do: BeltSource asks, once per change to what is drawn, and not once per file --
 * a tier's progress changes nothing on the canvas.
 */
export const httpBeltFetchers: BeltFetchers = {
  json: async (path) => {
    const response = await httpGet(path, 'application/json');
    return response === null ? null : ((await response.json()) as unknown);
  },
  binary: async (path, options = {}) => {
    const response = await httpGet(path, 'application/octet-stream', options.signal);
    if (response === null) {
      return null;
    }
    return options.expectedBytes === undefined
      ? response.arrayBuffer()
      : readInto(response, path, options.expectedBytes, options.onProgress);
  },
};

/** How much of a tier must arrive before the progress line moves again, bytes. */
export const PROGRESS_STEP_BYTES = 256 * 1024;

/**
 * The belt, held as a prefix of its tiers.
 *
 * `request(n)` asks for the first n tiers: what is missing is fetched one tier at a time,
 * brightest first, and each is published to the scene as it lands; what is beyond n is
 * let go at once -- the records dropped, so the scene's GPU copies go with them (see
 * AsteroidBelt), and a tier still on its way aborted. Lowering the density is a request
 * for fewer, and gives the memory back there and then: 54 MB is not worth keeping for a
 * choice the viewer has just undone.
 *
 * `release(n)` lets go of what is beyond n without fetching anything. App calls it half a
 * minute after the Asteroids layer goes off, down to the first tier, which is kept: 3 MB
 * is what B2a held, and bringing the layer back then costs an upload and not a download.
 *
 * A failure is logged and may be tried again after RETRY_AFTER_MS, as a moon's chunk or a
 * craft's path may -- or at once, from the Layers panel. Data with no belt is asked for
 * once and never again.
 */
export class BeltSource {
  readonly #fetchers: BeltFetchers;
  readonly #basePath: string;
  readonly #settled: () => void;

  #info: BeltInfo | null = null;
  #absent = false;
  #infoPending = false;
  #tiers: readonly LoadedTier[] = [];
  #wanted = 0;
  #inFlight: { readonly index: number; readonly abort: AbortController } | null = null;
  #received = 0;
  #reported = 0;
  #failedAt: number | null = null;

  #view: BeltView = { state: 'idle', info: null, tiers: [] };
  #progress: BeltProgress = { wanted: 0, loaded: 0, bytesWanted: 0, bytesLoaded: 0, failed: false };
  readonly #listeners = new Set<() => void>();
  #idleWaiters: (() => void)[] = [];

  /**
   * `settled` runs whenever what the scene draws changes -- a tier arriving or let go, the
   * belt turning out to be absent, a failure: by default a frame is asked for.
   */
  constructor(
    fetchers: BeltFetchers,
    basePath = '/',
    settled: () => void = () => renderDemand.request(),
  ) {
    this.#fetchers = fetchers;
    this.#basePath = basePath;
    this.#settled = settled;
  }

  get view(): BeltView {
    return this.#view;
  }

  get progress(): BeltProgress {
    return this.#progress;
  }

  /** Calls `listener` when the view or the progress changes; returns the unsubscribe. */
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  /**
   * Asks for the first `tiers` tiers, letting go of any beyond them. Resolves when there
   * is nothing more to do: everything asked for is here, or the belt is absent, or a
   * fetch failed.
   */
  request(tiers: number): Promise<void> {
    this.#wanted = Math.max(0, Math.floor(tiers));
    this.#trim();
    return this.#pump();
  }

  /** Lets go of every tier past the first `tiers`, and fetches nothing. */
  release(tiers: number): void {
    this.#wanted = Math.min(this.#wanted, Math.max(0, Math.floor(tiers)));
    this.#trim();
    this.#publish();
  }

  /** Tries again now after a failure, rather than after RETRY_AFTER_MS. */
  retry(): Promise<void> {
    this.#failedAt = null;
    return this.#pump();
  }

  /** The tiers asked for, as far as the catalogue has them. */
  #target(): number {
    return this.#info === null ? this.#wanted : Math.min(this.#wanted, beltTiers(this.#info).length);
  }

  /** Drops what is past the target, and stops a download that is. */
  #trim(): void {
    const target = this.#target();
    if (this.#inFlight !== null && this.#inFlight.index >= target) {
      this.#inFlight.abort.abort();
    }
    if (this.#tiers.length > target) {
      this.#tiers = this.#tiers.slice(0, target);
      this.#publish();
      this.#settled();
    }
  }

  #pump(): Promise<void> {
    const idle = new Promise<void>((resolve) => {
      this.#idleWaiters.push(resolve);
    });
    this.#step();
    return idle;
  }

  /** Starts whatever comes next, if anything does; otherwise tells the waiters. */
  #step(): void {
    const coolingDown = this.#failedAt !== null && Date.now() - this.#failedAt < RETRY_AFTER_MS;
    if (this.#infoPending || this.#inFlight !== null) {
      return;
    }
    if (this.#absent || coolingDown || this.#wanted === 0) {
      this.#idle();
      return;
    }
    if (this.#info === null) {
      this.#fetchInfo();
      return;
    }
    const index = this.#tiers.length;
    if (index >= this.#target()) {
      this.#idle();
      return;
    }
    this.#fetchTier(this.#info, index);
  }

  #idle(): void {
    this.#publish();
    const waiters = this.#idleWaiters;
    this.#idleWaiters = [];
    for (const resolve of waiters) {
      resolve();
    }
  }

  #fetchInfo(): void {
    this.#infoPending = true;
    this.#publish();
    loadBeltInfo(this.#fetchers, this.#basePath)
      .then((info) => {
        this.#infoPending = false;
        if (info === null) {
          this.#absent = true;
          this.#settled();
        } else {
          this.#info = info;
          this.#failedAt = null;
        }
        this.#step();
      })
      .catch((error: unknown) => {
        this.#infoPending = false;
        this.#fail(error);
      });
  }

  #fetchTier(info: BeltInfo, index: number): void {
    const tier = beltTiers(info)[index]!;
    const abort = new AbortController();
    this.#inFlight = { index, abort };
    this.#received = 0;
    this.#reported = 0;
    this.#publish();
    loadBeltTier(this.#fetchers, tier, this.#basePath, {
      signal: abort.signal,
      onProgress: (received) => {
        this.#received = received;
        if (received - this.#reported >= PROGRESS_STEP_BYTES) {
          this.#reported = received;
          this.#publish();
        }
      },
    })
      .then((records) => {
        this.#inFlight = null;
        this.#received = 0;
        // Still wanted, and still next: a request for fewer may have come while it was
        // on its way, and a fetcher that ignores the abort still lands here.
        if (index === this.#tiers.length && index < this.#target()) {
          this.#tiers = [
            ...this.#tiers,
            { index, tier, records, classCounts: countClasses(records, info.classes) },
          ];
          this.#failedAt = null;
          this.#settled();
        }
        this.#step();
      })
      .catch((error: unknown) => {
        this.#inFlight = null;
        this.#received = 0;
        if (abort.signal.aborted) {
          this.#step();
        } else {
          this.#fail(error);
        }
      });
  }

  #fail(error: unknown): void {
    this.#failedAt = Date.now();
    console.error('Could not load the asteroid belt', error);
    this.#settled();
    this.#idle();
  }

  #state(): BeltState {
    if (this.#absent) {
      return 'absent';
    }
    if (this.#infoPending || this.#inFlight !== null) {
      return 'loading';
    }
    if (this.#failedAt !== null) {
      return 'failed';
    }
    return this.#info !== null && this.#tiers.length > 0 ? 'ready' : 'idle';
  }

  /** Replaces the view and the progress where they changed, and tells the listeners. */
  #publish(): void {
    const state = this.#state();
    const view = this.#view;
    let changed = false;
    if (view.state !== state || view.info !== this.#info || view.tiers !== this.#tiers) {
      this.#view = { state, info: this.#info, tiers: this.#tiers };
      changed = true;
    }

    const target = this.#target();
    const tiers = this.#info === null ? [] : beltTiers(this.#info);
    let bytesWanted = 0;
    for (let k = 0; k < Math.min(target, tiers.length); k += 1) {
      bytesWanted += tiers[k]!.bytes;
    }
    let bytesLoaded = this.#received;
    for (const loaded of this.#tiers) {
      bytesLoaded += loaded.tier.bytes;
    }
    const progress = this.#progress;
    const failed = state === 'failed';
    if (
      progress.wanted !== target ||
      progress.loaded !== this.#tiers.length ||
      progress.bytesWanted !== bytesWanted ||
      progress.bytesLoaded !== bytesLoaded ||
      progress.failed !== failed
    ) {
      this.#progress = { wanted: target, loaded: this.#tiers.length, bytesWanted, bytesLoaded, failed };
      changed = true;
    }

    if (changed) {
      for (const listener of this.#listeners) {
        listener();
      }
    }
  }
}
