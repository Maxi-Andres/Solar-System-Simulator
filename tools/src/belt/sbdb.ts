import {
  BELT_MAGNITUDE_LIMIT,
  BELT_PAGE_ROWS,
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
 * an asteroid's whole orbit is nine numbers, so 83,841 of them are one request where
 * Horizons would need one per body.
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

/** Everything SBDB returned for the belt, and when it was asked. */
export interface SbdbBelt {
  readonly rows: readonly SbdbRow[];
  readonly queriedAt: string;
}

/**
 * The query for one page of the belt: every asteroid brighter than `magnitudeLimit`.
 *
 * Sorted by SPK-ID, which is unique, so `limit-from` pages through a fixed order; sorting
 * by H alone would leave the order of equal magnitudes to the database, and a page
 * boundary inside a run of equal H could repeat one row and skip another. The belt is
 * put in H order here, after it has all arrived.
 */
export function beltQuery(
  magnitudeLimit: number,
  from: number,
  pageRows: number,
): Record<string, string> {
  return {
    fields: SBDB_FIELDS.join(','),
    'sb-kind': 'a',
    'sb-cdata': JSON.stringify({ AND: [`H|LT|${magnitudeLimit}`] }),
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
function numberOrNull(raw: unknown, field: string, label: string): number | null {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const value = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(value)) {
    throw new Error(`SBDB ${label}: field "${field}" is not a number: ${JSON.stringify(raw)}`);
  }
  return value;
}

function stringOrNull(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  return String(raw);
}

/**
 * Parses one SBDB Query API response.
 *
 * Columns are read by the names in `fields`, never by position: the API echoes the
 * field list, and a row read against the wrong column would put every asteroid's
 * inclination on its node without anything looking wrong.
 */
export function parseSbdbResponse(body: unknown): SbdbPage {
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
  for (const field of SBDB_FIELDS) {
    if (!index.has(field)) {
      throw new Error(`SBDB response has no field "${field}". Got: ${fields.join(', ')}`);
    }
  }
  const at = (row: readonly unknown[], field: (typeof SBDB_FIELDS)[number]): unknown =>
    row[index.get(field) as number];

  const rows = ((data ?? []) as unknown[]).map((raw, position): SbdbRow => {
    if (!Array.isArray(raw)) {
      throw new Error(`SBDB row ${position} is not a list.`);
    }
    const designation = stringOrNull(at(raw, 'pdes'));
    const spkid = numberOrNull(at(raw, 'spkid'), 'spkid', `row ${position}`);
    if (designation === null || spkid === null) {
      throw new Error(`SBDB row ${position} has no designation or SPK-ID.`);
    }
    const number = (field: (typeof SBDB_FIELDS)[number]) =>
      numberOrNull(at(raw, field), field, designation);
    return {
      spkid,
      designation,
      aAu: number('a'),
      e: number('e'),
      iDeg: number('i'),
      nodeDeg: number('om'),
      periDeg: number('w'),
      meanAnomalyDeg: number('ma'),
      epochJd: number('epoch'),
      meanMotionDegPerDay: number('n'),
      h: number('H'),
      orbitClass: stringOrNull(at(raw, 'class')),
      equinox: stringOrNull(at(raw, 'equinox')),
    };
  });

  return { count, rows };
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

/** Runs one SBDB query, with retries and backoff, and returns the parsed page. */
export async function querySbdb(
  params: Readonly<Record<string, string>>,
  label: string,
): Promise<SbdbPage> {
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
      return parseSbdbResponse(body);
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

/**
 * Every asteroid brighter than `magnitudeLimit`, paged `pageRows` at a time.
 *
 * Each page says how many objects the whole query matches, and every page must say the
 * same: SBDB is updated continuously, and a count that changes between pages means rows
 * moved underneath the paging, so the set read would be neither the old belt nor the
 * new one. That fails the read rather than publishing it; the next run starts over.
 * The total read must equal the count, and no SPK-ID may appear twice -- the two ways a
 * silently short or doubled belt would otherwise look like a rendering bug.
 */
export async function fetchBeltRows(
  magnitudeLimit = BELT_MAGNITUDE_LIMIT,
  pageRows = BELT_PAGE_ROWS,
): Promise<SbdbBelt> {
  const queriedAt = new Date().toISOString();
  const rows: SbdbRow[] = [];
  let expected: number | null = null;

  do {
    const page = await querySbdb(
      beltQuery(magnitudeLimit, rows.length, pageRows),
      `belt H < ${magnitudeLimit}, from row ${rows.length}`,
    );
    if (expected !== null && page.count !== expected) {
      throw new Error(
        `SBDB's count changed while the belt was being paged (${expected} then ${page.count}).`,
      );
    }
    expected = page.count;
    if (page.rows.length === 0 && rows.length < expected) {
      throw new Error(`SBDB returned an empty page at row ${rows.length} of ${expected}.`);
    }
    rows.push(...page.rows);
  } while (rows.length < expected);

  if (rows.length !== expected) {
    throw new Error(`SBDB returned ${rows.length} belt rows where it counted ${expected}.`);
  }
  if (new Set(rows.map((row) => row.spkid)).size !== rows.length) {
    throw new Error('SBDB returned the same asteroid twice across pages.');
  }
  if (expected === 0) {
    throw new Error(`SBDB matched no asteroids brighter than H = ${magnitudeLimit}.`);
  }
  return { rows, queriedAt };
}
