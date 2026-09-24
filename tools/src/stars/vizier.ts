import {
  HIPPARCOS_TABLE,
  MAX_RETRIES,
  REQUEST_TIMEOUT_MS,
  STAR_MAGNITUDE_LIMIT,
  TYCHO2_TABLE,
  TYCHO_BV_FROM_BT_VT,
  TYCHO_V_FROM_VT,
  VIZIER_TAP_URL,
} from '../config.ts';
import { retryDelayMs } from '../horizons/client.ts';

/**
 * Reads the two star catalogues out of VizieR.
 *
 * VizieR is the CDS Strasbourg mirror of the published astronomical catalogues, and it
 * speaks TAP -- the IVOA's query protocol -- so the requests below are ADQL over HTTP
 * and the answers are CSV. No key, no client library, no scraping.
 *
 * **Two catalogues, because neither one is a sky on its own.** Hipparcos is complete at
 * the bright end and thins out past magnitude 7.5; Tycho-2 goes to magnitude 11 and is
 * *missing the brightest stars entirely* -- its star mapper saturated on them, so Sirius,
 * Vega and Betelgeuse are simply not in it. Both facts are measured rather than taken on
 * faith; see `config.ts` for the numbers. The union is what a sky needs.
 *
 * Retries follow the same backoff policy as the Horizons client, imported rather than
 * copied: the reasoning about jitter and shared CI outbound addresses applies unchanged.
 */

/** One star as read, before either catalogue's quirks are resolved. */
export interface CatalogRow {
  /** Hipparcos number, which is also how a Tycho-2 row says "this is already in Hipparcos". */
  readonly hip: number | null;
  /** Position in degrees, at the epoch the catalogue publishes it for. */
  readonly raDeg: number | null;
  readonly decDeg: number | null;
  /** Sexagesimal J2000 fallback, for the Hipparcos rows that have no ICRS solution. */
  readonly raHms: string | null;
  readonly decDms: string | null;
  readonly vMag: number;
  readonly colorIndex: number | null;
  /** Proper motion in RA, already times cos(dec), mas/yr. */
  readonly pmRaMasPerYear: number | null;
  readonly pmDecMasPerYear: number | null;
}

const HIPPARCOS_COLUMNS = [
  'HIP',
  'RAICRS',
  'DEICRS',
  'RAhms',
  'DEdms',
  'Vmag',
  'B-V',
  'pmRA',
  'pmDE',
];

const TYCHO2_COLUMNS = ['HIP', 'RAmdeg', 'DEmdeg', 'pmRA', 'pmDE', 'BTmag', 'VTmag'];

const PLAIN_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * Upper bound on rows, used to detect truncation rather than to limit the result.
 *
 * TAP services cut a result at their own default -- often 2,000 rows -- and say so only
 * in a header nobody reads. A silently short sky is the kind of failure that looks like
 * a rendering bug for a week, so we ask for far more than either catalogue returns and
 * then check we did not reach the ceiling.
 */
const MAX_ROWS = 400_000;

function quoted(column: string): string {
  return PLAIN_IDENTIFIER.test(column) ? column : `"${column}"`;
}

export function hipparcosQuery(magnitudeLimit: number): string {
  const selected = HIPPARCOS_COLUMNS.map(quoted).join(', ');
  return `SELECT ${selected} FROM "${HIPPARCOS_TABLE}" WHERE Vmag <= ${magnitudeLimit}`;
}

/**
 * Tycho-2, filtered on the *transformed* magnitude rather than on VT.
 *
 * Tycho photometry is its own system: BT and VT, measured through the satellite's own
 * passbands. Johnson V is recovered by the transformation published with the catalogue
 * (ESA SP-1200, Volume 1), and the cut has to be made on that, not on VT -- for a red
 * star the two differ by more than a tenth of a magnitude, which at the faint end of a
 * sky is a visible number of stars.
 */
export function tycho2Query(magnitudeLimit: number): string {
  const selected = TYCHO2_COLUMNS.map(quoted).join(', ');
  return (
    `SELECT ${selected} FROM "${TYCHO2_TABLE}" ` +
    'WHERE BTmag IS NOT NULL AND VTmag IS NOT NULL ' +
    `AND VTmag - ${TYCHO_V_FROM_VT} * (BTmag - VTmag) <= ${magnitudeLimit}`
  );
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
}

export function parseCsvTable(csv: string, required: readonly string[]): CsvTable {
  const lines = csv.split('\n').filter((line) => line.trim().length > 0);
  const header = lines[0];
  if (header === undefined) {
    throw new Error('VizieR returned an empty response.');
  }

  const columns = splitCsvLine(header);
  const index = new Map(columns.map((name, position) => [name, position]));
  for (const column of required) {
    if (!index.has(column)) {
      throw new Error(
        `VizieR response has no column "${column}". Got: ${columns.join(', ')}\n` +
          `First line of the body: ${lines[1] ?? '(none)'}`,
      );
    }
  }

  return {
    columns,
    rows: lines.slice(1).map(splitCsvLine),
    at: (row, column) => row[index.get(column) as number],
  };
}

