/**
 * Generates the static ephemerides consumed by the web app.
 *
 * Runs locally (`pnpm fetch:data`) and in CI before the build. Output goes to
 * `web/public/data/` and is never committed: it is regenerated on every deploy.
 *
 * Two sources, both official and both queried at build time:
 *
 *   JPL Horizons API -- https://ssd.jpl.nasa.gov/api/horizons.api
 *     Positions and velocities for every body. Courtesy of NASA/JPL-Caltech.
 *
 *   ESA Hipparcos, via VizieR TAP at CDS Strasbourg
 *     Position, proper motion, magnitude and colour index for every star drawn.
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
import { fetchVectors } from './horizons/fetchVectors.ts';
import { parseElements } from './horizons/parseElements.ts';
import { elementsQuery, fromJulianDay } from './horizons/queries.ts';
import { buildStarCatalog } from './stars/buildStarCatalog.ts';
import { fetchHipparcos } from './stars/vizier.ts';
import type { BodyDefinition, Manifest, OsculatingElements, VectorTable } from './types.ts';
import {
  prepareOutputDir,
  writeCatalog,
  writeElements,
  writeManifest,
  writeStars,
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
  // bodies are in flight, so JPL sees a handful of requests at a time.
  const [vectors, elementsResponse] = await Promise.all([
    fetchVectors(body, start, stop),
    body.drawOrbit
      ? callHorizons(elementsQuery(body, epoch), `${body.name} elements`)
      : Promise.resolve(null),
  ]);

  const elements =
    elementsResponse === null ? null : parseElements(elementsResponse.result, body);

  console.log(
    `[fetch-data] ${body.name.padEnd(8)} ${String(vectors.table.count).padStart(5)} samples ` +
      `at ${body.stepDays}d` +
      (vectors.chunks > 1 ? ` (${vectors.chunks} requests)` : ''),
  );

  return { vectors: vectors.table, elements, sourceVersion: vectors.sourceVersion };
}

async function main(): Promise<void> {
  const epoch = todayUtcMidnight();
  const start = addYears(epoch, -WINDOW_YEARS_BACK);
  const stop = addYears(epoch, WINDOW_YEARS_FORWARD);

  console.log(`[fetch-data] Window ${start.toISOString()} .. ${stop.toISOString()}`);
  console.log(`[fetch-data] ${CATALOG.length} bodies, center ${SSB_CENTER}`);

  // Two independent services, so they run together. The sky is one request against
  // VizieR and comes back long before Horizons has finished with the planets.
  const [results, starRows] = await Promise.all([
    mapWithConcurrency(CATALOG, MAX_CONCURRENT_REQUESTS, (body) =>
      fetchBody(body, start, stop, epoch),
    ),
    fetchHipparcos(),
  ]);

  const stars = buildStarCatalog(starRows, new Date().toISOString());
  console.log(
    `[fetch-data] stars    ${String(stars.count).padStart(5)} to magnitude ` +
      `${stars.magnitudeLimit}` +
      (stars.dropped.noColorIndex + stars.dropped.noPosition > 0
        ? ` (${stars.dropped.noColorIndex} dropped for no B-V, ` +
          `${stars.dropped.noPosition} for no position)`
        : ''),
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
  await writeStars(stars);

  // The window every body can answer for: the intersection of all the tables, not
  // the range we asked for. Publishing the request instead would claim coverage the
  // widest-stepped bodies do not have, and the app would fall back to propagation
  // without flagging it.
  let startJd = -Infinity;
  let stopJd = Infinity;
  for (const result of results) {
    const first = result.vectors.t[0];
    const last = result.vectors.t.at(-1);
    if (first === undefined || last === undefined) {
      throw new Error(`${result.vectors.id} produced an empty vector table.`);
    }
    startJd = Math.max(startJd, first);
    stopJd = Math.min(stopJd, last);
  }
  if (!Number.isFinite(startJd) || !Number.isFinite(stopJd) || stopJd <= startJd) {
    throw new Error('The bodies do not share a usable time window.');
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

  console.log(
    `[fetch-data] Wrote ${results.length} bodies and ${stars.count} stars to ${OUTPUT_DIR}`,
  );
  console.log('[fetch-data] Ephemerides courtesy of NASA/JPL-Caltech.');
  console.log('[fetch-data] Star positions from the ESA Hipparcos catalogue, via VizieR (CDS).');
}

await main();
