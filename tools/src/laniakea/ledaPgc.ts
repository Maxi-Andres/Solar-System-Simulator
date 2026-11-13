import { HYPERLEDA_PGC_BATCH, HYPERLEDA_SQL_URLS, REQUEST_TIMEOUT_MS } from '../config.ts';
import { retryDelayMs } from '../horizons/client.ts';

/**
 * HyperLEDA (Makarov et al. 2014, A&A 570, A13) for every galaxy G3 holds, by its PGC
 * number -- the identifier Cosmicflows-4 and Tully's 2MASS groups both give. Neither gives a
 * name, a magnitude, a size or an orientation; HyperLEDA's mean data do, homogenised across
 * the literature:
 *
 * - `objname`: the name HyperLEDA files it under ("NGC4889", "UGC12889", "ESO137-006",
 *   "PGC000004");
 * - `t`: the de Vaucouleurs T type, a mean of the classifications published;
 * - `bt`, `vt`: total B and V magnitudes, not corrected for anything; `ag`: the Galactic
 *   extinction in B in front of it (Schlafly & Finkbeiner 2011's recalibration of Schlegel
 *   et al. 1998's map);
 * - `logd25`: log10 of the 25 B mag/arcsec^2 isophote's major diameter, in 0.1 arcmin;
 *   `logr25`: log10 of its axis ratio a/b; `pa`: its major axis's position angle, degrees
 *   east of north; `incl`: the inclination HyperLEDA derives from the axis ratio and type.
 *
 * The SQL interface (fG.cgi) is asked by POST, HYPERLEDA_PGC_BATCH numbers a query: a GET
 * that long is refused (414). The run fails if it cannot be read: without it a third of
 * the galaxies would have no brightness at all.
 */

export interface LedaRecord {
  readonly pgc: number;
  readonly name: string;
  readonly type: string;
  readonly raDeg: number | null;
  readonly decDeg: number | null;
  readonly tType: number | null;
  readonly bMag: number | null;
  readonly vMag: number | null;
  readonly extinctionB: number | null;
  readonly logD25: number | null;
  readonly logR25: number | null;
  readonly positionAngleDeg: number | null;
  readonly inclinationDeg: number | null;
}

export const LEDA_FIELDS = 'objname,pgc,objtype,al2000,de2000,t,bt,vt,ag,logd25,logr25,pa,incl';
const MAX_ATTEMPTS = 4;
const CONCURRENT = 3;

/**
 * fG.cgi's CSV: comment lines start with "#", then the header and the rows, ";"-separated. A
 * query it could not run answers 200 with "Internal database error": thrown.
 */
export function parseLedaPgcCsv(text: string): LedaRecord[] {
  if (/Internal database error|cannot be displayed/.test(text)) {
    throw new Error(`HyperLEDA refused the query: ${text.split('\n').find((line) => /error|cannot/i.test(line)) ?? ''}`);
  }
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '' && !line.startsWith('#'));
  const header = lines[0];
  if (header === undefined || !header.startsWith('objname;')) {
    if (/0 lines? were|end of data table/.test(text)) {
      return [];
    }
    throw new Error('HyperLEDA answered with no table.');
  }
  const names = header.split(';').map((name) => name.trim());
  for (const field of LEDA_FIELDS.split(',')) {
    if (!names.includes(field)) {
      throw new Error(`HyperLEDA's answer has no column "${field}".`);
    }
  }
  const index = new Map(names.map((name, i) => [name, i]));
  return lines.slice(1).map((line) => {
    const cells = line.split(';');
    const text = (name: string) => cells[index.get(name)!]?.trim() ?? '';
    const num = (name: string) => {
      const value = text(name);
      return value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
    };
    const ra = num('al2000');
    return {
      pgc: Number(text('pgc')),
      name: text('objname'),
      type: text('objtype'),
      raDeg: ra === null ? null : ra * 15,
      decDeg: num('de2000'),
      tType: num('t'),
      bMag: num('bt'),
      vMag: num('vt'),
      extinctionB: num('ag'),
      logD25: num('logd25'),
      logR25: num('logr25'),
      positionAngleDeg: num('pa'),
      inclinationDeg: num('incl'),
    };
  });
}

/** The form a query is posted as. */
export function ledaForm(where: string): URLSearchParams {
  return new URLSearchParams({ n: 'meandata', c: 'o', of: '1,leda,simbad', nra: 'l', nakd: '1', d: LEDA_FIELDS, sql: where, ob: '', a: 'csv[;]' });
}

/** The WHERE clause for these PGC numbers: whole numbers only, so nothing else reaches the SQL. */
export function pgcClause(pgcs: readonly number[]): string {
  for (const pgc of pgcs) {
    if (!Number.isInteger(pgc) || pgc <= 0) {
      throw new Error(`Not a PGC number: ${pgc}.`);
    }
  }
  return `pgc in (${pgcs.join(',')})`;
}

async function queryOnce(where: string): Promise<LedaRecord[]> {
  const failures: string[] = [];
  for (const base of HYPERLEDA_SQL_URLS) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(base, { method: 'POST', body: ledaForm(where), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return parseLedaPgcCsv(await response.text());
      } catch (error) {
        failures.push(`${base} #${attempt}: ${String(error).slice(0, 200)}`);
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((done) => setTimeout(done, retryDelayMs(attempt, null)));
        }
      }
    }
  }
  throw new Error(`HyperLEDA could not be read:\n  ${failures.join('\n  ')}`);
}

/** Every one of these PGC numbers HyperLEDA holds, by number. Throws if HyperLEDA cannot be read. */
export async function fetchLedaByPgc(pgcs: readonly number[]): Promise<Map<number, LedaRecord>> {
  const unique = [...new Set(pgcs)].sort((a, b) => a - b);
  const batches: number[][] = [];
  for (let start = 0; start < unique.length; start += HYPERLEDA_PGC_BATCH) {
    batches.push(unique.slice(start, start + HYPERLEDA_PGC_BATCH));
  }
  const out = new Map<number, LedaRecord>();
  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next]!;
      next += 1;
      for (const record of await queryOnce(pgcClause(batch))) {
        out.set(record.pgc, record);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENT }, worker));
  return out;
}
