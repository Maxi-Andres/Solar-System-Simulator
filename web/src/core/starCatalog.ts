import type { StarCatalog } from '@sss/tools/types';

import type { Fetcher } from './ephemerisStore.ts';

/**
 * Loads the star catalogue the generator wrote.
 *
 * Generated in the same run as the ephemerides and never committed, for the same
 * reason: it is downloaded from a published catalogue at build time, so committing it
 * would put a megabyte of regenerated JSON into history for nothing.
 *
 * Loaded with the ephemerides rather than lazily behind them: a sky that pops in a second
 * after the planets reads as a bug. But parsed off the main thread (starCatalog.worker.ts):
 * 46,000 stars are 1.5 MB of JSON, 45 ms of JSON.parse on 2026-11-21 that the first frame
 * waited behind. The worker hands the columns back as Float64Arrays, transferred rather
 * than copied -- plain arrays cost as much to copy across as to parse.
 */

/** Every column the renderer reads, and they must all be the same length. */
const COLUMNS = ['ra', 'dec', 'mag', 'bv', 'pmRa', 'pmDec'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function numberArray(value: unknown, name: string): ArrayLike<number> {
  if (value instanceof Float64Array) {
    return value;
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'number')) {
    throw new Error(`stars.json: column "${name}" is not an array of numbers.`);
  }
  return value as number[];
}

/**
 * Checks the file is the shape the renderer expects.
 *
 * Loud rather than forgiving. A column one entry short would otherwise shift every
 * star after it onto another star's colour, which looks like a sky and is not one.
 */
export function parseStarCatalog(raw: unknown): StarCatalog {
  if (!isRecord(raw)) {
    throw new Error('stars.json did not contain an object.');
  }

  const count = raw['count'];
  if (typeof count !== 'number' || !Number.isInteger(count) || count <= 0) {
    throw new Error('stars.json has no usable star count.');
  }

  for (const column of COLUMNS) {
    const values = numberArray(raw[column], column);
    if (values.length !== count) {
      throw new Error(
        `stars.json: column "${column}" has ${values.length} entries but count says ${count}.`,
      );
    }
  }

  const magnitudeLimit = raw['magnitudeLimit'];
  if (typeof magnitudeLimit !== 'number') {
    throw new Error('stars.json does not say what magnitude it is complete to.');
  }

  return raw as unknown as StarCatalog;
}

/** The catalogue with its columns as Float64Arrays: what the worker hands back. */
export function withTypedColumns(catalog: StarCatalog): StarCatalog {
  const typed = { ...catalog } as Record<string, unknown>;
  for (const column of COLUMNS) {
    const values = catalog[column];
    // From an array of numbers V8 copies straight across; Float64Array.from would iterate.
    typed[column] = values instanceof Float64Array ? values : new Float64Array(values as number[]);
  }
  return typed as unknown as StarCatalog;
}

/** The buffers of a catalogue's typed columns, to transfer rather than copy. */
export function columnBuffers(catalog: StarCatalog): ArrayBuffer[] {
  return COLUMNS.map((column) => (catalog[column] as Float64Array).buffer as ArrayBuffer);
}

/** What the worker sends back: the catalogue, or why it could not. */
export type StarCatalogReply = { readonly catalog: StarCatalog } | { readonly error: string };

/** The catalogue fetched and parsed by starCatalog.worker.ts; rejects with its reason. */
function loadInWorker(url: string): Promise<StarCatalog> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./starCatalog.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<StarCatalogReply>) => {
      worker.terminate();
      if ('catalog' in event.data) {
        resolve(event.data.catalog);
      } else {
        reject(new Error(event.data.error));
      }
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || 'The star catalogue worker failed.'));
    };
    worker.postMessage(url);
  });
}

/**
 * The star catalogue, parsed in a worker where there are workers. Where there are none (the
 * tests), or the worker itself cannot run, on this thread through `fetcher` as before. A
 * file that is not a catalogue fails either way, with parseStarCatalog's reason.
 */
export async function loadStarCatalog(
  fetcher: Fetcher,
  basePath = '/',
): Promise<StarCatalog> {
  const path = `${basePath}data/stars.json`;
  if (typeof Worker !== 'undefined' && typeof location !== 'undefined') {
    try {
      return await loadInWorker(new URL(path, location.href).href);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('stars.json')) {
        throw error;
      }
      console.warn('Reading the star catalogue on the main thread:', error);
    }
  }
  return parseStarCatalog(await fetcher(path));
}

/** The brightest magnitude in the catalogue: one end of the renderer's response. */
export function brightestMagnitude(catalog: StarCatalog): number {
  let brightest = Infinity;
  const magnitudes = catalog.mag;
  for (let index = 0; index < magnitudes.length; index += 1) {
    if (magnitudes[index]! < brightest) {
      brightest = magnitudes[index]!;
    }
  }
  return brightest;
}
