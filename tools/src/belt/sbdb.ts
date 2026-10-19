import {
  BELT_MAGNITUDE_LIMIT,
  BELT_PAGE_ROWS,
  BELT_READ_ATTEMPTS,
  MAX_RETRIES,
  SBDB_QUERY_API_URL,
  SBDB_REQUEST_TIMEOUT_MS,
} from '../config.ts';
import { retryDelayMs } from '../horizons/client.ts';

/**
 * Reads the asteroid belt out of JPL's Small-Body Database, as osculating elements.
 *
 * The SBDB Query API (https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html) takes a list of
 * fields and a filter and answers with one JSON row per object. Elements, not vectors:
 * an asteroid's whole orbit is nine numbers, so the whole catalogue -- 1,575,460 of them
 * on 2026-10-19 -- is sixteen requests where Horizons would need one per body.
 *
 * What a row means, from the API's own field table:
 *
 *   a      semi-major axis, AU           om   longitude of the ascending node, deg
 *   e      eccentricity                  w    argument of perihelion, deg
 *   i      inclination, deg              ma   mean anomaly at `epoch`, deg
 *   epoch  epoch of osculation, JD TDB   n    mean motion, deg/day
 *   H      absolute magnitude            class  SBDB orbit class code
 *
 * Heliocentric, in "the heliocentric IAU76/80 ecliptic reference system" of the equinox
 * named in `equinox` -- J2000 for every row, which is checked rather than assumed. That
 * is the plane every Horizons table here is in (REF_PLANE='ECLIPTIC', whose obliquity is
 * the same IAU 1976 value), so a belt asteroid and a named body share one frame.
 *
 * `full-prec=true` is not optional. Without it the API rounds for display, measured on
 * Ceres 2026-10-19: a to 2.766 AU and the mean anomaly to 274.42 deg -- a semi-major axis
 * up to 75,000 km off and a place along the orbit up to 36,000 km off, before any
 * propagation at all.
 *
 * Retries follow the Horizons client's backoff, imported rather than copied, for the
 * same reason the star reader does: jittered, so runners sharing an address do not
 * retry in lockstep.
 */

/** The fields asked for, in the order the API is asked for them. */
export const SBDB_FIELDS = [
  'spkid',
  'pdes',
  'full_name',
  'name',
  'a',
  'e',
  'i',
  'om',
  'w',
  'ma',
  'epoch',
  'n',
  'H',
  'class',
  'equinox',
] as const;

/** One asteroid as SBDB returned it, with nothing resolved yet. Null where SBDB has none. */
export interface SbdbRow {
  /** JPL's SPK-ID, e.g. 20000001 for Ceres: unique, so it orders ties. */
  readonly spkid: number;
  /** Primary designation: the IAU number when numbered ('1', '134340'), else '2002 PD153'. */
  readonly designation: string;
  /** SBDB's full name, padded as it sends it: "   433 Eros (A898 PA)", "       (2024 YR4)". */
  readonly fullName: string | null;
  /** The IAU name, when it has one: "Eros". */
  readonly name: string | null;
  readonly aAu: number | null;
  readonly e: number | null;
  readonly iDeg: number | null;
  readonly nodeDeg: number | null;
  readonly periDeg: number | null;
  readonly meanAnomalyDeg: number | null;
  /** Epoch of osculation, Julian day TDB. */
  readonly epochJd: number | null;
  readonly meanMotionDegPerDay: number | null;
  readonly h: number | null;
  readonly orbitClass: string | null;
  readonly equinox: string | null;
}

/** One page of the API's answer: its rows, and how many objects the whole query matches. */
export interface SbdbPage {
  readonly count: number;
  readonly rows: SbdbRow[];
}

/**
 * The query for one page of the belt: every asteroid brighter than `magnitudeLimit`, or
 * every asteroid at all when it is null -- including the few hundred SBDB has no H for,
 * which a magnitude filter would silently leave out rather than count.
 *
 * Sorted by SPK-ID, which is unique, so `limit-from` pages through a fixed order; sorting
 * by H alone would leave the order of equal magnitudes to the database, and a page
 * boundary inside a run of equal H could repeat one row and skip another. The belt is
 * put in H order here, after it has all arrived.
 */
