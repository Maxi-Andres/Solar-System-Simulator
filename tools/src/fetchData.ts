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
  MAX_SAMPLES_PER_REQUEST,
  OUT_UNITS,
  OUTPUT_DIR,
  PATH_ANGULAR_TOLERANCE,
  SPACECRAFT_ANGULAR_TOLERANCE,
  REF_PLANE,
  REF_SYSTEM,
  SHORT_WINDOW_YEARS_BACK,
  SHORT_WINDOW_YEARS_FORWARD,
  SPACECRAFT_CHUNK_SAMPLES,
  SPACECRAFT_MIN_STEP_MINUTES,
  SPACECRAFT_TOLERANCE_KM,
  WINDOW_YEARS_BACK,
  WINDOW_YEARS_FORWARD,
} from './config.ts';
import { callHorizons } from './horizons/client.ts';
import { fetchCoverage, horizonsProbe, lastWithData } from './horizons/coverage.ts';
import { fetchMissionVectors, fetchVectors, splitTable } from './horizons/fetchVectors.ts';
import { type Discontinuity, ESTIMATE_MARGIN } from './horizons/refine.ts';
import { parseElements } from './horizons/parseElements.ts';
import { elementsQuery, fromJulianDay, stepSize } from './horizons/queries.ts';
import {
  locateSeams,
  nearestBodyTolerance,
  type PositionAt,
  positionAt,
  simplifyPath,
} from './paths.ts';
import { buildStarCatalog } from './stars/buildStarCatalog.ts';
import { fetchHipparcos, fetchTycho2 } from './stars/vizier.ts';
import type {
  BodyDefinition,
  BodyId,
  ChunkInfo,
  Manifest,
  OsculatingElements,
  PathInfo,
  TableInfo,
  VectorTable,
  VectorWindow,
} from './types.ts';
import {
  prepareOutputDir,
  writeCatalog,
  writeElements,
  writeManifest,
  serializeSeam,
  writePath,
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
  /** Where a spacecraft's refinement hit its floor with the tolerance still missed. */
  readonly discontinuities: readonly Discontinuity[];
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

/** Adds whole months to a date, as Date.setUTCMonth does. */
function addMonths(date: Date, months: number): Date {
  const shifted = new Date(date);
  shifted.setUTCMonth(shifted.getUTCMonth() + months);
  return shifted;
}

/** Midnight UTC today: the reference instant the whole run is built around. */
function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * The span a body's vectors are requested over, from its catalog window.
 *
 * A spacecraft asks for the full window and is then cut to what JPL covers.
 */
function windowFor(window: VectorWindow, epoch: Date): { start: Date; stop: Date } {
  return window !== 'short'
    ? { start: addYears(epoch, -WINDOW_YEARS_BACK), stop: addYears(epoch, WINDOW_YEARS_FORWARD) }
    : {
        start: addYears(epoch, -SHORT_WINDOW_YEARS_BACK),
        stop: addYears(epoch, SHORT_WINDOW_YEARS_FORWARD),
      };
}

/** Formats a TDB Julian day as a calendar instant for the log. */
function logDate(jd: number): string {
  return `${fromJulianDay(jd).toISOString().slice(0, 16).replace('T', ' ')} TDB`;
}

async function fetchSpacecraft(
  body: BodyDefinition,
  epoch: Date,
  frames: ReferenceFrames,
): Promise<BodyResult | null> {
  // The whole window, or -- for a craft in close orbit -- a few months either side.
  const months = body.mission?.windowMonths ?? null;
  const { start, stop } =
    months === null
      ? windowFor(body.vectorWindow, epoch)
      : { start: addMonths(epoch, -months), stop: addMonths(epoch, months) };
  const stated = await fetchCoverage(body);
  // A craft whose data ends before its window opens -- MAVEN, whose path stops at
  // 2026-03-01, against a window three months either side of the build -- is left out
  // of this run rather than failing it. It comes back by itself if the window reaches it.
  if (stated.stop.getTime() <= start.getTime() || stated.start.getTime() >= stop.getTime()) {
    console.log(
      `[fetch-data] ${body.name}: no data inside its window ` +
        `(${stated.start.toISOString().slice(0, 10)} .. ${stated.stop.toISOString().slice(0, 10)}); left out`,
    );
    return null;
  }
  // Where the stated span outruns the data -- DART's runs years past its impact -- the
  // end is pulled back to the last day that has any. See `lastWithData`.
  // And never past the instant the craft stopped existing.
  const destroyed = body.mission?.endUtc ?? null;
  const statedEnd = new Date(
    Math.min(
      stop.getTime(),
      stated.stop.getTime(),
      destroyed === null ? Infinity : Math.floor(Date.parse(destroyed) / 60_000) * 60_000,
    ),
  );
  const dataEnd = await lastWithData(
    new Date(Math.max(start.getTime(), stated.start.getTime()) + 120_000),
    statedEnd,
    horizonsProbe(body),
  );
  if (dataEnd.getTime() < statedEnd.getTime()) {
    console.log(
      `[fetch-data]   ${body.name}: Horizons has no data after ` +
        `${dataEnd.toISOString().slice(0, 10)} inside its stated coverage; cut there`,
    );
  }
  const coverage = { start: stated.start, stop: dataEnd };
  const origin: PositionAt =
    body.parent === null ? () => [0, 0, 0] : frames.barycentric(body.parent);
  const { table, sourceVersion, result } = await fetchMissionVectors(body, start, stop, coverage, {
    toleranceKm: SPACECRAFT_TOLERANCE_KM,
    toleranceAt: nearestBodyTolerance(
      frames.references,
      origin,
      SPACECRAFT_ANGULAR_TOLERANCE,
      SPACECRAFT_TOLERANCE_KM,
    ),
    minStepMinutes: SPACECRAFT_MIN_STEP_MINUTES,
    margin: ESTIMATE_MARGIN,
    samplesPerRequest: MAX_SAMPLES_PER_REQUEST,
  });
  const parts = splitTable(table, SPACECRAFT_CHUNK_SAMPLES);

  console.log(
    `[fetch-data] ${body.name.padEnd(9)} ${String(table.count).padStart(6)} samples, ` +
      `adaptive ${stepSize(body.stepDays)} .. ${result.finestStepMinutes}m ` +
      `(${result.requests} requests, ${parts.length} chunk${parts.length === 1 ? '' : 's'}), ` +
      `${logDate(table.t[0]!)} .. ${logDate(table.t.at(-1)!)}`,
  );
  // Not ours to fix and not to be hidden: the path JPL publishes jumps here.
  for (const seam of result.discontinuities) {
    console.log(
      `[fetch-data]   ${body.name}: JPL's path jumps ~${Math.round(seam.jumpKm).toLocaleString('en-US')} km ` +
        `near ${logDate(seam.jd)}`,
    );
  }

  return {
    body,
    vectors: table,
    parts,
    elements: null,
    sourceVersion,
    discontinuities: result.discontinuities,
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
    discontinuities: [],
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

/** Where the reference bodies are, for measuring a spacecraft's tolerances against. */
interface ReferenceFrames {
  /** A full-window body's barycentric position, walking its parents. */
  readonly barycentric: (id: BodyId) => PositionAt;
  /** Every full-window body's: the Sun, the planets, Pluto and the Moon. */
  readonly references: readonly PositionAt[];
}

/**
 * The reference bodies, from the tables fetched for them.
 *
 * Only those whose tables span the whole window. The other moons cover two years, so a
 * craft passing one outside them -- Europa Clipper at Europa from 2031 -- is held to
 * Jupiter's distance instead. The moons themselves are propagated there anyway.
 */
function referenceFrames(results: readonly BodyResult[]): ReferenceFrames {
  const full = new Map(
    results
      .filter((result) => result.body.vectorWindow === 'full')
      .map((result) => [result.body.id, result] as const),
  );
  // Barycentric, by walking the parents: the Moon's table is relative to Earth.
  const barycentric = (id: BodyId): PositionAt => {
    const result = full.get(id);
    if (result === undefined) {
      throw new Error(`${id} has no full-window table to measure against.`);
    }
    const parent = result.body.parent === null ? null : barycentric(result.body.parent);
    return (jd) => {
      const local = positionAt(result.vectors, jd);
      if (local === null || parent === null) {
        return local;
      }
      const origin = parent(jd);
      return origin === null
        ? null
        : [local[0] + origin[0], local[1] + origin[1], local[2] + origin[2]];
    };
  };
  return { barycentric, references: [...full.keys()].map(barycentric) };
}

/**
 * Every spacecraft's drawable trajectory, written to paths/ -- see paths.ts.
 *
 * The tolerance is measured from the bodies whose tables span the whole window: the
 * Sun, the planets, Pluto and the Moon. The other moons cover two years, so a craft
 * passing one outside them -- Europa Clipper at Europa from 2031 -- is held to Jupiter's
 * distance instead. The moons themselves are propagated there anyway.
 */
async function writePaths(
  results: readonly BodyResult[],
  frames: ReferenceFrames,
): Promise<Record<BodyId, PathInfo>> {
  const { barycentric, references } = frames;
  const atBarycentre: PositionAt = () => [0, 0, 0];

  const paths: Record<BodyId, PathInfo> = {};
  for (const result of results.filter((candidate) => candidate.body.vectorWindow === 'mission')) {
    const { body, vectors } = result;
    const seams = locateSeams(vectors, result.discontinuities);
    // A craft followed only briefly is one that goes round fast: its trail is drawn from
    // its table. See PathInfo.count.
    if (body.mission !== null && body.mission.windowMonths !== null) {
      paths[body.id] = {
        count: null,
        angularTolerance: PATH_ANGULAR_TOLERANCE,
        floorKm: SPACECRAFT_TOLERANCE_KM,
        seams: seams.map(serializeSeam),
      };
      console.log(`[fetch-data] ${body.name.padEnd(9)} trail from its table, no path file`);
      continue;
    }
    const origin = body.parent === null ? atBarycentre : barycentric(body.parent);
    const path = simplifyPath(
      vectors,
      seams,
      nearestBodyTolerance(references, origin, PATH_ANGULAR_TOLERANCE, SPACECRAFT_TOLERANCE_KM),
    );
    await writePath(path);
    paths[body.id] = {
      count: path.count,
      angularTolerance: PATH_ANGULAR_TOLERANCE,
      floorKm: SPACECRAFT_TOLERANCE_KM,
      seams: seams.map(serializeSeam),
    };

    console.log(
      `[fetch-data] ${body.name.padEnd(9)} path ${String(path.count).padStart(5)} of ` +
        `${vectors.count} samples` +
        (seams.length > 0 ? `, ${seams.length} seam${seams.length === 1 ? '' : 's'}` : ''),
    );
  }
  return paths;
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
  const [natural, hipparcosRows, tycho2Rows] = await Promise.all([
    mapWithConcurrency(
      CATALOG.filter((body) => body.vectorWindow !== 'mission'),
      MAX_CONCURRENT_REQUESTS,
      (body) => fetchBody(body, epoch),
    ),
    fetchHipparcos(),
    fetchTycho2(),
  ]);

  // The spacecraft after the natural bodies, because their sampling is measured against
  // them: how fine a craft must be followed depends on how far it is from the nearest.
  const frames = referenceFrames(natural);
  const craft = await mapWithConcurrency(
    CATALOG.filter((body) => body.vectorWindow === 'mission'),
    MAX_CONCURRENT_REQUESTS,
    (body) => fetchSpacecraft(body, epoch, frames),
  );
  const results = [...natural, ...craft.filter((result) => result !== null)];
  // What this run publishes: every body that came back. A craft left out above is in
  // neither the catalog nor the manifest, so the app never asks for its table.
  const published = new Set(results.map((result) => result.body.id));
  const catalog = CATALOG.filter((body) => published.has(body.id));

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
    // A spacecraft is always chunked, even when one chunk holds all of it: a whole table
    // is loaded before the first frame, and with forty craft that would be forty files
    // the visitor waits for to see the Sun. A chunk arrives a frame or two after the
    // craft is first wanted, which is all the delay there is.
    if (result.body.vectorWindow === 'full') {
      await writeVectors(result.vectors);
      tables[result.body.id] = { ...spanOf(result.vectors), chunks: null };
    } else {
      // Shipped as the pieces it was fetched in. Each is about 1500 samples -- Phobos
      // is 47 of them -- and the app fetches only the one covering the instant it is
      // drawing. A spacecraft's were cut from its finished table the same size.
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

  const paths = await writePaths(results, frames);

  await writeCatalog(catalog);
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
    bodies: catalog.map((body) => body.id),
    tables,
    paths,
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
