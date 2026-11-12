import { HYPERLEDA_SQL_URLS, REQUEST_TIMEOUT_MS } from '../config.ts';
import { retryDelayMs } from '../horizons/client.ts';

/**
 * Position angles and axis ratios from HyperLEDA (Makarov et al. 2014, A&A 570, A13), for the
 * galaxies of the Local Volume and Virgo: neither catalogue gives a position angle, and the
 * EVCC gives no axis ratio.
 *
 * ## The query
 *
 * HyperLEDA's SQL interface (fG.cgi) on its table of mean data, `meandata`: a WHERE clause,
 * the fields wanted, and CSV back. Names are no way in -- the UNGC writes "KK13" and
 * "[CKT2009]d0926+70", the EVCC only numbers -- so each galaxy is asked for by a box on the
 * sky, an arcminute either side of its centre, fifty boxes to a query joined by OR. Fields:
 * the name, PGC number and object type; the centre (al2000 in hours, de2000 in degrees);
 * `pa`, the major axis's position angle, degrees east of north; `logr25`, log10 of the axis
 * ratio a/b at the 25 B mag/arcsec^2 isophote; `logd25`, log10 of that isophote's diameter
 * in 0.1 arcmin; `incl`, the inclination HyperLEDA derives from it.
 *
 * ## The match
 *
 * The nearest object of type G (galaxy) in the box -- if it is the same galaxy, which is
 * checked by its size: HyperLEDA's D25 must lie within a factor of 4 of what the catalogue
 * measured (the UNGC's Holmberg diameter, which is about 1.2-1.5 D25; three of the EVCC's
 * half-light radii, which a giant elliptical's SExtractor radius falls short of -- M49's
 * D25 is 3.1 of them), so a background galaxy beside an anonymous dwarf the database does not
 * hold lends it no orientation. With no D25 to check, only an object within 15 arcseconds
 * is taken.
 */

export interface LedaObject {
  readonly name: string;
  readonly pgc: number;
  readonly type: string;
  readonly raDeg: number;
  readonly decDeg: number;
  readonly positionAngleDeg: number | null;
  readonly logR25: number | null;
  readonly logD25: number | null;
  readonly inclinationDeg: number | null;
}

/** What a catalogue knows of a galaxy, to find it in HyperLEDA. */
export interface LedaProbe {
  readonly raDeg: number;
  readonly decDeg: number;
  /** The diameter HyperLEDA's D25 should be comparable to, arcmin; null if none. */
  readonly sizeArcmin: number | null;
}

export interface LedaMatch {
  readonly pgc: number;
  readonly name: string;
  readonly separationArcmin: number;
  readonly positionAngleDeg: number | null;
  readonly axisRatio: number | null;
  readonly inclinationDeg: number | null;
}

const BOX_ARCMIN = 1;
const BATCH = 50;
const FIELDS = 'objname,pgc,objtype,al2000,de2000,pa,logr25,logd25,incl';
const MAX_ATTEMPTS = 3;
const NO_SIZE_RADIUS_ARCMIN = 0.25;
const SIZE_FACTOR = 4;

/** The WHERE clause asking for a box about each position. */
export function boxClause(probes: readonly LedaProbe[]): string {
  const w = BOX_ARCMIN / 60;
  return probes
    .map(({ raDeg, decDeg }) => {
      const dRa = w / Math.max(Math.cos((decDeg * Math.PI) / 180), 0.01);
      const lo = (raDeg - dRa) / 15;
      const hi = (raDeg + dRa) / 15;
      // A box across 0h is two boxes.
      const ra =
        lo < 0
          ? `(al2000 >= ${(lo + 24).toFixed(5)} or al2000 <= ${hi.toFixed(5)})`
          : hi >= 24
            ? `(al2000 >= ${lo.toFixed(5)} or al2000 <= ${(hi - 24).toFixed(5)})`
            : `al2000 between ${lo.toFixed(5)} and ${hi.toFixed(5)}`;
      return `(de2000 between ${(decDeg - w).toFixed(4)} and ${(decDeg + w).toFixed(4)} and ${ra})`;
    })
    .join(' or ');
}

export function ledaUrl(base: string, where: string): string {
  const params = new URLSearchParams({ n: 'meandata', c: 'o', of: '1,leda,simbad', nra: 'l', nakd: '1', d: FIELDS, sql: where, ob: '', a: 'csv[;]' });
  return `${base}?${params.toString()}`;
}

