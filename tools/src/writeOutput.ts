import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  OUTPUT_DIR,
  POSITION_DECIMALS,
  TIME_DECIMALS,
  VELOCITY_DECIMALS,
} from './config.ts';
import type {
  BodyDefinition,
  ChunkInfo,
  Manifest,
  OsculatingElements,
  StarCatalog,
  VectorTable,
} from './types.ts';

/**
 * Rounds to a fixed number of decimals.
 *
 * Horizons returns 16 significant digits, far past the precision that matters at
 * kilometre scale. Trimming to millimetres cuts the JSON size by roughly a third
 * with no visible effect.
 */
function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function roundAll(values: readonly number[], decimals: number): number[] {
  return values.map((value) => round(value, decimals));
}

/** Pretty JSON for small files a human might open. */
async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/** Compact JSON for the vector tables, which are thousands of numbers each. */
async function writeCompactJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value)}\n`, 'utf8');
}

/**
 * Clears and recreates the output tree.
 *
 * A full wipe means a body removed from the catalog cannot leave a stale file behind
 * that the manifest no longer lists.
 */
export async function prepareOutputDir(): Promise<void> {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(join(OUTPUT_DIR, 'vectors'), { recursive: true });
  await mkdir(join(OUTPUT_DIR, 'elements'), { recursive: true });
}

function serializeTable(table: VectorTable): VectorTable {
  return {
    id: table.id,
    horizonsId: table.horizonsId,
    center: table.center,
    count: table.count,
    t: roundAll(table.t, TIME_DECIMALS),
    x: roundAll(table.x, POSITION_DECIMALS),
    y: roundAll(table.y, POSITION_DECIMALS),
    z: roundAll(table.z, POSITION_DECIMALS),
    vx: roundAll(table.vx, VELOCITY_DECIMALS),
    vy: roundAll(table.vy, VELOCITY_DECIMALS),
    vz: roundAll(table.vz, VELOCITY_DECIMALS),
  };
}

/** A table shipped whole, as vectors/<id>.json. */
export async function writeVectors(table: VectorTable): Promise<void> {
  await writeCompactJson(join(OUTPUT_DIR, 'vectors', `${table.id}.json`), serializeTable(table));
}

/**
 * One piece of a chunked table, as vectors/<id>/<index>.json.
 *
 * Same columns and rounding as a whole table, so the app reads either with the same
 * interpolator; the manifest says which bodies are split and where.
 *
 * Returns the span the file actually covers, taken from the rounded times it was
 * written with. The app picks a chunk by that span and then searches the file's own
 * `t`, so the two must agree to the last digit or an instant on a boundary would fall
 * between them.
 */
export async function writeVectorChunk(table: VectorTable, index: number): Promise<ChunkInfo> {
  const directory = join(OUTPUT_DIR, 'vectors', table.id);
  await mkdir(directory, { recursive: true });
  const serialized = serializeTable(table);
  await writeCompactJson(join(directory, `${index}.json`), serialized);

  const startJd = serialized.t[0];
  const stopJd = serialized.t.at(-1);
  if (startJd === undefined || stopJd === undefined) {
    throw new Error(`${table.id} chunk ${index} is empty.`);
  }
  return { startJd, stopJd, count: serialized.count };
}

export async function writeElements(elements: OsculatingElements): Promise<void> {
  await writeJson(join(OUTPUT_DIR, 'elements', `${elements.id}.json`), elements);
}

/**
 * The star catalogue: 25,000 rows of six columns, so compact JSON like the vectors.
 *
 * Already rounded by `buildStarCatalog`, which does it against a pixel rather than
 * against a byte count -- so there is nothing left to trim here.
 */
export async function writeStars(stars: StarCatalog): Promise<void> {
  await writeCompactJson(join(OUTPUT_DIR, 'stars.json'), stars);
}

export async function writeCatalog(bodies: readonly BodyDefinition[]): Promise<void> {
  await writeJson(join(OUTPUT_DIR, 'bodies.json'), bodies);
}

export async function writeManifest(manifest: Manifest): Promise<void> {
  await writeJson(join(OUTPUT_DIR, 'manifest.json'), manifest);
}
