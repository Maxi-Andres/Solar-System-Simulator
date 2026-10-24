import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { MAX_RETRIES, REQUEST_TIMEOUT_MS } from '../config.ts';
import { retryDelayMs } from '../horizons/client.ts';

/**
 * A client for the IVOA Table Access Protocol, for the two services the stars are read
 * from: VizieR at CDS Strasbourg and the ESA Gaia Archive at ESAC.
 *
 * Both speak the same protocol -- ADQL over HTTP, answers as CSV -- and between them they
 * mirror every table the stars need. That is the point of having two: VizieR's TAP
 * service answered 503 for the whole of 2026-10-16 and again on 2026-10-22, while the
 * Gaia Archive was up, and a sky that depends on one service is down whenever it is. So
 * every read here names its tables on both, and falls back from one to the other.
 *
 * POST rather than GET, because a query naming a source-id range or a list of columns
 * with aliases is longer than some proxies let a URL be. Retries follow the Horizons
 * client's backoff, imported rather than copied.
 */

export interface TapService {
  /** For logs and for the output's `via`: "VizieR (CDS)", "ESA Gaia Archive". */
  readonly name: string;
  /** The synchronous endpoint. */
  readonly url: string;
}

/**
 * Upper bound on rows, used to detect truncation rather than to limit the result.
 *
 * TAP services cut a result at their own default -- 2,000 rows is common -- and say so
 * only in a header nobody reads. A silently short catalogue is the kind of failure that
 * looks like a rendering bug for a week, so every query asks for far more than it can
 * return and is then checked against the ceiling.
 */
export const TAP_MAX_ROWS = 400_000;

