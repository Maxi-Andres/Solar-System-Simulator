import type { StarCatalog } from '@sss/tools/types';

import type { Fetcher } from './ephemerisStore.ts';

/**
 * Loads the star catalogue the generator wrote.
 *
 * Generated in the same run as the ephemerides and never committed, for the same
 * reason: it is downloaded from a published catalogue at build time, so committing it
 * would put a megabyte of regenerated JSON into history for nothing.
 *
 * Loaded with the ephemerides rather than lazily behind them. It is 297 KB gzipped
 * against roughly 1.5 MB of vectors, so it is not what the wait is made of, and a sky
 * that pops in a second after the planets reads as a bug.
 */

/** Every column the renderer reads, and they must all be the same length. */
const COLUMNS = ['ra', 'dec', 'mag', 'bv', 'pmRa', 'pmDec'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function numberArray(value: unknown, name: string): number[] {
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

export async function loadStarCatalog(
  fetcher: Fetcher,
  basePath = '/',
): Promise<StarCatalog> {
  return parseStarCatalog(await fetcher(`${basePath}data/stars.json`));
}

/** The brightest magnitude in the catalogue: one end of the renderer's response. */
export function brightestMagnitude(catalog: StarCatalog): number {
  let brightest = Infinity;
  for (const magnitude of catalog.mag) {
    if (magnitude < brightest) {
      brightest = magnitude;
    }
  }
  return brightest;
}