function optionalNumber(raw: string | undefined, column: string, label: string): number | null {
  if (raw === undefined || raw === '') {
    return null;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${label}: column "${column}" is not a number: "${raw}"`);
  }
  return value;
}

export function parseHipparcosCsv(csv: string): CatalogRow[] {
  const table = parseCsvTable(csv, HIPPARCOS_COLUMNS);
  return table.rows.map((row) => {
    const label = `HIP ${table.at(row, 'HIP') ?? '?'}`;
    const vMag = optionalNumber(table.at(row, 'Vmag'), 'Vmag', label);
    if (vMag === null) {
      throw new Error(`${label} has no V magnitude, which the query filtered on.`);
    }
    const raHms = table.at(row, 'RAhms') ?? '';
    const decDms = table.at(row, 'DEdms') ?? '';
    return {
      hip: optionalNumber(table.at(row, 'HIP'), 'HIP', label),
      raDeg: optionalNumber(table.at(row, 'RAICRS'), 'RAICRS', label),
      decDeg: optionalNumber(table.at(row, 'DEICRS'), 'DEICRS', label),
      raHms: raHms === '' ? null : raHms,
      decDms: decDms === '' ? null : decDms,
      vMag,
      colorIndex: optionalNumber(table.at(row, 'B-V'), 'B-V', label),
      pmRaMasPerYear: optionalNumber(table.at(row, 'pmRA'), 'pmRA', label),
      pmDecMasPerYear: optionalNumber(table.at(row, 'pmDE'), 'pmDE', label),
    };
  });
}

/**
 * Tycho-2 rows, with BT and VT turned into Johnson V and B-V.
 *
 * The transformation is the catalogue's own, published alongside it:
 *
 *     V    = VT - 0.090 (BT - VT)
 *     B-V  = 0.850 (BT - VT)
 *
 * A first-order fit, quoted as good over -0.25 < BT-VT < 2.0, which covers 97% of the
 * stars inside our magnitude limit. It is a real approximation and the one place the
 * sky's photometry is transformed rather than measured in the system it is drawn in --
 * which is why Hipparcos wins wherever it has the same star.
 *
 * No sexagesimal fallback here: `RAmdeg`/`DEmdeg` are Tycho-2's mean positions **already
 * at J2000**, unlike Hipparcos's, so these rows need no epoch shift at all.
 */
export function parseTycho2Csv(csv: string): CatalogRow[] {
  const table = parseCsvTable(csv, TYCHO2_COLUMNS);
  const rows: CatalogRow[] = [];

  for (const row of table.rows) {
    const label = `TYC row ${rows.length}`;
    const bt = optionalNumber(table.at(row, 'BTmag'), 'BTmag', label);
    const vt = optionalNumber(table.at(row, 'VTmag'), 'VTmag', label);
    if (bt === null || vt === null) {
      // Filtered out by the query; a row without both carries no colour.
      continue;
    }
    rows.push({
      hip: optionalNumber(table.at(row, 'HIP'), 'HIP', label),
      raDeg: optionalNumber(table.at(row, 'RAmdeg'), 'RAmdeg', label),
      decDeg: optionalNumber(table.at(row, 'DEmdeg'), 'DEmdeg', label),
      raHms: null,
      decDms: null,
      vMag: vt - TYCHO_V_FROM_VT * (bt - vt),
      colorIndex: TYCHO_BV_FROM_BT_VT * (bt - vt),
      pmRaMasPerYear: optionalNumber(table.at(row, 'pmRA'), 'pmRA', label),
      pmDecMasPerYear: optionalNumber(table.at(row, 'pmDE'), 'pmDE', label),
    });
  }

  return rows;
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

/** Runs one ADQL query against VizieR and returns the CSV body. */
export async function queryVizier(adql: string, label: string): Promise<string> {
  const url = new URL(VIZIER_TAP_URL);
  url.searchParams.set('REQUEST', 'doQuery');
  url.searchParams.set('LANG', 'ADQL');
  url.searchParams.set('FORMAT', 'csv');
  url.searchParams.set('MAXREC', String(MAX_ROWS));
  url.searchParams.set('QUERY', adql);

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
          `VizieR rejected the ${label} query (HTTP ${response.status}): ${body.slice(0, 400)}`,
        );
      }

      const lines = body.split('\n').filter((line) => line.trim().length > 0);
      if (lines.length <= 1) {
        throw new Error(`VizieR returned no ${label} rows.`);
      }
      if (lines.length - 1 >= MAX_ROWS) {
        throw permanent(
          `The ${label} query returned ${lines.length - 1} rows, the requested maximum, so ` +
            'the result was truncated. Raise MAX_ROWS in vizier.ts.',
        );
      }
      return body;
    } catch (error) {
      lastError = error;
      if (isPermanent(error) || attempt === MAX_RETRIES) {
        break;
      }
      const wait = retryDelayMs(attempt, null);
      console.warn(
        `[stars] ${label}: attempt ${attempt}/${MAX_RETRIES} failed (${String(error)}). ` +
          `Retrying in ${(wait / 1000).toFixed(1)} s.`,
      );
      await delay(wait);
    }
  }

  throw new Error(`Could not read ${label} from VizieR: ${String(lastError)}`);
}

export async function fetchHipparcos(
  magnitudeLimit = STAR_MAGNITUDE_LIMIT,
): Promise<CatalogRow[]> {
  return parseHipparcosCsv(await queryVizier(hipparcosQuery(magnitudeLimit), 'Hipparcos'));
}

export async function fetchTycho2(magnitudeLimit = STAR_MAGNITUDE_LIMIT): Promise<CatalogRow[]> {
  return parseTycho2Csv(await queryVizier(tycho2Query(magnitudeLimit), 'Tycho-2'));
}