/**
 * fG.cgi's CSV: comment lines start with "#", then the header, a "#---" rule, and the rows,
 * ";"-separated. A query it could not run answers 200 with "Internal database error": thrown.
 */
export function parseLedaCsv(text: string): LedaObject[] {
  if (/Internal database error|cannot be displayed/.test(text)) {
    throw new Error(`HyperLEDA refused the query: ${text.split('\n').find((line) => /error|cannot/i.test(line)) ?? ''}`);
  }
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '' && !line.startsWith('#'));
  const header = lines[0];
  if (header === undefined || !header.startsWith('objname;')) {
    if (/successfully retrieved|0 lines? were/.test(text) || /end of data table/.test(text)) {
      return [];
    }
    throw new Error('HyperLEDA answered with no table.');
  }
  const names = header.split(';').map((name) => name.trim());
  const at = (cells: string[], name: string) => cells[names.indexOf(name)]?.trim() ?? '';
  const num = (text: string) => (text === '' || !Number.isFinite(Number(text)) ? null : Number(text));
  return lines.slice(1).map((line) => {
    const cells = line.split(';');
    return {
      name: at(cells, 'objname'),
      pgc: Number(at(cells, 'pgc')),
      type: at(cells, 'objtype'),
      raDeg: Number(at(cells, 'al2000')) * 15,
      decDeg: Number(at(cells, 'de2000')),
      positionAngleDeg: num(at(cells, 'pa')),
      logR25: num(at(cells, 'logr25')),
      logD25: num(at(cells, 'logd25')),
      inclinationDeg: num(at(cells, 'incl')),
    };
  });
}

/** Angular separation, arcminutes. */
export function separationArcmin(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const r = Math.PI / 180;
  const s = Math.sin(((dec2 - dec1) * r) / 2) ** 2 + Math.cos(dec1 * r) * Math.cos(dec2 * r) * Math.sin(((ra2 - ra1) * r) / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(s)))) / r * 60;
}

/** The galaxy in `objects` that is the probe's, or null (see the header). */
export function matchLeda(probe: LedaProbe, objects: readonly LedaObject[]): LedaMatch | null {
  const candidates = objects
    .filter((object) => object.type === 'G')
    .map((object) => ({ object, separation: separationArcmin(probe.raDeg, probe.decDeg, object.raDeg, object.decDeg) }))
    .filter(({ separation }) => separation <= BOX_ARCMIN)
    .sort((a, b) => a.separation - b.separation);
  for (const { object, separation } of candidates) {
    const d25 = object.logD25 === null ? null : 0.1 * 10 ** object.logD25;
    const sameSize =
      d25 === null || probe.sizeArcmin === null
        ? separation <= NO_SIZE_RADIUS_ARCMIN
        : d25 / probe.sizeArcmin < SIZE_FACTOR && probe.sizeArcmin / d25 < SIZE_FACTOR;
    if (!sameSize) {
      continue;
    }
    // A position angle is a direction, 0-180 degrees; HyperLEDA's are, but keep them so.
    const pa = object.positionAngleDeg === null ? null : ((object.positionAngleDeg % 180) + 180) % 180;
    return {
      pgc: object.pgc,
      name: object.name,
      separationArcmin: separation,
      positionAngleDeg: pa,
      axisRatio: object.logR25 === null ? null : 10 ** -object.logR25,
      inclinationDeg: object.inclinationDeg,
    };
  }
  return null;
}

async function queryOnce(where: string): Promise<LedaObject[]> {
  const failures: string[] = [];
  for (const base of HYPERLEDA_SQL_URLS) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(ledaUrl(base, where), { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return parseLedaCsv(await response.text());
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

/**
 * Every probe's match, or null where HyperLEDA has none; the whole answer null when
 * HyperLEDA cannot be reached at all (the run carries on without position angles).
 */
export async function fetchLedaMatches(probes: readonly LedaProbe[]): Promise<(LedaMatch | null)[] | null> {
  const out: (LedaMatch | null)[] = [];
  for (let start = 0; start < probes.length; start += BATCH) {
    const batch = probes.slice(start, start + BATCH);
    let objects: LedaObject[];
    try {
      objects = await queryOnce(boxClause(batch));
    } catch (error) {
      console.error(`[local-volume] HyperLEDA: FAILED, position angles left out of this run (${String(error).slice(0, 400)})`);
      return null;
    }
    for (const probe of batch) {
      out.push(matchLeda(probe, objects));
    }
  }
  return out;
}
