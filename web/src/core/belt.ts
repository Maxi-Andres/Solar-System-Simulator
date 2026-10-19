import type { BeltInfo } from '@sss/tools/types';

import { RETRY_AFTER_MS } from './chunkedTable.ts';
import { renderDemand } from './renderDemand.ts';

/**
 * The asteroid belt: loading it, checking it, and holding it while it is wanted.
 *
 * Unlike everything else in the data directory, the belt is orbital elements rather than
 * positions: nine float32s per asteroid (see BELT_RECORD_FLOATS in tools/src/types.ts),
 * and the GPU works out where each one is, every frame, by solving Kepler's equation in
 * the vertex shader (see scene/beltShader.ts). That is the only way 84,000 of them -- and
 * the hundreds of thousands of B2b -- move at sixty frames a second with the CPU doing
 * nothing per asteroid. Vectors would be gigabytes; elements are 3 MB.
 *
 * **Lazy, and optional.** Nothing here is fetched at startup: the belt is asked for once
 * the ephemerides are in and only while the Asteroids layer is on, so the first view is
 * not waiting on 3 MB it may never show. And data generated before the belt simply has
 * no belt -- said once on the console, never an error screen: everything else in such a
 * data directory is still good.
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

/** The belt, ready to draw: its description and every asteroid's elements. */
export interface Belt {
  readonly info: BeltInfo;
  /** RECORD_FLOATS per asteroid, in the file's order, brightest first. */
  readonly records: Float32Array;
}

/**
 * Fetches for the belt, injected so the loader is testable without a browser.
 *
 * Each resolves to null when the file is not there -- which for `belt.json` means there
 * is no belt, and is not an error -- and rejects for anything else.
 */
export interface BeltFetchers {
  readonly json: (path: string) => Promise<unknown>;
  readonly binary: (path: string) => Promise<ArrayBuffer | null>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
  const file = raw['file'];
  // A bare file name: the binary lives beside belt.json, and nothing else may be reached.
  if (typeof file !== 'string' || !/^[\w.-]+$/.test(file) || file.startsWith('.')) {
    throw new Error('belt.json does not name its elements file.');
  }
  const referenceJd = raw['referenceJd'];
  if (typeof referenceJd !== 'number' || !Number.isFinite(referenceJd)) {
    throw new Error('belt.json does not say when its mean anomalies are given.');
  }
  if (typeof raw['magnitudeLimit'] !== 'number') {
    throw new Error('belt.json does not say what magnitude it is complete to.');
  }
  return raw as unknown as BeltInfo;
}

/** True on every machine a browser runs on today; checked rather than assumed. */
const HOST_IS_LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

/**
 * The elements file as float32s: `count` records, little-endian.
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
 * One pass over 750,000 floats, a millisecond or two, once. What it catches is what
 * would otherwise be silent: a NaN draws nothing, and an eccentricity of 1 or more puts
 * a parabola through an equation that only has an answer for ellipses.
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
 * Reads the belt, or resolves to null when the data has none.
 *
 * `basePath` must end in a slash; in the app it is `import.meta.env.BASE_URL`, as for
 * everything else. Rejects when `belt.json` is there but the belt it describes is not
 * usable: that is a broken publish rather than an old one.
 */
export async function loadBelt(fetchers: BeltFetchers, basePath = '/'): Promise<Belt | null> {
  const raw = await fetchers.json(`${basePath}data/belt/belt.json`);
  if (raw === null) {
    console.info('The published data has no asteroid belt. Regenerate it to draw one.');
    return null;
  }
  const info = parseBeltInfo(raw);
  const buffer = await fetchers.binary(`${basePath}data/belt/${info.file}`);
  if (buffer === null) {
    throw new Error(`belt.json names ${info.file}, which is not there.`);
  }
  const records = decodeBeltRecords(buffer, info.count);
  checkBeltRecords(records);
  return { info, records };
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

async function httpGet(path: string, accept: string): Promise<Response | null> {
  const response = await fetch(path, { headers: { Accept: accept } });
  if (isMissing(response)) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: HTTP ${response.status}`);
  }
  return response;
}

/**
 * The browser's fetches, each asking for a frame when it settles.
 *
 * As `renderingFetcher` does in useSimulation.ts, and for the same reason: the canvas
 * renders on demand, and a belt that arrived with the clock paused would otherwise sit
 * unused until the next drag.
 */
export const httpBeltFetchers: BeltFetchers = {
  json: (path) =>
    httpGet(path, 'application/json')
      .then((response) => (response === null ? null : (response.json() as Promise<unknown>)))
      .finally(() => renderDemand.request()),
  binary: (path) =>
    httpGet(path, 'application/octet-stream')
      .then((response) => (response === null ? null : response.arrayBuffer()))
      .finally(() => renderDemand.request()),
};

/**
 * The belt, asked for once and kept.
 *
 * Asked for when the Asteroids layer is on after the ephemerides have loaded -- App
 * calls `request` -- and never before: switched off from the start, it costs nothing.
 * Once here it is kept, 3 MB, for as long as the page is open; the GPU's copy is what is
 * let go when the layer goes off (see AsteroidBelt), and putting it back is then an
 * upload rather than a download.
 *
 * A failure is logged and may be asked for again after RETRY_AFTER_MS, as a moon's
 * chunk or a craft's path may. Data with no belt is asked for once and never again.
 */
export class BeltSource {
  readonly #load: () => Promise<Belt | null>;
  readonly #settled: () => void;
  #belt: Belt | null = null;
  #state: 'idle' | 'loading' | 'ready' | 'absent' | 'failed' = 'idle';
  #failedAt = 0;
  readonly #listeners = new Set<() => void>();

  /**
   * `settled` runs once the belt has arrived, or turned out not to be there, or failed:
   * by default a frame is asked for, since the scene shows any of the three.
   */
  constructor(load: () => Promise<Belt | null>, settled: () => void = () => renderDemand.request()) {
    this.#load = load;
    this.#settled = settled;
  }

  /** The belt, or null until it has arrived -- and for good when the data has none. */
  get belt(): Belt | null {
    return this.#belt;
  }

  /** Where loading stands; for tests, and for anyone wondering why there is no belt. */
  get state(): 'idle' | 'loading' | 'ready' | 'absent' | 'failed' {
    return this.#state;
  }

  /** Calls `listener` when the belt arrives; returns the unsubscribe. */
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  /** Starts loading, once; resolves when it has arrived, is known absent, or failed. */
  request(): Promise<void> {
    if (this.#state === 'loading' || this.#state === 'ready' || this.#state === 'absent') {
      return Promise.resolve();
    }
    if (this.#state === 'failed' && Date.now() - this.#failedAt < RETRY_AFTER_MS) {
      return Promise.resolve();
    }
    this.#state = 'loading';
    return this.#load()
      .then((belt) => {
        this.#belt = belt;
        this.#state = belt === null ? 'absent' : 'ready';
        for (const listener of this.#listeners) {
          listener();
        }
      })
      .catch((error: unknown) => {
        this.#state = 'failed';
        this.#failedAt = Date.now();
        console.error('Could not load the asteroid belt', error);
      })
      .finally(() => {
        this.#settled();
      });
  }
}
