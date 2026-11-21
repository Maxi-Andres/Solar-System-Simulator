import { existsSync } from 'node:fs';
import { cp, rm, stat } from 'node:fs/promises';
import { join, relative, resolve, isAbsolute } from 'node:path';

import { githubWarning } from './annotate.ts';
import {
  CONSTELLATIONS_FILE,
  EXOPLANETS_FILE,
  GLOBULAR_CLUSTERS_FILE,
  LANIAKEA_DIR,
  LANIAKEA_INFO_FILE,
  LOCAL_GROUP_FILE,
  LOCAL_VOLUME_FILE,
  OUTPUT_DIR,
  PULSARS_FILE,
  STARS3D_DIR,
  STARS3D_INFO_FILE,
} from './config.ts';

/**
 * The last good data, for a catalogue whose host is down.
 *
 * A run reads a dozen hosts besides JPL's, and any one of them failing used to fail the
 * deploy: on most pushes one of VizieR, HyperLEDA, CDS, the Gaia archive or the CosmicFlows
 * page was refusing GitHub's runners, and nothing was published. The download cache
 * (downloadCache.ts) answers for a host it has heard from before; this is for what still
 * fails. The deploy restores the last full run's data directory to DATA_FALLBACK, and a
 * product that cannot be built this run is copied from there instead -- with a warning on the
 * run's page naming it, why, and how old the copy is -- and the run carries on. A product
 * with no copy there fails the run as before.
 *
 * Each product is copied whole, every file it writes: a product is the unit its files
 * agree within. The stars' 3D records name stars.json's rows, and exoplanets.json names the
 * 3D records its hosts are, so the three are one product, falling back together. The Local
 * Volume and Laniakea read the Local Group to leave out what it draws; the run hands them
 * the Local Group it read, so when that fails they fail with it and all three fall back.
 *
 * The ephemerides never fall back: see the comment above the reads in fetchData.ts.
 */

export interface DataProduct {
  /** For the log and the warning: "the pulsars". */
  readonly name: string;
  /** Every file and directory it writes, relative to the data directory: copied whole. */
  readonly paths: readonly string[];
  /** The files that say it was written whole -- each directory's description, written last. */
  readonly complete: readonly string[];
}

/** The products that may fall back. Not the satellites: elements a week old are wrong. */
export const DATA_PRODUCTS = {
  stars: {
    name: 'the stars and their planets',
    paths: ['stars.json', STARS3D_DIR, EXOPLANETS_FILE],
    complete: ['stars.json', `${STARS3D_DIR}/${STARS3D_INFO_FILE}`, EXOPLANETS_FILE],
  },
  // A week-old belt is still a correct one: belt.json and comets.json state the instant
  // their anomalies are for, and the app propagates from there.
  belt: { name: 'the asteroid belt and the comets', paths: ['belt'], complete: ['belt/belt.json', 'belt/comets.json'] },
  pulsars: { name: 'the pulsars', paths: [PULSARS_FILE], complete: [PULSARS_FILE] },
  // Its figures are matched against the sky the stars read: when that fails, so do they, and both
  // fall back. A positions-only file, so an older copy beside newer stars is still right.
  constellations: { name: 'the constellations', paths: [CONSTELLATIONS_FILE], complete: [CONSTELLATIONS_FILE] },
  globularClusters: { name: 'the globular clusters', paths: [GLOBULAR_CLUSTERS_FILE], complete: [GLOBULAR_CLUSTERS_FILE] },
  localGroup: { name: 'the Local Group', paths: [LOCAL_GROUP_FILE], complete: [LOCAL_GROUP_FILE] },
  localVolume: { name: 'the Local Volume', paths: [LOCAL_VOLUME_FILE], complete: [LOCAL_VOLUME_FILE] },
  laniakea: { name: 'Laniakea', paths: [LANIAKEA_DIR], complete: [`${LANIAKEA_DIR}/${LANIAKEA_INFO_FILE}`] },
} as const satisfies Record<string, DataProduct>;

export type Outcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown };

/**
 * A promise that cannot reject: its value or its error. Applied where each product's read
 * starts, so no failure of one escapes into the Promise.all that waits for them all.
 */