export function beltQuery(
  magnitudeLimit: number | null,
  from: number,
  pageRows: number,
): Record<string, string> {
  return {
    fields: SBDB_FIELDS.join(','),
    'sb-kind': 'a',
    ...(magnitudeLimit === null
      ? {}
      : { 'sb-cdata': JSON.stringify({ AND: [`H|LT|${magnitudeLimit}`] }) }),
    sort: 'spkid',
    limit: String(pageRows),
    'limit-from': String(from),
    'full-prec': 'true',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * A numeric field. SBDB sends numbers as strings ("2.765552595034094", ".0796") and
 * a missing value as null; anything else is not a number and fails loudly rather than
 * becoming a zero, which would be a real place.
 */
export function numberOrNull(raw: unknown, field: string, label: string): number | null {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const value = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(value)) {
    throw new Error(`SBDB ${label}: field "${field}" is not a number: ${JSON.stringify(raw)}`);
  }
  return value;
}

export function stringOrNull(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  return String(raw);
}

/** An SBDB answer's rows, with each column found by its name. */
export interface SbdbTable {
  readonly count: number;
  readonly rows: readonly (readonly unknown[])[];
  at(row: readonly unknown[], field: string): unknown;
}

/**
 * Reads the envelope of one SBDB Query API response: its count, its rows, and where each
 * of the `required` fields is.
 *
 * Columns are read by the names in `fields`, never by position: the API echoes the
 * field list, and a row read against the wrong column would put every asteroid's
 * inclination on its node without anything looking wrong.
 */
export function readSbdbTable(body: unknown, required: readonly string[]): SbdbTable {
  if (!isRecord(body)) {
    throw new Error('SBDB response is not a JSON object.');
  }
  const fields = body['fields'];
  const data = body['data'];
  const count = Number(body['count']);
  if (!Array.isArray(fields) || !Number.isInteger(count)) {
    throw new Error(
      `SBDB response has no field list or count: ${JSON.stringify(body).slice(0, 300)}`,
    );
  }
  // A query that matches nothing comes back with a count of 0 and no `data` at all.
  if (data !== undefined && !Array.isArray(data)) {
    throw new Error('SBDB response `data` is not a list.');
  }
  const index = new Map(fields.map((name, position) => [String(name), position]));
  for (const field of required) {
    if (!index.has(field)) {
      throw new Error(`SBDB response has no field "${field}". Got: ${fields.join(', ')}`);
    }
  }
  const rows = (data ?? []) as unknown[];
  for (const [position, row] of rows.entries()) {
    if (!Array.isArray(row)) {
      throw new Error(`SBDB row ${position} is not a list.`);
    }
  }
  return {
    count,
    rows: rows as unknown[][],
    at: (row, field) => row[index.get(field) as number],
  };
}

/** Parses one page of the belt query. */
export function parseSbdbResponse(body: unknown): SbdbPage {
  const table = readSbdbTable(body, SBDB_FIELDS);
  const rows = table.rows.map((raw, position): SbdbRow => {
    const designation = stringOrNull(table.at(raw, 'pdes'));
    const spkid = numberOrNull(table.at(raw, 'spkid'), 'spkid', `row ${position}`);
    if (designation === null || spkid === null) {
      throw new Error(`SBDB row ${position} has no designation or SPK-ID.`);
    }
    const number = (field: (typeof SBDB_FIELDS)[number]) =>
      numberOrNull(table.at(raw, field), field, designation);
    return {
      spkid,
      designation,
      fullName: stringOrNull(table.at(raw, 'full_name')),
      name: stringOrNull(table.at(raw, 'name')),
      aAu: number('a'),
      e: number('e'),
      iDeg: number('i'),
      nodeDeg: number('om'),
      periDeg: number('w'),
      meanAnomalyDeg: number('ma'),
      epochJd: number('epoch'),
      meanMotionDegPerDay: number('n'),
      h: number('H'),
      orbitClass: stringOrNull(table.at(raw, 'class')),
      equinox: stringOrNull(table.at(raw, 'equinox')),
    };
  });

  return { count: table.count, rows };
}

function delay(ms: number): Promise<void> {
  return new Promise((done) => {
    setTimeout(done, ms);
  });
}

/** Statuses worth another attempt: rate limiting and transient server faults. */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

/** Marks an error as not worth retrying, so a bad query fails in one round trip. */
function permanent(message: string): Error {
  return Object.assign(new Error(message), { permanent: true });
}

function isPermanent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'permanent' in error &&
    (error as { permanent: unknown }).permanent === true
  );
}

/** Runs one SBDB query, with retries and backoff, and returns it as `parse` reads it. */
export async function querySbdb<T>(
  params: Readonly<Record<string, string>>,
  label: string,
  parse: (body: unknown) => T,
): Promise<T> {
  const url = new URL(SBDB_QUERY_API_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      let response: Response;
      try {
        response = await fetch(url, {
          signal: AbortSignal.timeout(SBDB_REQUEST_TIMEOUT_MS),
          headers: { accept: 'application/json' },
        });
      } catch (cause) {
        // Network failures and timeouts are always worth retrying.
        throw new Error(`Request to SBDB failed: ${String(cause)}`);
      }

      if (RETRYABLE_STATUSES.has(response.status)) {
        throw new Error(`SBDB returned HTTP ${response.status}`);
      }

      const text = await response.text();

      if (!response.ok) {
        // A 400 carries the API's explanation -- a misspelt field, a bad constraint.
        throw permanent(
          `SBDB rejected the ${label} query (HTTP ${response.status}): ${text.slice(0, 400)}`,
        );
      }

      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        // A truncated body: the connection dropped part way through a 16 MB answer.
        throw new Error(`SBDB returned ${text.length} bytes that are not JSON.`);
      }
      return parse(body);
    } catch (error) {
      lastError = error;
      if (isPermanent(error) || attempt === MAX_RETRIES) {
        break;
      }
      const wait = retryDelayMs(attempt, null);
      console.warn(
        `[belt] ${label}: attempt ${attempt}/${MAX_RETRIES} failed (${String(error)}). ` +
          `Retrying in ${(wait / 1000).toFixed(1)} s.`,
      );
      await delay(wait);
    }
  }

  throw new Error(`Could not read ${label} from SBDB: ${String(lastError)}`);
}

