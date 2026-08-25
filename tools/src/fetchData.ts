/**
 * Generates the static ephemerides consumed by the web app.
 *
 * Runs locally (`pnpm fetch:data`) and in CI before the build. Output goes to
 * `web/public/data/` and is never committed: it is regenerated on every deploy.
 *
 * Source: JPL Horizons API -- https://ssd.jpl.nasa.gov/api/horizons.api
 * Ephemerides courtesy of NASA/JPL-Caltech.
 */

import { CATALOG, SSB_CENTER } from './catalog.ts';
import {
  HORIZONS_API_URL,
  MAX_CONCURRENT_REQUESTS,
  OUT_UNITS,
  OUTPUT_DIR,
  REF_PLANE,
  REF_SYSTEM,
  WINDOW_YEARS_BACK,
  WINDOW_YEARS_FORWARD,
} from './config.ts';
import { callHorizons } from './horizons/client.ts';
import { parseElements } from './horizons/parseElements.ts';
import { parseVectors } from './horizons/parseVectors.ts';
import { elementsQuery, fromJulianDay, vectorQuery } from './horizons/queries.ts';
import type { BodyDefinition, Manifest, OsculatingElements, VectorTable } from './types.ts';
import {
  prepareOutputDir,
  writeCatalog,
  writeElements,
  writeManifest,
  writeVectors,
} from './writeOutput.ts';

interface BodyResult {
  readonly vectors: VectorTable;
  readonly elements: OsculatingElements | null;
  readonly sourceVersion: string;
}

/** Runs `task` over `items` with at most `limit` in flight at once. */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      const item = items[index];
      if (item === undefined) {
        continue;
      }
      results[index] = await task(item);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );

  return results;
}

/** Adds whole years to a date without touching the time of day. */
function addYears(date: Date, years: number): Date {
  const shifted = new Date(date);
  shifted.setUTCFullYear(shifted.getUTCFullYear() + years);
  return shifted;
}

/** Midnight UTC today: the reference instant the whole run is built around. */
function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function fetchBody(
  body: BodyDefinition,
  start: Date,
  stop: Date,
  epoch: Date,
): Promise<BodyResult> {
  // Both calls for one body run together; the concurrency cap above limits how many
  // bodies are in flight, so JPL sees a handful of requests at a time, not twenty.
  const [vectorsResponse, elementsResponse] = await Promise.all([
    callHorizons(vectorQuery(body, start, stop), `${body.name} vectors`),
    body.drawOrbit
      ? callHorizons(elementsQuery(body, epoch), `${body.name} elements`)
      : Promise.resolve(null),
  ]);

  const vectors = parseVectors(vectorsResponse.result, body);
  const elements =
    elementsResponse === null ? null : parseElements(elementsResponse.result, body);

  console.log(
    `[fetch-data] ${body.name.padEnd(8)} ${String(vectors.count).padStart(5)} samples ` +
      `at ${body.stepDays}d`,
  );

  return { vectors, elements, sourceVersion: vectorsResponse.signature.version };
}

async function main(): Promise<void> {
  const epoch = todayUtcMidnight();
  const start = addYears(epoch, -WINDOW_YEARS_BACK);
  const stop = addYears(epoch, WINDOW_YEARS_FORWARD);

  console.log(`[fetch-data] Window ${start.toISOString()} .. ${stop.toISOString()}`);
  console.log(`[fetch-data] ${CATALOG.length} bodies, center ${SSB_CENTER}`);

  const results = await mapWithConcurrency(CATALOG, MAX_CONCURRENT_REQUESTS, (body) =>
    fetchBody(body, start, stop, epoch),
  );

  // Nothing is written until every body has come back clean, so a mid-run failure
  // cannot leave a half-populated data directory that looks publishable.
  await prepareOutputDir();

  for (const result of results) {
    await writeVectors(result.vectors);
    if (result.elements !== null) {
      await writeElements(result.elements);
    }
  }

  await writeCatalog(CATALOG);

  // The actual span comes from the data, not from what we asked for: Horizons
  // resolves the requested dates to TDB instants that differ slightly.
  const reference = results[0]?.vectors;
  if (reference === undefined) {
    throw new Error('No bodies were fetched; the catalog appears to be empty.');
  }
  const startJd = reference.t[0];
  const stopJd = reference.t.at(-1);
  if (startJd === undefined || stopJd === undefined) {
    throw new Error('The reference vector table had no samples.');
  }

  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    source: {
      name: 'NASA/JPL Horizons API',
      version: results[0]?.sourceVersion ?? 'unknown',
      url: HORIZONS_API_URL,
    },
    frame: {
      center: SSB_CENTER,
      refPlane: REF_PLANE,
      refSystem: REF_SYSTEM,
      units: OUT_UNITS,
    },
    window: {
      startJd,
      stopJd,
      startUtc: fromJulianDay(startJd).toISOString(),
      stopUtc: fromJulianDay(stopJd).toISOString(),
    },
    bodies: CATALOG.map((body) => body.id),
  };

  await writeManifest(manifest);

  console.log(`[fetch-data] Wrote ${results.length} bodies to ${OUTPUT_DIR}`);
  console.log('[fetch-data] Ephemerides courtesy of NASA/JPL-Caltech.');
}

await main();
