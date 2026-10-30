/**
 * Generates the static ephemerides consumed by the web app.
 *
 * Runs locally (`pnpm fetch:data`) and in CI before the build. Output goes to
 * `web/public/data/` and is never committed: it is regenerated on every deploy.
 *
 * Three sources, all official and all queried at build time:
 *
 *   JPL Horizons API -- https://ssd.jpl.nasa.gov/api/horizons.api
 *     Positions and velocities for every body. Courtesy of NASA/JPL-Caltech.
 *
 *   ESA Hipparcos and Tycho-2, Gaia DR3 and the Gaia Catalogue of Nearby Stars, via
 *   VizieR TAP at CDS Strasbourg and the ESA Gaia Archive's TAP at ESAC
 *     Position, proper motion, magnitude and colour index for every star drawn, and the
 *     distances and space motions that put them in 3D. See stars/.
 *
 *   JPL Small-Body Database Query API -- https://ssd-api.jpl.nasa.gov/sbdb_query.api
 *     Osculating elements for the asteroid belt and the comets. See belt/.
 *
 *   CelesTrak GP data -- https://celestrak.org/NORAD/elements/
 *     SGP4 mean elements for the Earth satellites, from the US Space Force's catalogue.
 *     See satellites/.
 *
 *   NASA Exoplanet Archive TAP -- https://exoplanetarchive.ipac.caltech.edu/TAP/sync
 *     Every confirmed planet of another star, and its host. See exoplanets/.
 *
 *   ATNF Pulsar Catalogue -- https://www.atnf.csiro.au/research/pulsar/psrcat/
 *   McGill Online Magnetar Catalog -- https://www.physics.mcgill.ca/~pulsar/magnetar/
 *     The neutron stars seen as pulsars, and the magnetars. See pulsars/.
 */

import { pathToFileURL } from 'node:url';