/** Where the pages go as they arrive: the belt is packed page by page, never held as rows. */
export interface BeltSink {
  add(rows: readonly SbdbRow[]): void;
}

/** A whole read of the belt: the sink that took every page, and when it was asked. */
export interface BeltRead<T extends BeltSink> {
  readonly sink: T;
  readonly count: number;
  readonly queriedAt: string;
}

/** A query's limit, for a log line. */
function describeLimit(magnitudeLimit: number | null): string {
  return magnitudeLimit === null ? 'whole catalogue' : `H < ${magnitudeLimit}`;
}

/**
 * Every asteroid in SBDB, or every one brighter than `magnitudeLimit`, paged `pageRows`
 * at a time and handed to a sink page by page.
 *
 * Page by page because the whole catalogue is 1.58 million rows: as parsed objects that
 * is the better part of a gigabyte, where packed it is 57 MB. Each page is parsed,
 * handed over and let go.
 *
 * Each page says how many objects the whole query matches, and every page must say the
 * same: SBDB is updated continuously -- the MPC's daily batches of new designations among
 * it -- and a count that changes between pages means rows moved underneath the paging, so
 * the set read would be neither the old catalogue nor the new one. The read then starts
 * over with a fresh sink from `start`, up to BELT_READ_ATTEMPTS times; sixteen pages take
 * about five minutes, so a change landing inside one read is possible but two in a row
 * would be a database that is not settling, and the run fails rather than publish it.
 *
 * The total read must equal the count, and no SPK-ID may appear twice -- the two ways a
 * silently short or doubled belt would otherwise look like a rendering bug.
 */
export async function fetchBelt<T extends BeltSink>(
  start: () => T,
  magnitudeLimit: number | null = BELT_MAGNITUDE_LIMIT,
  pageRows = BELT_PAGE_ROWS,
): Promise<BeltRead<T>> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= BELT_READ_ATTEMPTS; attempt += 1) {
    try {
      return await readOnce(start(), magnitudeLimit, pageRows);
    } catch (error) {
      if (!(error instanceof CountChangedError)) {
        throw error;
      }
      lastError = error;
      console.warn(`[belt] ${error.message} Reading it again (${attempt}/${BELT_READ_ATTEMPTS}).`);
    }
  }
  throw new Error(`Could not read a settled belt from SBDB: ${String(lastError)}`);
}

/** SBDB changed between two pages of one read: worth starting the read over. */
class CountChangedError extends Error {}

async function readOnce<T extends BeltSink>(
  sink: T,
  magnitudeLimit: number | null,
  pageRows: number,
): Promise<BeltRead<T>> {
  const queriedAt = new Date().toISOString();
  let read = 0;
  let expected: number | null = null;
  // Every SPK-ID read, to look for one twice at the end: 13 MB for the whole catalogue,
  // where a Set of the same numbers is several times that.
  let spkids = new Float64Array(0);

  do {
    const page = await querySbdb(
      beltQuery(magnitudeLimit, read, pageRows),
      `belt (${describeLimit(magnitudeLimit)}), from row ${read}`,
      parseSbdbResponse,
    );
    if (expected !== null && page.count !== expected) {
      throw new CountChangedError(
        `SBDB's count changed while the belt was being paged (${expected} then ${page.count}).`,
      );
    }
    if (expected === null) {
      expected = page.count;
      spkids = new Float64Array(expected);
    }
    if (page.rows.length === 0 && read < expected) {
      throw new Error(`SBDB returned an empty page at row ${read} of ${expected}.`);
    }
    if (read + page.rows.length > expected) {
      throw new Error(`SBDB returned more belt rows than the ${expected} it counted.`);
    }
    for (const row of page.rows) {
      spkids[read] = row.spkid;
      read += 1;
    }
    sink.add(page.rows);
    if (expected > pageRows) {
      console.log(`[belt] ${read}/${expected} rows from SBDB`);
    }
  } while (read < expected);

  if (expected === 0) {
    throw new Error(`SBDB matched no asteroids (${describeLimit(magnitudeLimit)}).`);
  }
  if (read !== expected) {
    throw new Error(`SBDB returned ${read} belt rows where it counted ${expected}.`);
  }
  spkids.sort();
  for (let index = 1; index < spkids.length; index += 1) {
    if (spkids[index] === spkids[index - 1]) {
      throw new Error(`SBDB returned SPK-ID ${spkids[index]} twice across pages.`);
    }
  }
  return { sink, count: expected, queriedAt };
}