/**
 * Splits one CSV line, honouring the quotes both services put around text fields.
 *
 * Small on purpose: this is CSV as the TAP standard emits it, not CSV in general, and a
 * dependency for it would be the wrong trade.
 */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoting = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoting) {
      if (character === '"') {
        if (line[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoting = false;
        }
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoting = true;
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

/** A CSV body as rows keyed by column name, with the header checked rather than trusted. */
export interface CsvTable {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
  at(row: readonly string[], column: string): string | undefined;
  has(column: string): boolean;
}

export function parseCsvTable(csv: string, required: readonly string[]): CsvTable {
  const lines = csv.split('\n').filter((line) => line.trim().length > 0);
  const header = lines[0];
  if (header === undefined) {
    throw new Error('The TAP service returned an empty response.');
  }

  const columns = splitCsvLine(header);
  const index = new Map(columns.map((name, position) => [name, position]));
  for (const column of required) {
    if (!index.has(column)) {
      throw new Error(
        `TAP response has no column "${column}". Got: ${columns.join(', ')}\n` +
          `First line of the body: ${lines[1] ?? '(none)'}`,
      );
    }
  }

  return {
    columns,
    rows: lines.slice(1).map(splitCsvLine),
    at: (row, column) => {
      const position = index.get(column);
      return position === undefined ? undefined : row[position];
    },
    has: (column) => index.has(column),
  };
}

/** A number, or null for an empty field; anything else is a misread and throws. */
export function optionalNumber(
  raw: string | undefined,
  column: string,
  label: string,
): number | null {
  if (raw === undefined || raw === '') {
    return null;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${label}: column "${column}" is not a number: "${raw}"`);
  }
  return value;
}

/** Text, or null for an empty or absent field. */
export function optionalText(raw: string | undefined): string | null {
  return raw === undefined || raw === '' ? null : raw;
}

function delay(ms: number): Promise<void> {
  return new Promise((done) => {
    setTimeout(done, ms);
  });
}

/**
 * Statuses worth another attempt: rate limiting, transient server faults, and the Gaia
 * Archive's 408, which is how it reports a synchronous job that outran its minute -- a
 * query that is usually quick when the archive is not busy.
 */
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

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

let cacheDirectory: string | null = null;

/**
 * Keeps every answer in `directory`, keyed by service and query, and answers from there
 * when the same query is asked again. For iterating on the build without asking the
 * services the same thing twenty times (`pnpm fetch:stars --cache <dir>`); never set by
 * fetch:data, whose answers must be today's.
 */
export function useTapCache(directory: string | null): void {
  cacheDirectory = directory;
}

/** Runs one ADQL query and returns the CSV body. Retries, then throws. */
export async function queryTap(
  service: TapService,
  adql: string,
  label: string,
  attempts = MAX_RETRIES,
): Promise<string> {
  if (cacheDirectory !== null) {
    const key = createHash('sha256').update(`${service.url} ${adql}`).digest('hex').slice(0, 32);
    const path = join(cacheDirectory, `${key}.csv`);
    try {
      return await readFile(path, 'utf8');
    } catch {
      const text = await queryTapUncached(service, adql, label, attempts);
      await mkdir(cacheDirectory, { recursive: true });
      await writeFile(path, text, 'utf8');
      return text;
    }
  }
  return queryTapUncached(service, adql, label, attempts);
}

async function queryTapUncached(
  service: TapService,
  adql: string,
  label: string,
  attempts: number,
): Promise<string> {
  const body = new URLSearchParams({
    REQUEST: 'doQuery',
    LANG: 'ADQL',
    FORMAT: 'csv',
    MAXREC: String(TAP_MAX_ROWS),
    QUERY: adql,
  });

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(service.url, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { accept: 'text/csv' },
      });

      if (RETRYABLE_STATUSES.has(response.status)) {
        throw new Error(`${service.name} returned HTTP ${response.status}`);
      }

      const text = await response.text();

      if (!response.ok) {
        // A rejected ADQL query comes back as a VOTable error document, and its first
        // few hundred characters are the actual explanation.
        throw permanent(
          `${service.name} rejected the ${label} query (HTTP ${response.status}): ` +
            text.slice(0, 400),
        );
      }
      if (text.trimStart().startsWith('<')) {
        // An error document served with 200, which both services have been seen to do
        // under load. Not CSV, so not an empty result either.
        throw new Error(`${service.name} answered the ${label} query with: ${text.slice(0, 300)}`);
      }

      const rows = text.split('\n').filter((line) => line.trim().length > 0).length - 1;
      if (rows >= TAP_MAX_ROWS) {
        throw permanent(
          `The ${label} query returned ${rows} rows, the requested maximum, so the result ` +
            'was truncated. Split it into more pages, or raise TAP_MAX_ROWS in tap.ts.',
        );
      }
      return text;
    } catch (error) {
      lastError = error;
      if (isPermanent(error) || attempt === attempts) {
        break;
      }
      const wait = retryDelayMs(attempt, null);
      console.warn(
        `[stars] ${label} on ${service.name}: attempt ${attempt}/${attempts} failed ` +
          `(${String(error).slice(0, 200)}). Retrying in ${(wait / 1000).toFixed(1)} s.`,
      );
      await delay(wait);
    }
  }

  throw new Error(`Could not read ${label} from ${service.name}: ${String(lastError)}`);
}

/** One way of reading a dataset: a service, and the queries that read all of it there. */
export interface TapRoute<T> {
  readonly service: TapService;
  /** The table as it is named on this service, for the output's `sources`. */
  readonly table: string;
  /** One query per page; each page is read, retried and parsed on its own. */
  readonly pages: readonly string[];
  readonly parse: (csv: string) => T[];
}

export interface TapRead<T> {
  readonly rows: T[];
  readonly service: TapService;
  readonly table: string;
}

/**
 * Reads a dataset through the first route that delivers all of it.
 *
 * All or nothing per route: a dataset read half on one service and half on the other
 * would be two versions of a catalogue stitched together, which the two mirrors are not
 * guaranteed to agree on. So a page that fails after its retries abandons the route, and
 * the next route starts over from its first page.
 *
 * Pages are parsed as they arrive and their text dropped, so only one page's CSV is ever
 * held at once -- what keeps 331,000 rows of the nearby-stars catalogue to a few tens of
 * megabytes rather than the whole response as one string.
 */
export async function readWithFallback<T>(
  routes: readonly TapRoute<T>[],
  label: string,
): Promise<TapRead<T>> {
  const failures: string[] = [];
  for (const route of routes) {
    try {
      const rows: T[] = [];
      for (const [index, page] of route.pages.entries()) {
        const pageLabel = route.pages.length > 1 ? `${label} page ${index + 1}/${route.pages.length}` : label;
        const csv = await queryTap(route.service, page, pageLabel);
        for (const row of route.parse(csv)) {
          rows.push(row);
        }
      }
      return { rows, service: route.service, table: route.table };
    } catch (error) {
      failures.push(String(error).slice(0, 300));
      console.warn(`[stars] ${label}: ${route.service.name} failed, ${routes.length > 1 ? 'trying the next mirror' : 'no mirror left'}.`);
    }
  }
  throw new Error(`Could not read ${label} from any mirror:\n  ${failures.join('\n  ')}`);
}

/**
 * Splits a Gaia source_id range into pages by the HEALPix pixel the id encodes.
 *
 * A Gaia source_id carries its level-12 HEALPix index in its top bits: index =
 * source_id / 2^35 (Gaia DR3 documentation, the source_id datamodel). Level 12 has
 * 12 × 4^12 pixels, so each of the 12 base pixels of level 0 is a contiguous id range
 * of 2^59. Paging by those ranges cuts the sky into twelve equal-area pieces -- equal
 * rows, roughly, for an all-sky sample -- with no row in two pages and none in neither.
 *
 * `splits` cuts every base pixel further, into 4^k level-k pieces, for a query that needs
 * smaller pages.
 */
export function gaiaSourceIdPages(column: string, splits = 0): string[] {
  const perBase = 4 ** splits;
  const width = (1n << 59n) / BigInt(perBase);
  const pages: string[] = [];
  for (let index = 0; index < 12 * perBase; index += 1) {
    const low = BigInt(index) * width;
    const high = low + width;
    pages.push(`${column} >= ${low} AND ${column} < ${high}`);
  }
  return pages;
}
