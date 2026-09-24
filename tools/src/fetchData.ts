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
 *   ESA Hipparcos and Tycho-2, via VizieR TAP at CDS Strasbourg
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
  SHORT_WINDOW_YEARS_BACK,
  SHORT_WINDOW_YEARS_FORWARD,
  WINDOW_YEARS_BACK,
  WINDOW_YEARS_FORWARD,
} from './config.ts';
import { callHorizons } from './horizons/client.ts';
import { fetchVectors } from './horizons/fetchVectors.ts';
import { parseElements } from './horizons/parseElements.ts';
import { elementsQuery, fromJulianDay, stepSize } from './horizons/queries.ts';
import { buildStarCatalog } from './stars/buildStarCatalog.ts';
import { fetchHipparcos, fetchTycho2 } from './stars/vizier.ts';
import type {
  BodyDefinition,
  BodyId,
  ChunkInfo,
  Manifest,
  OsculatingElements,
  TableInfo,
  VectorTable,
  VectorWindow,
} from './types.ts';
import {
  prepareOutputDir,
  writeCatalog,
  writeElements,
  writeManifest,
  writeStars,
  writeVectorChunk,
  writeVectors,
} from './writeOutput.ts';

interface BodyResult {
  readonly body: BodyDefinition;
  readonly vectors: VectorTable;
  /** The pieces the table was fetched in; a short-window body ships as these. */
  readonly parts: readonly VectorTable[];
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

/** The span a body's vectors are requested over, from its catalog window. */
function windowFor(window: VectorWindow, epoch: Date): { start: Date; stop: Date } {
  return window === 'full'
    ? { start: addYears(epoch, -WINDOW_YEARS_BACK), stop: addYears(epoch, WINDOW_YEARS_FORWARD) }
    : {
        start: addYears(epoch, -SHORT_WINDOW_YEARS_BACK),
        stop: addYears(epoch, SHORT_WINDOW_YEARS_FORWARD),
      };
}

async function fetchBody(body: BodyDefinition, epoch: Date): Promise<BodyResult> {
  const { start, stop } = windowFor(body.vectorWindow, epoch);

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
    `[fetch-data] ${body.name.padEnd(9)} ${String(vectors.table.count).padStart(6)} samples ` +
      `at ${stepSize(body.stepDays)}` +
      (vectors.chunks > 1 ? ` (${vectors.chunks} requests)` : '') +
      (body.vectorWindow === 'short' ? ', short window' : ''),
  );

  return {
    body,
    vectors: vectors.table,
    parts: vectors.parts,
    elements,
    sourceVersion: vectors.sourceVersion,
  };
}

/** First and last instant of a table, or a loud failure if it has none. */
function spanOf(table: VectorTable): { startJd: number; stopJd: number } {
  const startJd = table.t[0];
  const stopJd = table.t.at(-1);
  if (startJd === undefined || stopJd === undefined) {
    throw new Error(`${table.id} produced an empty vector table.`);
  }
  return { startJd, stopJd };
}

async function main(): Promise<void> {
  const epoch = todayUtcMidnight();
  const full = windowFor('full', epoch);
  const short = windowFor('short', epoch);

  console.log(`[fetch-data] Window ${full.start.toISOString()} .. ${full.stop.toISOString()}`);
  console.log(
    `[fetch-data] Short window ${short.start.toISOString()} .. ${short.stop.toISOString()}`,
  );
  console.log(`[fetch-data] ${CATALOG.length} bodies, center ${SSB_CENTER}`);

  // Two independent services, so they run together. The sky is two requests against
  // VizieR and comes back long before Horizons has finished with the planets.
  const [results, hipparcosRows, tycho2Rows] = await Promise.all([
    mapWithConcurrency(CATALOG, MAX_CONCURRENT_REQUESTS, (body) => fetchBody(body, epoch)),
    fetchHipparcos(),
    fetchTycho2(),
  ]);

  const stars = buildStarCatalog({
    hipparcos: hipparcosRows,
    tycho2: tycho2Rows,
    queriedAt: new Date().toISOString(),
  });
  for (const source of stars.sources) {
    console.log(
      `[fetch-data] ${source.table.padEnd(14)} ${String(source.stars).padStart(6)} stars`,
    );
  }
  console.log(
    `[fetch-data] stars   ${String(stars.count).padStart(7)} to magnitude ` +
      `${stars.magnitudeLimit}` +
      (stars.dropped.noColorIndex + stars.dropped.noPosition > 0
        ? ` (${stars.dropped.noColorIndex} dropped for no B-V, ` +
          `${stars.dropped.noPosition} for no position)`
        : ''),
  );

  // Nothing is written until every body has come back clean, so a mid-run failure
  // cannot leave a half-populated data directory that looks publishable.
  await prepareOutputDir();

  const tables: Record<BodyId, TableInfo> = {};
  for (const result of results) {
    if (result.body.vectorWindow === 'full') {
      await writeVectors(result.vectors);
      tables[result.body.id] = { ...spanOf(result.vectors), chunks: null };
    } else {
      // Shipped as the pieces it was fetched in. Each is about 1500 samples -- Phobos
      // is 47 of them -- and the app fetches only the one covering the instant it is
      // drawing.
      const chunks: ChunkInfo[] = [];
      for (const [index, part] of result.parts.entries()) {
        chunks.push(await writeVectorChunk(part, index));
      }
      const first = chunks[0];
      const last = chunks.at(-1);
      if (first === undefined || last === undefined) {
        throw new Error(`${result.body.id} produced no chunks.`);
      }
      tables[result.body.id] = { startJd: first.startJd, stopJd: last.stopJd, chunks };
    }
    if (result.elements !== null) {
      await writeElements(result.elements);
    }
  }

  await writeCatalog(CATALOG);
  await writeStars(stars);

  // The window every full-window body can answer for: the intersection of their
  // tables, not the range we asked for. Publishing the request instead would claim
  // coverage the widest-stepped bodies do not have, and the app would fall back to
  // propagation without flagging it. The short-window moons are left out, or this
  // would shrink to their two years; their own spans are in `tables`.
  let startJd = -Infinity;
  let stopJd = Infinity;
  for (const result of results.filter((candidate) => candidate.body.vectorWindow === 'full')) {
    const span = spanOf(result.vectors);
    startJd = Math.max(startJd, span.startJd);
    stopJd = Math.min(stopJd, span.stopJd);
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
    tables,
  };

  await writeManifest(manifest);

  const samples = results.reduce((total, result) => total + result.vectors.count, 0);
  console.log(
    `[fetch-data] Wrote ${results.length} bodies (${samples} samples) and ` +
      `${stars.count} stars to ${OUTPUT_DIR}`,
  );
  console.log('[fetch-data] Ephemerides courtesy of NASA/JPL-Caltech.');
  console.log('[fetch-data] Star data from ESA Hipparcos and Tycho-2, via VizieR (CDS).');
}

await main();
