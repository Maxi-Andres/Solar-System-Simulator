import {
  HIPPARCOS_TABLE,
  MAX_RETRIES,
  REQUEST_TIMEOUT_MS,
  STAR_MAGNITUDE_LIMIT,
  VIZIER_TAP_URL,
} from '../config.ts';
import { retryDelayMs } from '../horizons/client.ts';

/**
 * Reads the Hipparcos catalogue out of VizieR.
 *
 * VizieR is the CDS Strasbourg mirror of the published astronomical catalogues, and it
 * speaks TAP -- the IVOA's query protocol -- so the request below is ADQL over HTTP and
 * the answer is CSV. No key, no client library, no scraping.
 *
 * The query asks for exactly the columns the renderer needs and nothing else, which is
 * what keeps a 118,218-star catalogue to about a megabyte on the wire.
 *
 * Retries follow the same backoff policy as the Horizons client, imported rather than
 * copied: the reasoning about jitter and shared CI outbound addresses applies here
 * unchanged.
 */

/** One row of the query, with nulls left as null rather than coerced to zero. */
export interface HipparcosRow {
  readonly hip: number;
  /** ICRS position at J1991.25, degrees. Null for the few stars with no ICRS solution. */
  readonly raIcrsDeg: number | null;
  readonly decIcrsDeg: number | null;
  /** The original J2000 sexagesimal position, which every row has. */
  readonly raHms: string | null;
  readonly decDms: string | null;
  readonly vMag: number;
  readonly colorIndex: number | null;
  /** Proper motion in RA, already times cos(dec), mas/yr. */
  readonly pmRaMasPerYear: number | null;
  readonly pmDecMasPerYear: number | null;
}

/** The columns asked for. Names are Hipparcos's own, quoted where ADQL needs it. */
const COLUMNS = ['HIP', 'RAICRS', 'DEICRS', 'RAhms', 'DEdms', 'Vmag', 'B-V', 'pmRA', 'pmDE'];

const PLAIN_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * Upper bound on rows, used to detect truncation rather than to limit the result.
 *
 * TAP services cut a result at their own default -- often 2,000 rows -- and say so only
 * in a header nobody reads. A silently short sky is the kind of failure that looks like
 * a rendering bug for a week, so we ask for far more than the catalogue holds and then
 * check we did not reach the ceiling.
 */
const MAX_ROWS = 200_000;

export function hipparcosQuery(magnitudeLimit: number): string {
  const selected = COLUMNS.map((column) =>
    PLAIN_IDENTIFIER.test(column) ? column : `"${column}"`,
  ).join(', ');
  return `SELECT ${selected} FROM "${HIPPARCOS_TABLE}" WHERE Vmag <= ${magnitudeLimit}`;
}

/**
 * Splits one CSV line, honouring the quotes VizieR puts around the sexagesimal columns.
 *
 * Small on purpose: this is CSV as the TAP standard emits it, not CSV in general, and a
 * dependency for nine columns would be the wrong trade.
 */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"') {
        if (line[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      fields.push(field.trim());
      field = '';
    } else {
      field += character;
    }
  }

  fields.push(field.trim());
  return fields;
}

function optionalNumber(raw: string | undefined, column: string, hip: string): number | null {
  if (raw === undefined || raw === '') {
    return null;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Star ${hip}: column "${column}" is not a number: "${raw}"`);
  }
  return value;
}

/** Turns the CSV body into rows, checking the header rather than trusting the order. */
export function parseHipparcosCsv(csv: string): HipparcosRow[] {
  const lines = csv.split('\n').filter((line) => line.trim().length > 0);
  const header = lines[0];
  if (header === undefined) {
    throw new Error('VizieR returned an empty response.');
  }

  const names = splitCsvLine(header);
  const index = new Map(names.map((name, position) => [name, position]));
  for (const column of COLUMNS) {
    if (!index.has(column)) {
      throw new Error(
        `VizieR response has no column "${column}". Got: ${names.join(', ')}\n` +
          `First line of the body: ${lines[1] ?? '(none)'}`,
      );
    }
  }

  const at = (fields: readonly string[], column: string): string | undefined =>
    fields[index.get(column) as number];

  return lines.slice(1).map((line) => {
    const fields = splitCsvLine(line);
    const hip = at(fields, 'HIP') ?? '?';
    const vMag = optionalNumber(at(fields, 'Vmag'), 'Vmag', hip);
    if (vMag === null) {
      throw new Error(`Star ${hip} has no V magnitude, which the query filtered on.`);
    }
    const raHms = at(fields, 'RAhms') ?? '';
    const decDms = at(fields, 'DEdms') ?? '';
    return {
      hip: Number(hip),
      raIcrsDeg: optionalNumber(at(fields, 'RAICRS'), 'RAICRS', hip),
      decIcrsDeg: optionalNumber(at(fields, 'DEICRS'), 'DEICRS', hip),
      raHms: raHms === '' ? null : raHms,
      decDms: decDms === '' ? null : decDms,
      vMag,
      colorIndex: optionalNumber(at(fields, 'B-V'), 'B-V', hip),
      pmRaMasPerYear: optionalNumber(at(fields, 'pmRA'), 'pmRA', hip),
      pmDecMasPerYear: optionalNumber(at(fields, 'pmDE'), 'pmDE', hip),
    };
  });
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

/** Runs the query against VizieR and returns the parsed rows. */
export async function fetchHipparcos(
  magnitudeLimit = STAR_MAGNITUDE_LIMIT,
): Promise<HipparcosRow[]> {
  const url = new URL(VIZIER_TAP_URL);
  url.searchParams.set('REQUEST', 'doQuery');
  url.searchParams.set('LANG', 'ADQL');
  url.searchParams.set('FORMAT', 'csv');
  url.searchParams.set('MAXREC', String(MAX_ROWS));
  url.searchParams.set('QUERY', hipparcosQuery(magnitudeLimit));

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { accept: 'text/csv' },
      });

      if (RETRYABLE_STATUSES.has(response.status)) {
        throw new Error(`VizieR returned HTTP ${response.status}`);
      }

      const body = await response.text();

      if (!response.ok) {
        // A rejected ADQL query comes back as a VOTable error document, and its first
        // few hundred characters are the actual explanation.
        throw permanent(
          `VizieR rejected the query (HTTP ${response.status}): ${body.slice(0, 400)}`,
        );
      }

      const rows = parseHipparcosCsv(body);
      if (rows.length === 0) {
        throw new Error('VizieR returned no stars.');
      }
      if (rows.length >= MAX_ROWS) {
        throw permanent(
          `VizieR returned ${rows.length} rows, the requested maximum, so the result was ` +
            'truncated. Raise MAX_ROWS in vizier.ts.',
        );
      }
      return rows;
    } catch (error) {
      lastError = error;
      if (isPermanent(error) || attempt === MAX_RETRIES) {
        break;
      }
      const wait = retryDelayMs(attempt, null);
      console.warn(
        `[stars] attempt ${attempt}/${MAX_RETRIES} failed (${String(error)}). ` +
          `Retrying in ${(wait / 1000).toFixed(1)} s.`,
      );
      await delay(wait);
    }
  }

  throw new Error(`Could not read Hipparcos from VizieR: ${String(lastError)}`);
}