export function settle<T>(promise: Promise<T>): Promise<Outcome<T>> {
  return promise.then(
    (value) => ({ ok: true, value }),
    (error: unknown) => ({ ok: false, error }),
  );
}

/**
 * DATA_FALLBACK's directory, or null when it is unset or does not exist (a first run, or a
 * local one: nothing to fall back on, and a failure fails as it always has). Refused inside
 * the data directory, which the run empties before it writes.
 */
export function dataFallbackDirectory(
  setting = process.env.DATA_FALLBACK,
  outputDir = OUTPUT_DIR,
): string | null {
  if (setting === undefined || setting === '') {
    return null;
  }
  const directory = resolve(setting);
  const inside = relative(outputDir, directory);
  if (inside === '' || (!inside.startsWith('..') && !isAbsolute(inside))) {
    throw new Error(`DATA_FALLBACK (${directory}) is inside ${outputDir}, which this run empties: copy it elsewhere first.`);
  }
  return existsSync(directory) ? directory : null;
}

export interface ProductFailure {
  readonly product: DataProduct;
  readonly error: unknown;
}

export interface FallbackPlan {
  /** Copied from the fallback directory. */
  readonly restore: readonly ProductFailure[];
  /** Nothing to copy: the run fails. */
  readonly fatal: readonly ProductFailure[];
}

/**
 * What to do with each failed product: copy it from `directory` if every one of its
 * `complete` files is there, else fail the run. A product failed twice (the stars and their
 * planets, each with its own reason) is decided once, its reasons joined.
 */
export function planFallbacks(
  failures: readonly ProductFailure[],
  directory: string | null,
  exists: (path: string) => boolean = existsSync,
): FallbackPlan {
  const byProduct = new Map<DataProduct, unknown[]>();
  for (const { product, error } of failures) {
    byProduct.set(product, [...(byProduct.get(product) ?? []), error]);
  }
  const restore: ProductFailure[] = [];
  const fatal: ProductFailure[] = [];
  for (const [product, errors] of byProduct) {
    const failure = { product, error: errors.length === 1 ? errors[0] : new Error(errors.map(String).join('; ')) };
    const available = directory !== null && product.complete.every((file) => exists(join(directory, file)));
    (available ? restore : fatal).push(failure);
  }
  return { restore, fatal };
}

/** The reason, on one line, short enough for an annotation's title to stay readable. */
export function reasonOf(error: unknown, length = 400): string {
  return (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').slice(0, length);
}

/**
 * Copies a product's files from the fallback directory into `outputDir`, timestamps kept
 * -- so a copy of a copy still says when it was built -- and says so, in the log and on the
 * run's page. Returns the date its files were written.
 */
export async function restoreProduct(
  failure: ProductFailure,
  from: string,
  outputDir = OUTPUT_DIR,
): Promise<string> {
  const { product } = failure;
  for (const path of product.paths) {
    const source = join(from, path);
    if (!existsSync(source)) {
      continue;
    }
    const target = join(outputDir, path);
    await rm(target, { recursive: true, force: true });
    await cp(source, target, { recursive: true, preserveTimestamps: true });
  }
  const builtOn = (await stat(join(from, product.complete[0]!))).mtime.toISOString().slice(0, 10);
  const reason = reasonOf(failure.error);
  console.warn(`[fetch-data] STALE: ${product.name} could not be built (${reason}); copied the last good data, built ${builtOn}.`);
  githubWarning(
    `Stale data: ${product.name}`,
    `${product.name} could not be built this run, so this deploy carries the last good copy, built ${builtOn}. Why: ${reason}`,
  );
  return builtOn;
}

/** The error a run with failures nothing can stand in for ends with. */
export function fatalError(fatal: readonly ProductFailure[], directory: string | null): Error {
  const where = directory === null ? 'no fallback directory (DATA_FALLBACK)' : `no copy in ${directory}`;
  return new Error(
    `${fatal.length} product${fatal.length === 1 ? '' : 's'} could not be built, and ${where} to stand in:\n  ` +
      fatal.map(({ product, error }) => `${product.name}: ${reasonOf(error, 1500)}`).join('\n  '),
  );
}
