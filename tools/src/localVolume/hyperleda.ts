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
 * the fields wanted, and CSV back. Names are a poor first way in -- the UNGC writes "KK13"
 * and "[CKT2009]d0926+70", the EVCC mostly numbers -- so each galaxy is first asked for by a
 * box on the sky about its centre, fifty boxes to a query joined by OR: an arcminute either
 * side, or for a large galaxy a fifth of its diameter, up to five (boxArcmin) -- the
 * catalogues' centres of a big galaxy differ more than a dwarf's (the UNGC puts M51's 2.4'
 * from HyperLEDA's, between it and NGC 5195). Fields: the name, PGC number and object type;
 * the centre (al2000 in hours, de2000 in degrees); `pa`, the major axis's position angle,
 * degrees east of north; `logr25`, log10 of the axis ratio a/b at the 25 B mag/arcsec^2
 * isophote; `logd25`, log10 of that isophote's diameter in 0.1 arcmin; `incl`, the
 * inclination HyperLEDA derives from it.
 *
 * ## The match
 *
 * A galaxy of type G -- or of type "?" (HyperLEDA's NGC 2784, among others) if its D25 is of
 * the right size -- found in this order (matchLeda):
 *
 * 1. Within an arcminute, the nearest of the same size: HyperLEDA's D25 within a factor of 4
 *    of what the catalogue measured (the UNGC's Holmberg diameter, which is about 1.2-1.5
 *    D25; three of the EVCC's half-light radii), so a background galaxy beside an anonymous
 *    dwarf the database does not hold lends it no orientation. With no D25 to check, only an
 *    object within 15 arcseconds.
 * 2. Farther out, within a large galaxy's wider box, the one closest to it in size: M51's
 *    record, not NGC 5195's, which is as near the UNGC's centre but a third of its size.
 * 3. Within 15 arcseconds, the nearest galaxy whatever its size: at the very centre there is
 *    no neighbour to mistake it for, and the sizes disagree for a reason -- the EVCC's
 *    SExtractor radii of the Virgo giants fall far short (M89's D25 is 5.5 times three of its
 *    R50), and behind the Milky Way's plane HyperLEDA's D25 is of what B light comes through
 *    five to seven magnitudes of dust (Maffei 1's and 2's are a quarter and a fifth of their
 *    Holmberg diameters).
 *
 * A galaxy the sky does not find is asked for by name (ledaNames): its NGC, IC, UGC, ESO or
 * PGC designation as HyperLEDA writes it, or the PGC number of one known only by a name
 * (LEDA_PGC). The name is the identity; only the separation is checked, against a slip of
 * designation (NAME_RADIUS_ARCMIN, or half the galaxy's diameter).
 *
 * Where HyperLEDA gives no position angle -- for most galaxies seen nearly face on it gives
 * none (M83's, M101's and IC 342's axis ratios are 0.95-0.97 there) -- it stays null here;
 * localVolume.ts fills the brightest from the literature (POSITION_ANGLES).
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
  /** Its names, its own first, as the app writes them ("NGC 4486", "IC 342", "Dwingeloo 1"). */
  readonly names: readonly string[];
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
/** A large galaxy's box: this fraction of its diameter, up to MAX_BOX_ARCMIN. */
const BOX_FRACTION = 0.2;
const MAX_BOX_ARCMIN = 5;
const BATCH = 50;
/** A galaxy found by name must lie within this of the catalogue's centre, or half its diameter. */
const NAME_RADIUS_ARCMIN = 2;
const FIELDS = 'objname,pgc,objtype,al2000,de2000,pa,logr25,logd25,incl';
const MAX_ATTEMPTS = 3;
const NO_SIZE_RADIUS_ARCMIN = 0.25;
const SIZE_FACTOR = 4;

/**
 * The PGC numbers of galaxies known by a name HyperLEDA does not use, whose record the sky
 * cannot confirm. Dwingeloo 1 is PGC 100170 in HyperLEDA (the record's name; 02h56m54.5s
 * +58d54'42", where NED places Dwingeloo 1): 0.56' from the UNGC's centre, and its D25 of
 * 0.48' -- B light through A_B = 6.3 magnitudes of the Milky Way's dust (the UNGC's) -- a
 * quarter of the UNGC's Holmberg diameter, 2.0'.
 */
export const LEDA_PGC: Readonly<Record<string, number>> = {
  'Dwingeloo 1': 100170,
};

/** A probe's box half-width, arcmin: an arcminute, or a fifth of a large galaxy's diameter, up to five. */
export function boxArcmin(probe: LedaProbe): number {
  return Math.min(MAX_BOX_ARCMIN, Math.max(BOX_ARCMIN, BOX_FRACTION * (probe.sizeArcmin ?? 0)));
}

/**
 * The galaxy's names as HyperLEDA's objname writes them: "NGC0628", "NGC4486A", "IC0342",
 * "UGC08638", "ESO270-017", "PGC047658" -- and the PGC number of one in LEDA_PGC. Names of
 * other catalogues (UGCA, DDO, KK, VCC, ...) HyperLEDA files under a PGC number: none.
 */
export function ledaNames(names: readonly string[]): string[] {
  const out: string[] = [];
  const pad = (n: string | number, width: number) => String(Number(n)).padStart(width, '0');
  for (const name of names) {
    const pgc = LEDA_PGC[name];
    let m: RegExpExecArray | null;
    if (pgc !== undefined) {
      out.push(`PGC${pad(pgc, 6)}`);
    } else if ((m = /^NGC (\d+)([A-Z]?)$/.exec(name)) !== null) {
      out.push(`NGC${pad(m[1]!, 4)}${m[2]}`);
    } else if ((m = /^IC (\d+)([A-Z]?)$/.exec(name)) !== null) {
      out.push(`IC${pad(m[1]!, 4)}${m[2]}`);
    } else if ((m = /^UGC (\d+)$/.exec(name)) !== null) {
      out.push(`UGC${pad(m[1]!, 5)}`);
    } else if ((m = /^ESO (\d+)-(\d+)$/.exec(name)) !== null) {
      out.push(`ESO${pad(m[1]!, 3)}-${pad(m[2]!, 3)}`);
    } else if ((m = /^PGC (\d+)$/.exec(name)) !== null) {
      out.push(`PGC${pad(m[1]!, 6)}`);
    }
  }
  return [...new Set(out)];
}

/** The WHERE clause asking for these names, which ledaNames made: letters, digits and "-". */
export function nameClause(names: readonly string[]): string {
  for (const name of names) {
    if (!/^[A-Z]+\d+[A-Z]?(-\d+)?$/.test(name)) {
      throw new Error(`Not a HyperLEDA name: "${name}".`);
    }
  }
  return `objname in (${names.map((name) => `'${name}'`).join(',')})`;
}

/** The WHERE clause asking for a box about each position (boxArcmin). */
export function boxClause(probes: readonly LedaProbe[]): string {
  return probes
    .map((probe) => {
      const { raDeg, decDeg } = probe;
      const w = boxArcmin(probe) / 60;
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

function toMatch(object: LedaObject, separation: number): LedaMatch {
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

/** The galaxy in `objects` that is the probe's, or null (see the header). */
export function matchLeda(probe: LedaProbe, objects: readonly LedaObject[]): LedaMatch | null {
  const size = probe.sizeArcmin;
  const box = boxArcmin(probe);
  const candidates = objects
    .map((object) => {
      const d25 = object.logD25 === null ? null : 0.1 * 10 ** object.logD25;
      const ratio = d25 === null || size === null || size <= 0 ? null : d25 / size;
      return {
        object,
        separation: separationArcmin(probe.raDeg, probe.decDeg, object.raDeg, object.decDeg),
        ratio,
        sized: ratio !== null && ratio < SIZE_FACTOR && 1 / ratio < SIZE_FACTOR,
      };
    })
    .filter((c) => (c.object.type === 'G' || (c.object.type === '?' && c.sized)) && c.separation <= box)
    .sort((a, b) => a.separation - b.separation);
  // 1. Within an arcminute, the nearest of its size (or, with no size to check, at its centre).
  const near = candidates.find(
    (c) => c.separation <= BOX_ARCMIN && (c.ratio === null ? c.separation <= NO_SIZE_RADIUS_ARCMIN : c.sized),
  );
  // 2. Farther out, in a large galaxy's box, the one closest to it in size.
  const far = candidates
    .filter((c) => c.separation > BOX_ARCMIN && c.sized)
    .sort((a, b) => Math.abs(Math.log(a.ratio!)) - Math.abs(Math.log(b.ratio!)))[0];
  // 3. At its very centre, whatever its size.
  const centred = candidates.find((c) => c.separation <= NO_SIZE_RADIUS_ARCMIN && c.object.type === 'G');
  const found = near ?? far ?? centred;
  return found === undefined ? null : toMatch(found.object, found.separation);
}

/** The probe's galaxy among objects asked for by name: one of its names, near enough its centre. */
export function matchLedaByName(probe: LedaProbe, objects: readonly LedaObject[]): LedaMatch | null {
  const wanted = new Set(ledaNames(probe.names));
  const radius = Math.max(NAME_RADIUS_ARCMIN, 0.5 * (probe.sizeArcmin ?? 0));
  const found = objects
    .filter((object) => wanted.has(object.name))
    .map((object) => ({ object, separation: separationArcmin(probe.raDeg, probe.decDeg, object.raDeg, object.decDeg) }))
    .filter(({ separation }) => separation <= radius)
    .sort((a, b) => a.separation - b.separation)[0];
  return found === undefined ? null : toMatch(found.object, found.separation);
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
 * Every probe's match, or null where HyperLEDA has none: by the sky, then by name for those
 * the sky did not find. The whole answer null when HyperLEDA cannot be reached at all (the
 * run carries on without position angles).
 */
export async function fetchLedaMatches(probes: readonly LedaProbe[]): Promise<(LedaMatch | null)[] | null> {
  const out: (LedaMatch | null)[] = [];
  try {
    for (let start = 0; start < probes.length; start += BATCH) {
      const batch = probes.slice(start, start + BATCH);
      const objects = await queryOnce(boxClause(batch));
      for (const probe of batch) {
        out.push(matchLeda(probe, objects));
      }
    }
    const unfound = probes.flatMap((probe, i) => (out[i] === null && ledaNames(probe.names).length > 0 ? [i] : []));
    for (let start = 0; start < unfound.length; start += BATCH) {
      const batch = unfound.slice(start, start + BATCH);
      const objects = await queryOnce(nameClause([...new Set(batch.flatMap((i) => ledaNames(probes[i]!.names)))]));
      for (const i of batch) {
        out[i] = matchLedaByName(probes[i]!, objects);
      }
    }
  } catch (error) {
    console.error(`[local-volume] HyperLEDA: FAILED, position angles left out of this run (${String(error).slice(0, 400)})`);
    return null;
  }
  return out;
}