import { BeltAccumulator, catalogDesignations, describeBelt } from './belt/buildBelt.ts';
import { buildComets, describeComets, fetchComets } from './belt/comets.ts';
import { fetchBelt } from './belt/sbdb.ts';
import { CATALOG, SSB_CENTER } from './catalog.ts';
import { cometDesignations } from './famousComets.ts';
import {
  BELT_MAGNITUDE_LIMIT,
  BELT_TIER_LIMITS,
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
import {
  cutAtBrokenJumps,
  fetchMissionVectors,
  fetchVectors,
  splitTable,
} from './horizons/fetchVectors.ts';
import { type Discontinuity, ESTIMATE_MARGIN } from './horizons/refine.ts';
import { parseElements } from './horizons/parseElements.ts';
import { elementsQuery, fromJulianDay, stepSize, toJulianDay } from './horizons/queries.ts';
import {
  locateSeams,
  nearestBodyTolerance,
  type PositionAt,
  positionAt,
  simplifyPath,
} from './paths.ts';
import { ARCHIVE_ACKNOWLEDGEMENT, fetchArchive } from './exoplanets/archive.ts';
import { buildExoplanets, describeExoplanets, starIdsFromBuild } from './exoplanets/buildExoplanets.ts';
import { describePulsars } from './pulsars/buildPulsars.ts';
import { loadPulsars } from './pulsars/fetchPulsars.ts';
import { loadSatellites } from './satellites/fetchSatellites.ts';
import { fetchTraverse, fixedTrack, parseTraverse, traverseTrack } from './surface.ts';
import { describeSky, loadSky, loadStars3d } from './stars/fetchStars.ts';
import type {
  BodyDefinition,
  BodyId,
  ChunkInfo,
  Manifest,
  OsculatingElements,
  PathInfo,
  SmallMoonCount,
  SurfaceInfo,
  SurfaceTrack,
  TableInfo,
  VectorTable,
  VectorWindow,
} from './types.ts';
import {
  prepareOutputDir,
  writeBelt,
  writeCatalog,
  writeSatellites,
  writeElements,
  writeExoplanets,
  writePulsars,
  writeSmallMoonBundle,
  writeManifest,
  serializeSeam,
  writePath,
  writeStars,
  writeStars3d,
  writeSurface,
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

/** How many small moons between two progress lines in the log. */
const SMALL_MOON_PROGRESS_EVERY = 25;

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

/**
 * Midnight UTC today: the reference instant the whole run is built around.
 *
 * Exported for `fetch:belt`, which regenerates the belt alone and must put its mean
 * anomalies at the same instant a full run would.
 */
export function todayUtcMidnight(): Date {
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
  const fetched = await fetchMissionVectors(body, start, stop, coverage, {
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
  const { sourceVersion, result } = fetched;
  // A jump no craft could make is a file that has stopped describing it, and the shorter
  // side of it goes; see cutAtBrokenJumps.
  const repaired = cutAtBrokenJumps(fetched.table, result.discontinuities);
  const table = repaired.table;
  for (const cut of repaired.cuts) {
    console.log(
      `[fetch-data]   ${body.name}: JPL's path jumps ~${Math.round(cut.jumpKm).toLocaleString('en-US')} km ` +
        `near ${logDate(cut.jd)}, more than any craft can; kept only the part ${cut.kept} it`,
    );
  }
  const parts = splitTable(table, SPACECRAFT_CHUNK_SAMPLES);

  console.log(
    `[fetch-data] ${body.name.padEnd(9)} ${String(table.count).padStart(6)} samples, ` +
      `adaptive ${stepSize(body.stepDays)} .. ${result.finestStepMinutes}m ` +
      `(${result.requests} requests, ${parts.length} chunk${parts.length === 1 ? '' : 's'}), ` +
      `${logDate(table.t[0]!)} .. ${logDate(table.t.at(-1)!)}`,
  );
  // Not ours to fix and not to be hidden: the path JPL publishes jumps here.
  for (const seam of repaired.discontinuities) {
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
    discontinuities: repaired.discontinuities,
  };
}

/**
 * True for a small moon: sampled adaptively and shipped in its planet's bundle rather
 * than with the startup files. A small body about the Sun is sampled the same way but
 * published like any other body.
 */
export function isSmallMoon(body: BodyDefinition): boolean {
  return body.sampling !== undefined && body.parent !== null;
}

/**
 * A natural body sampled adaptively, as a spacecraft is: a small moon over its own
 * window, or a named small body over the planets' -- see SMALL_MOONS and SMALL_BODIES in
 * the catalog. Null when JPL has nothing for it inside that window (Daphnis's ephemeris
 * stops in 2018), or no elements to propagate it with outside: a body the app could
 * neither place nor fall back on is left out of the run.
 */
export async function fetchAdaptiveBody(
  body: BodyDefinition,
  epoch: Date,
): Promise<BodyResult | null> {
  const sampling = body.sampling;
  if (sampling === undefined) {
    throw new Error(`${body.id} is not sampled adaptively.`);
  }
  const months = sampling.windowMonths;
  const { start, stop } =
    months === null
      ? windowFor('full', epoch)
      : { start: addMonths(epoch, -months), stop: addMonths(epoch, months) };
  const stated = await fetchCoverage(body);
  if (stated.stop.getTime() <= start.getTime() || stated.start.getTime() >= stop.getTime()) {
    console.log(
      `[fetch-data] ${body.name}: no data inside its window ` +
        `(${stated.start.toISOString().slice(0, 10)} .. ${stated.stop.toISOString().slice(0, 10)}); left out`,
    );
    return null;
  }
  const statedEnd = new Date(Math.min(stop.getTime(), stated.stop.getTime()));
  const dataEnd = await lastWithData(
    new Date(Math.max(start.getTime(), stated.start.getTime()) + 120_000),
    statedEnd,
    horizonsProbe(body),
  );
  let elements: OsculatingElements;
  try {
    elements = parseElements(
      (await callHorizons(elementsQuery(body, epoch), `${body.name} elements`)).result,
      body,
    );
  } catch (error) {
    console.log(`[fetch-data] ${body.name}: no elements at the build (${String(error).slice(0, 120)}); left out`);
    return null;
  }
  // A moon is bound to its planet, an asteroid to the Sun. An open orbit means Horizons
  // answered for some other object under that number -- see majorBodyIds in
  // moons/buildMoonList.ts.
  //
  // Not so a comet: 2I and 3I are on hyperbolas, and a long-period comet near e = 1 can
  // be on either side of it on the day of a run. Its elements are published as they are,
  // and the app draws no ellipse and propagates nothing from an open orbit.
  if (!(elements.eccentricity < 1) && body.kind !== 'comet') {
    console.log(
      `[fetch-data] ${body.name}: unbound about ${body.parent} (e = ${elements.eccentricity.toFixed(3)}), ` +
        'not the moon; left out',
    );
    return null;
  }
  const { table, sourceVersion, result } = await fetchMissionVectors(
    body,
    start,
    stop,
    { start: stated.start, stop: dataEnd },
    {
      toleranceKm: sampling.toleranceKm,
      // A small moon, far out, takes the spacecraft's angle: ten microradians seen from
      // the planet, 200 km for an irregular moon 20 million km out and a thirtieth of a
      // pixel from there. Held to its kilometre instead, every small jump between JPL's
      // ephemeris files was refined to two minutes, and opening Jupiter cost 6 MB of them.
      //
      // A small body about the Sun keeps its kilometre everywhere. Spacecraft fly in
      // formation with these -- OSIRIS-REx a kilometre off Bennu, Hera arriving at
      // Didymos -- and the craft is held to a kilometre there, so the body must be too or
      // the two would part on screen by the body's error, not the craft's.
      toleranceAt: isSmallMoon(body)
        ? (_jd, position) =>
            Math.max(
              sampling.toleranceKm,
              SPACECRAFT_ANGULAR_TOLERANCE * Math.hypot(position[0], position[1], position[2]),
            )
        : () => sampling.toleranceKm,
      minStepMinutes: SPACECRAFT_MIN_STEP_MINUTES,
      margin: ESTIMATE_MARGIN,
      samplesPerRequest: MAX_SAMPLES_PER_REQUEST,
    },
  );
  const parts = splitTable(table, SPACECRAFT_CHUNK_SAMPLES);
  console.log(
    `[fetch-data] ${body.name.padEnd(12)} ${String(table.count).padStart(6)} samples, ` +
      `adaptive ${stepSize(body.stepDays)} .. ${result.finestStepMinutes}m to ${sampling.toleranceKm.toFixed(2)} km ` +
      `(${result.requests} requests), ${logDate(table.t[0]!)} .. ${logDate(table.t.at(-1)!)}`,
  );
  return { body, vectors: table, parts, elements, sourceVersion, discontinuities: [] };
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

/** A craft on another body's surface, and what of it the manifest publishes. */
interface SurfaceResult {
  readonly body: BodyDefinition;
  readonly track: SurfaceTrack;
  readonly info: SurfaceInfo;
}

/**
 * A surface craft's stops, from NASA's traverse for a rover or its published site for a
 * lander. See surface.ts.
 *
 * It is drawn from touchdown, or from the window's start. A lander cannot move, so it is
 * known to the window's end; a rover only up to this run, standing where its last
 * reported drive ended. Every stop is kept, those before the window too: they are the
 * way it came, and the app draws that.
 */
async function fetchSurfaceCraft(body: BodyDefinition, epoch: Date): Promise<SurfaceResult | null> {
  const site = body.mission?.site ?? null;
  if (site === null) {
    throw new Error(`${body.id} is a surface craft with no site.`);
  }
  const track =
    site.kind === 'traverse'
      ? traverseTrack(body.id, site, parseTraverse(await fetchTraverse(site.traverseUrl, body.name)))
      : fixedTrack(body.id, site);

  const window = windowFor('full', epoch);
  const startJd = Math.max(track.t[0]!, toJulianDay(window.start));
  const stopJd = toJulianDay(site.kind === 'traverse' ? epoch : window.stop);
  if (stopJd <= startJd) {
    console.log(`[fetch-data] ${body.name}: not on the ground inside the window; left out`);
    return null;
  }
  console.log(
    `[fetch-data] ${body.name.padEnd(9)} ${String(track.count).padStart(5)} stops on ${site.host}, ` +
      `sol ${track.sol.at(-1)}, ${logDate(startJd)} .. ${logDate(stopJd)}`,
  );
  return { body, track, info: { host: site.host, startJd, stopJd, count: track.count } };
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
  /**
   * Every full-window body's: the Sun, the planets, Pluto and the Moon, and the named
   * small bodies -- so a craft at Bennu is held to a kilometre there, not to the
   * hundreds its distance from Earth would allow.
   */
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

  // Three independent services, so they run together. The sky is two requests against
  // VizieR, the belt sixteen against SBDB, about five minutes, and the comets one more;
  // all come back long before Horizons has finished with the planets.
  //
  // The belt is packed page by page as it arrives (see BeltAccumulator), with its mean
  // anomalies moved to the run's own instant: `toJulianDay(epoch)`, the same number every
  // elements query below sends Horizons as its TLIST, which Horizons reads as TDB. So
  // referenceJd is 00:00 TDB of the run's day -- 69 s before UTC midnight, which matters
  // to nothing because the file states it as a TDB Julian day and every anomaly is
  // computed for exactly that number.
  //
  // The stars are the sky and then the 3D stars built on it (stars/fetchStars.ts): thirty-odd
  // TAP queries, about four minutes, each catalogue read from either of two services. The
  // 3D stars share the sky's failure policy rather than the satellites': a record names
  // its stars.json row, so the two are one product.
  //
  // A failure of any of them fails the run, as the stars always have. The deploy publishes a
  // fresh data directory or nothing (deploy.yml: a half-published site is worse than a
  // late one), and a release that silently lost its belt would look like a release with
  // fewer asteroids, not like an outage; the previous deploy stays up instead. SBDB has
  // its own retries first, so this is a fault that outlasted a minute of backoff.
  //
  // Not so the satellites, a fourth service, read alongside. A run that cannot read them
  // publishes without satellites/ -- which the app shows as no satellites, not as fewer --
  // and still succeeds. CelesTrak's usage policy forbids what makes failing the run
  // reasonable for the others: it asks clients to stop at the first non-200 rather than
  // retry, and refuses a group already downloaded from the same address since its last
  // update -- and a CI runner's address is shared, so that refusal can be caused by
  // someone else's download. Failing the deploy on it would be a lottery, and the fix,
  // tomorrow's run, comes by itself. See satellites/celestrak.ts.
  //
  // The Exoplanet Archive, a fifth, follows the stars' policy and not the satellites':
  // one query, four seconds, with tap.ts's retries, and nothing in its terms that makes a
  // retry a lottery. A run that cannot read it fails, and the previous deploy -- with its
  // planets -- stays up. Without it the release would not say "no exoplanets"; it would
  // just show a neighbourhood with only its few hand-read systems in it, the silent
  // shrinking the policy above exists to prevent. Read here, matched against the 3D stars
  // below, once they are built.
  //
  // The pulsars, two more (the ATNF's package and McGill's table), the same way: two
  // downloads of a few seconds, retried, and a run that cannot read them fails rather than
  // publish a galaxy that has quietly lost its neutron stars.
  const [natural, starsRead, beltRead, cometRows, satellites, archive, pulsars] = await Promise.all([
    mapWithConcurrency(
      CATALOG.filter(
        (body) =>
          (body.vectorWindow === 'full' || body.vectorWindow === 'short') &&
          body.sampling === undefined,
      ),
      MAX_CONCURRENT_REQUESTS,
      (body) => fetchBody(body, epoch),
    ),
    loadSky().then(async (sky) => ({ sky, ...(await loadStars3d(sky)) })),
    fetchBelt(
      () =>
        new BeltAccumulator({
          referenceJd: toJulianDay(epoch),
          candidates: catalogDesignations(CATALOG),
          namesBrighterThan: BELT_TIER_LIMITS[0]!,
        }),
      BELT_MAGNITUDE_LIMIT,
    ),
    fetchComets(),
    loadSatellites().catch((error: unknown) => {
      console.error(`[fetch-data] satellites: FAILED, left out of this run (${String(error).slice(0, 300)})`);
      return null;
    }),
    fetchArchive(),
    loadPulsars(),
  ]);

  // The named small bodies next, before the craft: several craft fly to them, and a
  // craft is held to a kilometre only near a body it is measured against. The famous
  // comets with them (famousComets.ts), sampled the same way.
  const smallBodies = await mapWithConcurrency(
    CATALOG.filter((body) => body.sampling !== undefined && !isSmallMoon(body)),
    MAX_CONCURRENT_REQUESTS,
    (body) => fetchAdaptiveBody(body, epoch),
  );
  const sunward = smallBodies.filter((result) => result !== null);

  // The spacecraft after the natural bodies, because their sampling is measured against
  // them: how fine a craft must be followed depends on how far it is from the nearest.
  const frames = referenceFrames([...natural, ...sunward]);
  //
  // A craft Horizons keeps failing on is left out and the run carries on, but the run
  // then ends in failure (see the end of main): everything else is written, so a local
  // run of an hour and a half is not lost to one bad request -- as the run of 2026-10-19
  // was, to Dawn's 5,375th -- while a deploy, which needs every craft, still stops.
  const failedCraft: string[] = [];
  const craft = await mapWithConcurrency(
    CATALOG.filter((body) => body.vectorWindow === 'mission'),
    MAX_CONCURRENT_REQUESTS,
    (body) =>
      fetchSpacecraft(body, epoch, frames).catch((error: unknown) => {
        console.error(
          `[fetch-data] ${body.name}: FAILED, left out of this run (${String(error).slice(0, 300)})`,
        );
        failedCraft.push(body.name);
        return null;
      }),
  );
  // The small moons last: they need nothing of the others, and the requests are spread
  // out rather than doubled up against Horizons.
  //
  // One that Horizons keeps failing on, after every retry, is left out with a line in the
  // log rather than failing the run: four hundred moons are four hundred chances of a
  // bad minute at JPL, and losing the planets' data to one of them would be the worse
  // trade. The major bodies and the craft still fail it.
  //
  // A moon prints nothing when it succeeds, and the phase takes 30 to 60 minutes, so a
  // line every SMALL_MOON_PROGRESS_EVERY moons says the run is alive. Counted as they
  // finish, which with two in flight is near enough the order they were asked in.
  const smallMoonBodies = CATALOG.filter(isSmallMoon);
  let smallMoonsDone = 0;
  let smallMoonsLeftOut = 0;
  const smallMoons = await mapWithConcurrency(
    smallMoonBodies,
    MAX_CONCURRENT_REQUESTS,
    async (body) => {
      let result: BodyResult | null;
      try {
        result = await fetchAdaptiveBody(body, epoch);
      } catch (error) {
        console.log(`[fetch-data] ${body.name}: failed (${String(error).slice(0, 160)}); left out`);
        result = null;
      }
      smallMoonsDone += 1;
      smallMoonsLeftOut += result === null ? 1 : 0;
      if (
        smallMoonsDone % SMALL_MOON_PROGRESS_EVERY === 0 ||
        smallMoonsDone === smallMoonBodies.length
      ) {
        console.log(
          `[fetch-data] small moons ${smallMoonsDone}/${smallMoonBodies.length} ` +
            `(${smallMoonsLeftOut} left out)`,
        );
      }
      return result;
    },
  );
  const results = [
    ...natural,
    ...sunward,
    ...craft.filter((result) => result !== null),
    ...smallMoons.filter((result) => result !== null),
  ];
  const surface = (
    await Promise.all(
      CATALOG.filter((body) => body.vectorWindow === 'surface').map((body) =>
        fetchSurfaceCraft(body, epoch),
      ),
    )
  ).filter((result) => result !== null);
  // What this run publishes: every body that came back. A craft left out above is in
  // neither the catalog nor the manifest, so the app never asks for its table.
  const published = new Set(
    [...results, ...surface].map((result) => result.body.id),
  );
  const catalog = CATALOG.filter((body) => published.has(body.id));

  const stars = starsRead.sky.catalog;
  for (const line of describeSky(stars)) {
    console.log(line.replace('[stars]', '[fetch-data]'));
  }

  // The planets' hosts found among the 3D stars just built, by Gaia id or HIP number.
  const exoplanets = buildExoplanets({ ...archive, stars: starIdsFromBuild(starsRead.stars3d) });
  for (const line of describeExoplanets(exoplanets)) {
    console.log(line.replace('[exoplanets]', '[fetch-data] exoplanets'));
  }
  for (const line of describePulsars(pulsars)) {
    console.log(line.replace('[pulsars]', '[fetch-data] pulsars'));
  }

  // Left out of the belt: the asteroids this run publishes as bodies of their own. A
  // small body Horizons failed on is not drawn, so it stays in the belt rather than vanish.
  const belt = beltRead.sink.finish({
    queriedAt: beltRead.queriedAt,
    excluded: catalogDesignations(catalog),
    tierLimits: BELT_TIER_LIMITS,
  });
  // And the famous comets out of the comet cloud, the same way.
  const comets = buildComets({
    ...cometRows,
    referenceJd: toJulianDay(epoch),
    excluded: cometDesignations(catalog),
  });
  for (const line of [...describeBelt(belt), ...describeComets(comets)]) {
    console.log(line.replace('[belt]', '[fetch-data] belt'));
  }

  // Nothing is written until every body has come back clean, so a mid-run failure
  // cannot leave a half-populated data directory that looks publishable.
  await prepareOutputDir();

  const tables: Record<BodyId, TableInfo> = {};
  for (const result of results) {
    // A spacecraft is always chunked, even when one chunk holds all of it: a whole table
    // is loaded before the first frame, and with forty craft that would be forty files
    // the visitor waits for to see the Sun. A chunk arrives a frame or two after the
    // craft is first wanted, which is all the delay there is.
    if (result.body.vectorWindow === 'full' && result.body.sampling === undefined) {
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
    // The small moons' go into their planet's bundle, below.
    if (result.elements !== null && !isSmallMoon(result.body)) {
      await writeElements(result.elements);
    }
  }

  // The small moons leave the startup files altogether: each planet's ship in one file
  // of their own, with their definitions, elements and table index, and the manifest
  // only counts them. See Manifest.smallMoons.
  const smallMoonCounts: Record<BodyId, SmallMoonCount> = {};
  const smallResults = results.filter((result) => isSmallMoon(result.body));
  for (const planet of new Set(smallResults.map((result) => result.body.parent!))) {
    const mine = smallResults.filter((result) => result.body.parent === planet);
    await writeSmallMoonBundle(planet, {
      bodies: mine.map((result) => result.body),
      elements: Object.fromEntries(mine.map((result) => [result.body.id, result.elements!])),
      tables: Object.fromEntries(mine.map((result) => [result.body.id, tables[result.body.id]!])),
    });
    for (const result of mine) {
      delete tables[result.body.id];
    }
    smallMoonCounts[planet] = {
      count: mine.length,
      sized: mine.filter((result) => result.body.radiusPublished !== false).length,
    };
  }
  const startupCatalog = catalog.filter((body) => !isSmallMoon(body));

  const paths = await writePaths(results, frames);

  const surfaces: Record<BodyId, SurfaceInfo> = {};
  for (const result of surface) {
    await writeSurface(result.track);
    surfaces[result.body.id] = result.info;
  }

  await writeCatalog(startupCatalog);
  await writeStars(stars);
  await writeStars3d(starsRead.stars3d, starsRead.names.names);
  await writeBelt(belt, comets);
  await writeExoplanets(exoplanets);
  await writePulsars(pulsars);
  if (satellites !== null) {
    await writeSatellites(satellites);
  } else {
    console.error('[fetch-data] NO SATELLITES this run: CelesTrak could not be read (see above).');
  }

  // The window every full-window body can answer for: the intersection of their
  // tables, not the range we asked for. Publishing the request instead would claim
  // coverage the widest-stepped bodies do not have, and the app would fall back to
  // propagation without flagging it. The short-window moons are left out, or this
  // would shrink to their two years; their own spans are in `tables`.
  let startJd = -Infinity;
  let stopJd = Infinity;
  // So are the small bodies about the Sun, whose tables are chunked like a craft's.
  for (const result of results.filter(
    (candidate) => candidate.body.vectorWindow === 'full' && candidate.body.sampling === undefined,
  )) {
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
    bodies: startupCatalog.map((body) => body.id),
    tables,
    paths,
    surfaces,
    smallMoons: smallMoonCounts,
  };

  await writeManifest(manifest);

  const samples = results.reduce((total, result) => total + result.vectors.count, 0);
  console.log(
    `[fetch-data] Wrote ${results.length} bodies (${samples} samples) and ` +
      `${stars.count} stars (${starsRead.stars3d.info.count} in 3D), ${belt.info.count} asteroids and ${comets.info.count} comets ` +
      `to ${OUTPUT_DIR}`,
  );
  console.log('[fetch-data] Ephemerides courtesy of NASA/JPL-Caltech.');
  console.log(
    '[fetch-data] Star data from ESA Hipparcos and Tycho-2 and ESA/Gaia/DPAC (Gaia DR3, GCNS); ' +
      'names from the IAU WGSN and the Yale Bright Star Catalogue; via CDS VizieR and the ESA Gaia Archive.',
  );
  console.log("[fetch-data] Asteroid orbits from JPL's Small-Body Database (NASA/JPL-Caltech).");
  console.log(`[fetch-data] ${ARCHIVE_ACKNOWLEDGEMENT}`);
  if (satellites !== null) {
    console.log(`[fetch-data] ${satellites.info.credit}`);
  }

  if (failedCraft.length > 0) {
    console.error(
      `[fetch-data] INCOMPLETE: ${failedCraft.length} spacecraft left out after failing ` +
        `(${failedCraft.join(', ')}). The rest is written and usable locally; this run ` +
        'exits with an error so a deploy does not publish it.',
    );
    process.exitCode = 1;
  }
}

// Run when invoked, not when imported -- a script trying one body imports fetchAdaptiveBody.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
